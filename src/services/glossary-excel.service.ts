/**
 * GlossaryExcelService
 * Imports and exports glossary entries as the legacy Excel templates.
 *
 * Legacy parity (gmocu.py add_to_features L721, add_to_organisms L741,
 * invoked from -ADDFEATURESEXCEL- L2412 and -ADDEXCELORGA- L2442):
 * - Feature annotations are normalized on the way in ('-'->'_', '['->'(',
 *   ']'->')', ' '->'_').
 * - Rows whose key already exists locally are skipped and reported, never
 *   overwritten — "We will only add new entries which not exist yet".
 * - Blank risk becomes 'No Risk' (legacy filled blanks with 'None', then
 *   rewrote 'None' to 'No Risk').
 *
 * Deliberate deviations (see docs/plans/parity-evidence/glossary-excel-import.md):
 * - Sheets are located by name ('features' / 'organisms') with a header
 *   sniff as fallback; legacy always read sheet index 0, which made the
 *   two-sheet template unusable for importing organisms.
 * - Rows duplicated *within the file* are skipped and reported; legacy
 *   deduplicated only against the database and would insert both copies.
 * - Organisms are matched on full name AND short name (jlab makes full name
 *   unique); legacy compared short names only.
 */

import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { cassetteBaseTokens, normalizeAnnotation } from '@domain/cassette-tokens';
import { DEFAULT_RISK_GROUP, normalizeRisk, trimmedOrNull } from '@domain/glossary-normalization';
import { DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { buildGlossaryWorkbook } from './report-workbook';

/** Header cells that identify a sheet when its name is not conclusive */
const FEATURE_HEADER = 'annotation';
const ORGANISM_HEADER = 'full_name';

export interface RenamedAnnotation {
  from: string;
  to: string;
}

/** 'all' exports every entry; 'used' only those a record references */
export type ExportScope = 'all' | 'used';

interface FeatureRow {
  annotation: string;
  alias: string | null;
  risk: string;
  organism: string | null;
  uid: string;
}

interface OrganismRow {
  fullName: string;
  shortName: string | null;
  riskGroup: string;
  uid: string;
}

export interface GlossaryImportSection {
  /** Keys added to the glossary */
  added: string[];
  /** Present locally already — reported, never overwritten */
  skippedExisting: string[];
  /** Repeated within the uploaded file itself */
  skippedDuplicateInFile: string[];
  /** Rows dropped because the key cell was empty */
  skippedBlank: number;
}

export interface GlossaryImportResult {
  sheetsRead: string[];
  features: GlossaryImportSection;
  organisms: GlossaryImportSection;
  /** Annotations rewritten by normalization, so the user can see it happened */
  normalizedAnnotations: RenamedAnnotation[];
  /**
   * Organisms referenced by imported features that resolve nowhere after the
   * import — the same condition the data-quality gate reports.
   */
  unresolvedFeatureOrganisms: string[];
}

function emptySection(): GlossaryImportSection {
  return { added: [], skippedExisting: [], skippedDuplicateInFile: [], skippedBlank: 0 };
}

/** Cell text for string columns; ExcelJS returns objects for rich text/formulas */
function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return trimmedOrNull(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const rich = value as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (Array.isArray(rich.richText)) {
      return trimmedOrNull(rich.richText.map((part) => part.text).join(''));
    }
    if (typeof rich.text === 'string') {
      return trimmedOrNull(rich.text);
    }
    if (typeof rich.result === 'string' || typeof rich.result === 'number') {
      return trimmedOrNull(String(rich.result));
    }
  }
  return null;
}

/**
 * Header spellings accepted for the same column. The template files use
 * machine names; jlab's own exports use the legacy display headers
 * ("Full name", "Risk group"), so both must round-trip.
 */
const HEADER_ALIASES: Record<string, string> = {
  full_name: 'full_name',
  'full name': 'full_name',
  short_name: 'short_name',
  'short name': 'short_name',
  rg: 'rg',
  risk_group: 'rg',
  'risk group': 'rg',
  annotation: 'annotation',
  alias: 'alias',
  risk: 'risk',
  organism: 'organism',
  uid: 'uid',
};

/** Maps canonical header key -> column number for one worksheet's first row */
function headerIndex(sheet: ExcelJS.Worksheet): Map<string, number> {
  const index = new Map<string, number>();
  const header = sheet.getRow(1);
  header.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const label = cellText(cell.value);
    if (!label) {
      return;
    }
    const canonical = HEADER_ALIASES[label.toLowerCase()];
    if (canonical && !index.has(canonical)) {
      index.set(canonical, columnNumber);
    }
  });
  return index;
}

export class GlossaryExcelService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Import features and/or organisms from a workbook. Whichever sheets are
   * present are imported; a workbook with neither is rejected.
   */
  async importWorkbook(data: Buffer): Promise<GlossaryImportResult> {
    this.logger.info('GlossaryExcelService.importWorkbook', { sizeBytes: data.length });

    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new DomainError('VALIDATION', 'Uploaded workbook is empty');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(data as unknown as ArrayBuffer);
    } catch (error) {
      this.logger.warn('GlossaryExcelService: workbook could not be parsed', {
        cause: error instanceof Error ? error.message : String(error),
      });
      throw new DomainError('VALIDATION', 'Uploaded file is not a readable .xlsx workbook');
    }

    const featureSheet = this.locateSheet(workbook, 'features', FEATURE_HEADER);
    const organismSheet = this.locateSheet(workbook, 'organisms', ORGANISM_HEADER);

    if (!featureSheet && !organismSheet) {
      throw new DomainError(
        'VALIDATION',
        'No glossary sheet found. Expected a sheet named "features" (column "annotation") or "organisms" (column "full_name").'
      );
    }

    const result: GlossaryImportResult = {
      sheetsRead: [],
      features: emptySection(),
      organisms: emptySection(),
      normalizedAnnotations: [],
      unresolvedFeatureOrganisms: [],
    };

    const db = getQueryBuilder();
    // Organisms first: features reference them, so importing in this order
    // means a single upload of the two-sheet template resolves cleanly
    await db.transaction(async (trx) => {
      if (organismSheet) {
        result.sheetsRead.push(organismSheet.name);
        await this.importOrganisms(trx, organismSheet, result);
      }
      if (featureSheet) {
        result.sheetsRead.push(featureSheet.name);
        await this.importFeatures(trx, featureSheet, result);
      }

      // Report features whose organism still resolves nowhere
      const organisms = (await trx('organisms').select('fullName', 'shortName')) as {
        fullName: string;
        shortName: string | null;
      }[];
      const known = new Set<string>();
      for (const organism of organisms) {
        known.add(organism.fullName);
        if (organism.shortName) {
          known.add(organism.shortName);
        }
      }
      const addedFeatures = new Set(result.features.added);
      const imported = (await trx('glossary_features').select('annotation', 'organism')) as {
        annotation: string;
        organism: string | null;
      }[];
      const unresolved = new Set<string>();
      for (const feature of imported) {
        if (!addedFeatures.has(feature.annotation)) continue;
        if (feature.organism && !known.has(feature.organism)) {
          unresolved.add(feature.organism);
        }
      }
      result.unresolvedFeatureOrganisms = [...unresolved];
    });

    this.logger.info('GlossaryExcelService.importWorkbook completed', {
      sheetsRead: result.sheetsRead,
      featuresAdded: result.features.added.length,
      organismsAdded: result.organisms.added.length,
    });

    return result;
  }

  /**
   * Find a sheet by name, else the first sheet whose header row carries the
   * identifying column (legacy read sheet 0 unconditionally).
   */
  private locateSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    identifyingHeader: string
  ): ExcelJS.Worksheet | undefined {
    const byName = workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === name);
    if (byName) {
      return byName;
    }
    return workbook.worksheets.find((sheet) => headerIndex(sheet).has(identifyingHeader));
  }

  private async importOrganisms(
    trx: import('knex').Knex.Transaction,
    sheet: ExcelJS.Worksheet,
    result: GlossaryImportResult
  ): Promise<void> {
    const columns = headerIndex(sheet);
    const fullNameCol = columns.get('full_name');
    if (!fullNameCol) {
      throw new DomainError('VALIDATION', `Sheet "${sheet.name}" has no "full_name" column`);
    }
    const shortNameCol = columns.get('short_name');
    const rgCol = columns.get('rg');

    const existing = (await trx('organisms').select('fullName', 'shortName')) as {
      fullName: string;
      shortName: string | null;
    }[];
    const takenFullNames = new Set(existing.map((o) => o.fullName));
    const takenShortNames = new Set(
      existing.map((o) => o.shortName).filter((s): s is string => !!s)
    );
    const seenInFile = new Set<string>();
    const now = new Date().toISOString();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const fullName = cellText(row.getCell(fullNameCol).value);
      if (!fullName) {
        // Blank key cell — skip silently unless the row had other content
        if (row.actualCellCount > 0) {
          result.organisms.skippedBlank += 1;
        }
        continue;
      }
      const shortName = shortNameCol ? cellText(row.getCell(shortNameCol).value) : null;

      if (seenInFile.has(fullName) || (shortName && seenInFile.has(shortName))) {
        result.organisms.skippedDuplicateInFile.push(fullName);
        continue;
      }
      if (takenFullNames.has(fullName) || (shortName && takenShortNames.has(shortName))) {
        result.organisms.skippedExisting.push(fullName);
        seenInFile.add(fullName);
        continue;
      }

      await trx('organisms').insert({
        id: randomUUID(),
        fullName,
        shortName,
        riskGroup: (rgCol ? cellText(row.getCell(rgCol).value) : null) ?? DEFAULT_RISK_GROUP,
        uid: randomUUID().replace(/-/g, ''),
        synced: false,
        createdAt: now,
        updatedAt: now,
      });

      seenInFile.add(fullName);
      if (shortName) seenInFile.add(shortName);
      result.organisms.added.push(fullName);
    }
  }

  private async importFeatures(
    trx: import('knex').Knex.Transaction,
    sheet: ExcelJS.Worksheet,
    result: GlossaryImportResult
  ): Promise<void> {
    const columns = headerIndex(sheet);
    const annotationCol = columns.get('annotation');
    if (!annotationCol) {
      throw new DomainError('VALIDATION', `Sheet "${sheet.name}" has no "annotation" column`);
    }
    const aliasCol = columns.get('alias');
    const riskCol = columns.get('risk');
    const organismCol = columns.get('organism');

    const existing = (await trx('glossary_features').select('annotation')) as {
      annotation: string;
    }[];
    const taken = new Set(existing.map((f) => f.annotation));
    const seenInFile = new Set<string>();
    const now = new Date().toISOString();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const raw = cellText(row.getCell(annotationCol).value);
      if (!raw) {
        if (row.actualCellCount > 0) {
          result.features.skippedBlank += 1;
        }
        continue;
      }

      // Legacy normalizes on import; without it a token like "PEST-2" would
      // split into two cassette tokens and never resolve
      const annotation = normalizeAnnotation(raw);
      if (annotation.length === 0) {
        result.features.skippedBlank += 1;
        continue;
      }
      if (annotation !== raw) {
        result.normalizedAnnotations.push({ from: raw, to: annotation });
      }

      if (seenInFile.has(annotation)) {
        result.features.skippedDuplicateInFile.push(annotation);
        continue;
      }
      if (taken.has(annotation)) {
        result.features.skippedExisting.push(annotation);
        seenInFile.add(annotation);
        continue;
      }

      await trx('glossary_features').insert({
        id: randomUUID(),
        annotation,
        alias: aliasCol ? cellText(row.getCell(aliasCol).value) : null,
        risk: normalizeRisk(riskCol ? cellText(row.getCell(riskCol).value) : null),
        organism: organismCol ? cellText(row.getCell(organismCol).value) : null,
        uid: randomUUID().replace(/-/g, ''),
        synced: false,
        createdAt: now,
        updatedAt: now,
      });

      seenInFile.add(annotation);
      result.features.added.push(annotation);
    }
  }

  /**
   * Export the feature glossary.
   *
   * Legacy parity (gmocu.py -ALLEXCEL- L2285 / -USEDEXCEL- L2295): 'all'
   * exports every entry, 'used' only the annotations a cassette references.
   * Legacy derived its used list with `'-'.join(contents).split('-')`, which
   * leaves `[variant]` brackets attached so `pLac[v2]` never matched; jlab
   * uses cassetteBaseTokens(), the tokenizer the app resolves with.
   */
  async exportFeatures(scope: ExportScope, initials = ''): Promise<Buffer> {
    this.logger.info('GlossaryExcelService.exportFeatures', { scope });

    const db = getQueryBuilder();
    const features = (await db('glossary_features')
      .select('annotation', 'alias', 'risk', 'organism', 'uid')
      .orderBy('annotation', 'asc')) as FeatureRow[];

    let selected = features;
    if (scope === 'used') {
      const used = await this.usedTokens();
      selected = features.filter((feature) => used.has(feature.annotation));
    }

    return buildGlossaryWorkbook(
      'features',
      selected.map((f) => [f.annotation, f.alias ?? '', f.risk, f.organism ?? '', f.uid]),
      `${initials ? initials + ' ' : ''}List of ${scope} nucleic acid features`
    );
  }

  /**
   * Export the organism glossary.
   *
   * Legacy parity (-ALLEXCELORGA- L2290 / -USEDEXCELORGA- L2342): 'used'
   * means referenced by a used feature or by a GMO record. jlab resolves an
   * organism by short OR full name, as the reports do; legacy matched short
   * names only.
   */
  async exportOrganisms(scope: ExportScope, initials = ''): Promise<Buffer> {
    this.logger.info('GlossaryExcelService.exportOrganisms', { scope });

    const db = getQueryBuilder();
    const organisms = (await db('organisms')
      .select('fullName', 'shortName', 'riskGroup', 'uid')
      .orderBy('fullName', 'asc')) as OrganismRow[];

    let selected = organisms;
    if (scope === 'used') {
      const used = await this.usedTokens();
      const [features, gmos] = await Promise.all([
        db('glossary_features').select('annotation', 'organism') as Promise<
          { annotation: string; organism: string | null }[]
        >,
        db('gmos').select('organismName') as Promise<{ organismName: string }[]>,
      ]);

      const referenced = new Set<string>();
      for (const feature of features) {
        if (used.has(feature.annotation) && feature.organism) {
          referenced.add(feature.organism);
        }
      }
      for (const gmo of gmos) {
        if (gmo.organismName) {
          referenced.add(gmo.organismName);
        }
      }

      selected = organisms.filter(
        (organism) =>
          referenced.has(organism.fullName) ||
          (organism.shortName !== null && referenced.has(organism.shortName))
      );
    }

    return buildGlossaryWorkbook(
      'organisms',
      selected.map((o) => [o.fullName, o.shortName ?? '', o.riskGroup, o.uid]),
      `${initials ? initials + ' ' : ''}List of ${scope} organisms`
    );
  }

  /** Base tokens referenced by any cassette (variants stripped) */
  private async usedTokens(): Promise<Set<string>> {
    const cassettes = (await getQueryBuilder()('cassettes').select('name')) as { name: string }[];
    const tokens = new Set<string>();
    for (const cassette of cassettes) {
      for (const token of cassetteBaseTokens(cassette.name)) {
        tokens.add(token);
      }
    }
    return tokens;
  }
}
