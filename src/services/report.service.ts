/**
 * ReportService
 * Assembles regulatory report data (legacy GMOCU Formblatt Z + plasmid list).
 *
 * Legacy parity (gmocu.py generate_formblatt / check_features / check_organisms):
 * - One Formblatt-Z row per GMO record.
 * - Donor organisms/risks come from the glossary entries of the plasmid's
 *   cassette tokens; recipient comes from the GMO's organism.
 * - Generation is gated on glossary integrity: every used cassette token must
 *   resolve, and every referenced organism must exist in the organism glossary.
 */

import { DomainError, GlossaryFeature, Organism } from '@domain/types';
import { cassetteBaseTokens } from '@domain/cassette-tokens';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

/** Legacy prints 'None' when a used feature has no risk entry */
const EMPTY_RISK_LABEL = 'None';
/** Separator legacy uses to join multi-value cells */
const CELL_JOIN = '|';

export interface GlossaryIntegrityResult {
  ok: boolean;
  /** "plasmidName: token" for cassette tokens missing from the feature glossary */
  missingFeatures: string[];
  /** "annotation: organism" / "GMO: organism" for unresolvable organisms */
  missingOrganisms: string[];
}

export interface FormblattZRow {
  no: string;
  donor: string;
  donorRg: string;
  recipient: string;
  recipientRg: string;
  vector: string;
  dna: string;
  dnaRisk: string;
  gmoName: string;
  gmoRg: string;
  gmoApproval: string;
  dateGenerated: string;
  dateDestroyed: string;
  entryDate: string;
}

export interface PlasmidListRow {
  no: number;
  name: string;
  description: string;
  backboneVector: string;
  sizeBp: string;
  status: string;
  entryDate: string;
}

interface CassetteRecord {
  name: string;
  plasmidId: string;
}

interface GmoRecord {
  id: string;
  plasmidId: string;
  organismName: string;
  approval: string;
  targetRiskGroup: number;
  dateGenerated: string;
  dateDestroyed: string | null;
  entryDate: string;
}

interface PlasmidRecord {
  id: string;
  name: string;
  description: string | null;
  sizeBp: number | null;
  backboneVector: string | null;
  status: string;
  createdAt: string;
}

/** Organism lookup by short OR full name (legacy links features by short name) */
function findOrganism(organisms: Organism[], name: string): Organism | undefined {
  return organisms.find((o) => o.shortName === name || o.fullName === name);
}

export class ReportService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Glossary integrity gate (legacy check_features + check_organisms):
   * - every cassette token must exist in the feature glossary
   * - every glossary feature's organism must resolve in the organism glossary
   * - every GMO's organism must resolve in the organism glossary
   */
  async checkGlossaryIntegrity(): Promise<GlossaryIntegrityResult> {
    this.logger.info('ReportService.checkGlossaryIntegrity');

    const db = getQueryBuilder();
    const [features, organisms, cassettes, gmos, plasmids] = await Promise.all([
      db('glossary_features').select('annotation', 'organism') as Promise<GlossaryFeature[]>,
      db('organisms').select('*') as Promise<Organism[]>,
      db('cassettes').select('name', 'plasmidId') as Promise<CassetteRecord[]>,
      db('gmos').select('organismName') as Promise<Pick<GmoRecord, 'organismName'>[]>,
      db('plasmids').select('id', 'name') as Promise<Pick<PlasmidRecord, 'id' | 'name'>[]>,
    ]);

    const annotationSet = new Set(features.map((f) => f.annotation));
    const plasmidNames = new Map(plasmids.map((p) => [p.id, p.name]));

    const missingFeatures: string[] = [];
    for (const cassette of cassettes) {
      const plasmidName = plasmidNames.get(cassette.plasmidId) || cassette.plasmidId;
      for (const token of cassetteBaseTokens(cassette.name)) {
        if (!annotationSet.has(token)) {
          missingFeatures.push(`${plasmidName}: ${token}`);
        }
      }
    }

    const missingOrganisms: string[] = [];
    for (const feature of features) {
      if (!feature.organism || feature.organism.trim() === '') {
        missingOrganisms.push(`${feature.annotation}: (no organism set)`);
      } else if (!findOrganism(organisms, feature.organism)) {
        missingOrganisms.push(`${feature.annotation}: ${feature.organism}`);
      }
    }
    for (const gmo of gmos) {
      if (!findOrganism(organisms, gmo.organismName)) {
        missingOrganisms.push(`GMO: ${gmo.organismName}`);
      }
    }

    return {
      ok: missingFeatures.length === 0 && missingOrganisms.length === 0,
      missingFeatures,
      missingOrganisms,
    };
  }

  /**
   * Build Formblatt-Z rows — one per GMO (legacy generate_formblatt).
   * Throws a VALIDATION DomainError with the missing lists when the
   * glossary integrity gate fails.
   */
  async buildFormblattZRows(): Promise<FormblattZRow[]> {
    this.logger.info('ReportService.buildFormblattZRows');

    const integrity = await this.checkGlossaryIntegrity();
    if (!integrity.ok) {
      throw new DomainError('VALIDATION', 'Glossary integrity check failed', {
        missingFeatures: integrity.missingFeatures,
        missingOrganisms: integrity.missingOrganisms,
      });
    }

    const db = getQueryBuilder();
    const [gmos, features, organisms, cassettes, plasmids] = await Promise.all([
      db('gmos').select('*').orderBy('createdAt', 'asc') as Promise<GmoRecord[]>,
      db('glossary_features').select('*') as Promise<GlossaryFeature[]>,
      db('organisms').select('*') as Promise<Organism[]>,
      db('cassettes').select('name', 'plasmidId') as Promise<CassetteRecord[]>,
      db('plasmids').select('*') as Promise<PlasmidRecord[]>,
    ]);

    const featureByAnnotation = new Map(features.map((f) => [f.annotation, f]));
    const plasmidById = new Map(plasmids.map((p) => [p.id, p]));

    return gmos.map((gmo, index) => {
      const plasmid = plasmidById.get(gmo.plasmidId);
      const plasmidName = plasmid?.name || gmo.plasmidId;

      // All tokens used across the plasmid's cassettes (legacy joins all)
      const usedTokens = cassettes
        .filter((c) => c.plasmidId === gmo.plasmidId)
        .flatMap((c) => cassetteBaseTokens(c.name));

      const donorOrganisms = usedTokens.map(
        (token) => featureByAnnotation.get(token)?.organism || ''
      );
      const donorRgs = donorOrganisms.map((name) => findOrganism(organisms, name)?.riskGroup || '');
      const risks = usedTokens.map((token) => {
        const risk = featureByAnnotation.get(token)?.risk;
        return risk && risk.trim() !== '' ? risk : EMPTY_RISK_LABEL;
      });

      const recipient = findOrganism(organisms, gmo.organismName);
      // Legacy composes "shortname-plasmid" (organism_name was the short name)
      const gmoNamePart = recipient?.shortName || gmo.organismName;

      return {
        no: String(index + 1),
        donor: donorOrganisms.join(CELL_JOIN),
        donorRg: donorRgs.join(CELL_JOIN),
        recipient: recipient?.fullName || gmo.organismName,
        recipientRg: recipient?.riskGroup || '',
        vector: plasmid?.backboneVector || '',
        dna: usedTokens.join(CELL_JOIN),
        dnaRisk: risks.join(CELL_JOIN),
        gmoName: `${gmoNamePart}-${plasmidName}`,
        gmoRg: String(gmo.targetRiskGroup),
        gmoApproval: gmo.approval,
        dateGenerated: gmo.dateGenerated,
        dateDestroyed: gmo.dateDestroyed || '',
        // Legacy reused dateGenerated here with a TODO; v2 uses the real entry date
        entryDate: gmo.entryDate,
      };
    });
  }

  /**
   * Build plasmid list rows (legacy generate_plasmidlist, v2 field set)
   */
  async buildPlasmidListRows(): Promise<PlasmidListRow[]> {
    this.logger.info('ReportService.buildPlasmidListRows');

    const db = getQueryBuilder();
    const plasmids = (await db('plasmids').select('*').orderBy('name', 'asc')) as PlasmidRecord[];

    return plasmids.map((plasmid, index) => ({
      no: index + 1,
      name: plasmid.name,
      description: plasmid.description || '',
      backboneVector: plasmid.backboneVector || '',
      sizeBp: plasmid.sizeBp ? String(plasmid.sizeBp) : '',
      status: plasmid.status,
      entryDate: String(plasmid.createdAt).slice(0, 10),
    }));
  }
}
