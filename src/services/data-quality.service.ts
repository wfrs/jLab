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

interface PlasmidRow {
  id: string;
  name: string;
  backboneVector: string | null;
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
    const [integrity, plasmids, cassettes, features, organisms, gmoOrganisms] = await Promise.all([
      this.reportService.checkGlossaryIntegrity(),
      db('plasmids').select('id', 'name', 'backboneVector') as Promise<PlasmidRow[]>,
      db('cassettes').select('name', 'plasmidId') as Promise<CassetteRow[]>,
      db('glossary_features').select('*') as Promise<GlossaryFeature[]>,
      db('organisms').select('*') as Promise<Organism[]>,
      db('gmos').select('plasmidId', 'organismName') as Promise<
        { plasmidId: string; organismName: string }[]
      >,
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
}
