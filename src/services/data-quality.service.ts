/**
 * DataQualityService
 * Record-completeness and glossary-housekeeping checks over the whole
 * database, so problems surface before a regulatory export is attempted.
 *
 * Legacy parity (gmocu.py check_plasmids L1696, check_features L1729,
 * check_organisms L1774 — run at startup and after cassette/feature saves):
 * - Cassette tokens missing from the feature glossary ("plasmid: token").
 * - Organisms used by features/GMOs missing from the organism glossary.
 * - Glossary entries with empty fields.
 * - Duplicate plasmid names; plasmids without backbone vector, cassettes, GMOs.
 * - Glossary entries that no record references ("redundant").
 *
 * Deliberate improvement over legacy: legacy COMPUTES the check_plasmids
 * lists and the redundant/duplicate lists but never surfaces them — the
 * return values are discarded at every call site (gmocu.py 1892-1894,
 * 1916-1917, 1942-1943, 2049), and check_plasmids has no popup at all.
 * v2 reports all of them, graded by severity.
 *
 * The two error-level checks delegate to ReportService.checkGlossaryIntegrity
 * so the export gate and this report can never disagree.
 */

import { GlossaryFeature, Organism } from '@domain/types';
import { cassetteBaseTokens } from '@domain/cassette-tokens';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { ReportService } from './report.service';

/**
 * error   — blocks Formblatt-Z generation (the export integrity gate)
 * warning — record incomplete; export still possible
 * info    — housekeeping; nothing is broken
 */
export type HealthSeverity = 'error' | 'warning' | 'info';

export interface HealthCheck {
  id: string;
  label: string;
  /** What the check looks for, in the user's terms */
  description: string;
  severity: HealthSeverity;
  /** Offending records, formatted for display; empty means the check passed */
  items: string[];
}

export interface HealthReport {
  /** True when no error-level check has findings (i.e. exports can run) */
  ok: boolean;
  checkedAt: string;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Every check, passing ones included (items: []) */
  checks: HealthCheck[];
}

/** Plasmid columns the lab-spreadsheet checks read */
interface LabPlasmidRow {
  id: string;
  name: string;
  constructName: string | null;
  comment: string | null;
  notes: string | null;
  bacterialResistance: string | null;
}

/** Glycerol stock columns the lab-spreadsheet checks read */
interface LabStockRow {
  stockId: string;
  plasmidId: string | null;
  organism: string | null;
  strain: string | null;
  constructLabel: string | null;
  madeOn: string | null;
}

interface PlasmidRow {
  id: string;
  name: string;
  backboneVector: string | null;
}

/**
 * Per-plasmid Formblatt-Z readiness (locked UX requirement: row-level
 * readiness indicator).
 *
 * blocked    — this plasmid's data is why generation is refused
 * incomplete — generation runs, but the plasmid is absent or has gaps
 * ready      — contributes complete rows
 */
export type ReadinessLevel = 'ready' | 'incomplete' | 'blocked';

export interface PlasmidReadiness {
  plasmidId: string;
  level: ReadinessLevel;
  /** Why it is not ready, blocking reasons first; empty when ready */
  reasons: string[];
}

interface CassetteRow {
  name: string;
  plasmidId: string;
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/** Names appearing more than once, each reported once (legacy `dupes`) */
function duplicates(names: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      dupes.add(name);
    }
    seen.add(name);
  }
  return [...dupes];
}

export class DataQualityService {
  private logger: Logger;
  private reportService: ReportService;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.reportService = new ReportService(this.logger);
  }

  /**
   * Run every check. Always returns a full report — a check with no
   * findings is included with an empty `items` list.
   */
  async runChecks(): Promise<HealthReport> {
    this.logger.info('DataQualityService.runChecks');

    const db = getQueryBuilder();
    const [integrity, plasmids, cassettes, features, organisms, gmoOrganisms, labRows] =
      await Promise.all([
        this.reportService.checkGlossaryIntegrity(),
        db('plasmids').select('id', 'name', 'backboneVector') as Promise<PlasmidRow[]>,
        db('cassettes').select('name', 'plasmidId') as Promise<CassetteRow[]>,
        db('glossary_features').select('*') as Promise<GlossaryFeature[]>,
        db('organisms').select('*') as Promise<Organism[]>,
        db('gmos').select('plasmidId', 'organismName') as Promise<
          { plasmidId: string; organismName: string }[]
        >,
        this.labChecks(),
      ]);

    const plasmidsWithCassettes = new Set(cassettes.map((c) => c.plasmidId));
    const plasmidsWithGmos = new Set(gmoOrganisms.map((g) => g.plasmidId));

    // Every base token used anywhere (variants stripped, legacy tokenization)
    const usedTokens = new Set<string>();
    for (const cassette of cassettes) {
      for (const token of cassetteBaseTokens(cassette.name)) {
        usedTokens.add(token);
      }
    }

    // An organism counts as used when a feature or GMO names it by either
    // short or full name — the same resolution the reports use
    const referencedOrganismNames = new Set<string>();
    for (const feature of features) {
      if (!isBlank(feature.organism)) {
        referencedOrganismNames.add(feature.organism as string);
      }
    }
    for (const gmo of gmoOrganisms) {
      if (!isBlank(gmo.organismName)) {
        referencedOrganismNames.add(gmo.organismName);
      }
    }

    const incompleteFeatures: string[] = [];
    for (const feature of features) {
      const blanks: string[] = [];
      if (isBlank(feature.alias)) blanks.push('alias');
      if (isBlank(feature.organism)) blanks.push('organism');
      if (isBlank(feature.risk)) blanks.push('risk');
      if (blanks.length > 0) {
        incompleteFeatures.push(`${feature.annotation}: missing ${blanks.join(', ')}`);
      }
    }

    const checks: HealthCheck[] = [
      {
        id: 'missing-features',
        label: 'Cassette tokens missing from the glossary',
        description:
          'Every token used in a cassette must exist in the Nucleic acids glossary. Check for typos before adding entries.',
        severity: 'error',
        items: integrity.missingFeatures,
      },
      {
        id: 'missing-organisms',
        label: 'Organisms missing from the glossary',
        description:
          'Organisms referenced by glossary features or GMO records must exist in the Organisms glossary.',
        severity: 'error',
        items: integrity.missingOrganisms,
      },
      {
        id: 'duplicate-plasmid-names',
        label: 'Duplicate plasmid names',
        description: 'Plasmid names should be unique so reports and imports stay unambiguous.',
        severity: 'warning',
        items: duplicates(plasmids.map((p) => p.name)),
      },
      {
        id: 'plasmids-without-backbone',
        label: 'Plasmids without an original vector',
        description:
          'Formblatt-Z reports the original vector (Ausgangsvektor) for each plasmid; a blank leaves the column empty.',
        severity: 'warning',
        items: plasmids.filter((p) => isBlank(p.backboneVector)).map((p) => p.name),
      },
      {
        id: 'plasmids-without-cassettes',
        label: 'Plasmids without cassettes',
        description:
          'A plasmid with no cassette contributes no donor organisms or nucleic acids to a report.',
        severity: 'warning',
        items: plasmids.filter((p) => !plasmidsWithCassettes.has(p.id)).map((p) => p.name),
      },
      {
        id: 'plasmids-without-gmos',
        label: 'Plasmids without GMO records',
        description:
          'Formblatt-Z has one row per GMO, so a plasmid without GMO records never appears in it.',
        severity: 'warning',
        items: plasmids.filter((p) => !plasmidsWithGmos.has(p.id)).map((p) => p.name),
      },
      {
        id: 'incomplete-glossary-features',
        label: 'Glossary features with empty fields',
        description:
          'Alias, organism, and risk are used in reports; entries missing them produce blank report cells.',
        severity: 'warning',
        items: incompleteFeatures,
      },
      {
        id: 'duplicate-organism-short-names',
        label: 'Duplicate organism short names',
        description:
          'Features and GMOs may reference an organism by its short name, so duplicates make the reference ambiguous.',
        severity: 'warning',
        items: duplicates(
          organisms.map((o) => o.shortName).filter((s): s is string => !isBlank(s))
        ),
      },
      {
        id: 'redundant-features',
        label: 'Unused glossary features',
        description:
          'Glossary entries no cassette references. Harmless, but candidates for tidying.',
        severity: 'info',
        items: features.filter((f) => !usedTokens.has(f.annotation)).map((f) => f.annotation),
      },
      {
        id: 'redundant-organisms',
        label: 'Unused organisms',
        description:
          'Organism glossary entries that no feature or GMO references. Harmless, but candidates for tidying.',
        severity: 'info',
        items: organisms
          .filter(
            (o) =>
              !referencedOrganismNames.has(o.fullName) &&
              (isBlank(o.shortName) || !referencedOrganismNames.has(o.shortName as string))
          )
          .map((o) => o.fullName),
      },
      ...labRows,
    ];

    const withFindings = (severity: HealthSeverity) =>
      checks.filter((c) => c.severity === severity && c.items.length > 0).length;

    const report: HealthReport = {
      ok: withFindings('error') === 0,
      checkedAt: new Date().toISOString(),
      errorCount: withFindings('error'),
      warningCount: withFindings('warning'),
      infoCount: withFindings('info'),
      checks,
    };

    this.logger.info('DataQualityService.runChecks completed', {
      ok: report.ok,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      infoCount: report.infoCount,
    });

    return report;
  }

  /**
   * Checks over the data imported from the lab spreadsheet.
   *
   * These exist because the spreadsheet records its own problems in prose —
   * "the plasmids dates arent correct", "not designed yet", "bac: Kan???".
   * Importing as-is and surfacing them here is the alternative to asking
   * anyone to hand-clean a 405-row file that would only drift again.
   *
   * All informational or warning level: none of them blocks an export.
   */
  private async labChecks(): Promise<HealthCheck[]> {
    const db = getQueryBuilder();

    const [plasmids, preps, stocks] = await Promise.all([
      db('plasmids').select(
        'id',
        'name',
        'constructName',
        'comment',
        'notes',
        'bacterialResistance'
      ) as Promise<LabPlasmidRow[]>,
      db('plasmid_preps').select('plasmidId', 'concentrationNgUl') as Promise<
        { plasmidId: string; concentrationNgUl: number | null }[]
      >,
      db('glycerol_stocks').select(
        'stockId',
        'plasmidId',
        'organism',
        'strain',
        'constructLabel',
        'madeOn'
      ) as Promise<LabStockRow[]>,
    ]);

    // Plasmids whose every glycerol stock is a reserved number with no date.
    const madeStockPlasmidIds = new Set<string>();
    const reservedStockPlasmidIds = new Set<string>();
    for (const stock of stocks) {
      if (!stock.plasmidId) {
        continue;
      }
      (isBlank(stock.madeOn) ? reservedStockPlasmidIds : madeStockPlasmidIds).add(stock.plasmidId);
    }
    const reservedOnlyPlasmidIds = new Set(
      Array.from(reservedStockPlasmidIds).filter((id) => !madeStockPlasmidIds.has(id))
    );

    const prepsByPlasmid = new Map<string, Array<{ concentrationNgUl: number | null }>>();
    for (const prep of preps) {
      const list = prepsByPlasmid.get(prep.plasmidId) ?? [];
      list.push(prep);
      prepsByPlasmid.set(prep.plasmidId, list);
    }

    const missingConcentration: string[] = [];
    const neverPrepped: string[] = [];
    const flaggedInNotes: string[] = [];
    const uncertainResistance: string[] = [];

    for (const plasmid of plasmids) {
      const label = plasmid.constructName
        ? `${plasmid.name} (${plasmid.constructName})`
        : plasmid.name;
      const prepList = prepsByPlasmid.get(plasmid.id) ?? [];

      // "Planned" needs positive evidence, not merely an absent prep — every
      // plasmid entered by hand lacks one. The signal is a plasmid whose
      // glycerol stock number was reserved and whose stock was never frozen:
      // allocated on both counts, existing on neither.
      if (prepList.length === 0 && reservedOnlyPlasmidIds.has(plasmid.id)) {
        neverPrepped.push(
          isBlank(plasmid.comment) ? label : `${label}: ${plasmid.comment as string}`
        );
      } else if (prepList.length > 0 && prepList.every((prep) => prep.concentrationNgUl === null)) {
        missingConcentration.push(label);
      }

      // The lab writes its own corrections into the free-text columns.
      const note = [plasmid.comment, plasmid.notes].filter((text) => !isBlank(text)).join(' · ');
      if (/\b(not correct|arent correct|aren't correct|wrong|incorrect|check)\b/i.test(note)) {
        flaggedInNotes.push(`${label}: ${note}`);
      }

      if (plasmid.bacterialResistance?.includes('?')) {
        uncertainResistance.push(`${label}: ${plasmid.bacterialResistance}`);
      }
    }

    const reservedStocks = stocks.filter((stock) => isBlank(stock.madeOn)).map((s) => s.stockId);

    // A stock and its plasmid can name the same construct differently: AJM9
    // carries pPXm_35SprFL-sGeNL(C) while pJM0152 is named pPXm_35S_sNL(C).
    // The label prints the stock's name, so the disagreement is worth seeing.
    const plasmidsById = new Map(plasmids.map((plasmid) => [plasmid.id, plasmid]));
    const constructMismatches: string[] = [];
    for (const stock of stocks) {
      const stockName = stock.constructLabel?.trim();
      const plasmid = stock.plasmidId ? plasmidsById.get(stock.plasmidId) : undefined;
      const plasmidName = plasmid?.constructName?.trim();
      if (stockName && plasmidName && stockName !== plasmidName) {
        constructMismatches.push(
          `${stock.stockId}: "${stockName}" vs ${plasmid?.name} "${plasmidName}"`
        );
      }
    }

    // One strain should map to one organism; AS109 appears under both
    // A. rhizogenes and A. tumefaciens in the imported sheet.
    const organismsByStrain = new Map<string, Set<string>>();
    for (const stock of stocks) {
      const strain = stock.strain?.trim();
      const organism = stock.organism?.trim();
      if (!strain || !organism) {
        continue;
      }
      const set = organismsByStrain.get(strain) ?? new Set<string>();
      set.add(organism);
      organismsByStrain.set(strain, set);
    }
    const strainConflicts = Array.from(organismsByStrain.entries())
      .filter(([, set]) => set.size > 1)
      .map(([strain, set]) => `${strain}: ${Array.from(set).sort().join(' / ')}`);

    return [
      {
        id: 'plasmid-missing-concentration',
        label: 'Prepped but never measured',
        description:
          'The plasmid has a prep on record with no concentration, so its label would print without one.',
        severity: 'warning',
        items: missingConcentration,
      },
      {
        id: 'plasmid-never-prepped',
        label: 'Planned, not yet made',
        description:
          'No prep has been recorded, so the plasmid does not physically exist yet. Any note from the lab is shown alongside.',
        severity: 'info',
        items: neverPrepped,
      },
      {
        id: 'plasmid-flagged-in-notes',
        label: 'Flagged by the lab in a comment',
        description:
          'The comment or notes column says something is wrong with this record. Kept verbatim from the spreadsheet.',
        severity: 'warning',
        items: flaggedInNotes,
      },
      {
        id: 'resistance-uncertain',
        label: 'Resistance marked uncertain',
        description:
          'The spreadsheet recorded this resistance with a question mark. Confirm it before relying on the value.',
        severity: 'info',
        items: uncertainResistance,
      },
      {
        id: 'stock-reserved-not-made',
        label: 'Stock number reserved, stock not made',
        description:
          'A glycerol stock ID exists with no date, so the number is allocated but the tube was never frozen.',
        severity: 'info',
        items: reservedStocks,
      },
      {
        id: 'stock-construct-name-mismatch',
        label: 'Stock and plasmid name the construct differently',
        description:
          'A glycerol stock records a different construct name from its plasmid. The label prints the stock’s name; one of the two spreadsheets is out of date.',
        severity: 'info',
        items: constructMismatches,
      },
      {
        id: 'strain-organism-conflict',
        label: 'One strain, two organisms',
        description:
          'The same strain is recorded under different organisms. One of them is a typo in the source spreadsheet.',
        severity: 'warning',
        items: strainConflicts,
      },
    ];
  }

  /**
   * Formblatt-Z readiness for every plasmid, one entry per plasmid.
   *
   * Same rules as the global report, attributed per record: a plasmid is
   * `blocked` when its own data is what the export gate rejects, and
   * `incomplete` when generation would succeed but the plasmid contributes
   * nothing (no GMO rows) or leaves report cells blank.
   */
  async plasmidReadiness(): Promise<PlasmidReadiness[]> {
    this.logger.info('DataQualityService.plasmidReadiness');

    const db = getQueryBuilder();
    const [plasmids, cassettes, features, organisms, gmos] = await Promise.all([
      db('plasmids').select('id', 'name', 'backboneVector') as Promise<PlasmidRow[]>,
      db('cassettes').select('name', 'plasmidId') as Promise<CassetteRow[]>,
      db('glossary_features').select('annotation', 'organism') as Promise<GlossaryFeature[]>,
      db('organisms').select('fullName', 'shortName') as Promise<Organism[]>,
      db('gmos').select('plasmidId', 'organismName') as Promise<
        { plasmidId: string; organismName: string }[]
      >,
    ]);

    const featureOrganism = new Map(features.map((f) => [f.annotation, f.organism ?? null]));
    // Features and GMOs may name an organism by short OR full name
    const organismNames = new Set<string>();
    for (const organism of organisms) {
      organismNames.add(organism.fullName);
      if (!isBlank(organism.shortName)) {
        organismNames.add(organism.shortName as string);
      }
    }

    const cassettesByPlasmid = new Map<string, string[]>();
    for (const cassette of cassettes) {
      const list = cassettesByPlasmid.get(cassette.plasmidId);
      if (list) {
        list.push(cassette.name);
      } else {
        cassettesByPlasmid.set(cassette.plasmidId, [cassette.name]);
      }
    }

    const gmoOrganismsByPlasmid = new Map<string, string[]>();
    for (const gmo of gmos) {
      const list = gmoOrganismsByPlasmid.get(gmo.plasmidId);
      if (list) {
        list.push(gmo.organismName);
      } else {
        gmoOrganismsByPlasmid.set(gmo.plasmidId, [gmo.organismName]);
      }
    }

    return plasmids.map((plasmid) => {
      const blocking = new Set<string>();
      const incomplete: string[] = [];

      const plasmidCassettes = cassettesByPlasmid.get(plasmid.id) ?? [];
      for (const content of plasmidCassettes) {
        for (const token of cassetteBaseTokens(content)) {
          if (!featureOrganism.has(token)) {
            blocking.add(`Cassette token not in glossary: ${token}`);
            continue;
          }
          const organism = featureOrganism.get(token) ?? null;
          if (isBlank(organism)) {
            blocking.add(`Feature ${token} has no organism set`);
          } else if (!organismNames.has(organism as string)) {
            blocking.add(`Organism not in glossary: ${organism} (feature ${token})`);
          }
        }
      }

      const plasmidGmoOrganisms = gmoOrganismsByPlasmid.get(plasmid.id) ?? [];
      for (const organismName of plasmidGmoOrganisms) {
        if (!organismNames.has(organismName)) {
          blocking.add(`GMO organism not in glossary: ${organismName}`);
        }
      }

      if (plasmidCassettes.length === 0) {
        incomplete.push('No cassettes — contributes no nucleic acids or donor organisms');
      }
      if (plasmidGmoOrganisms.length === 0) {
        incomplete.push('No GMO records — will not appear in Formblatt-Z');
      }
      if (isBlank(plasmid.backboneVector)) {
        incomplete.push('No original vector (Ausgangsvektor)');
      }

      const blockingReasons = [...blocking];
      const level: ReadinessLevel =
        blockingReasons.length > 0 ? 'blocked' : incomplete.length > 0 ? 'incomplete' : 'ready';

      return {
        plasmidId: plasmid.id,
        level,
        reasons: [...blockingReasons, ...incomplete],
      };
    });
  }
}
