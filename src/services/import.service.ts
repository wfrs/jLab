/**
 * ImportService
 * Cross-instance database import: pulls plasmids (with cassettes, GMOs,
 * attachments, GenBank) plus referenced glossary entries out of a legacy
 * GMOCU v1 SQLite file into the local database.
 *
 * Legacy parity (gmocu.py import_data, L1502-1694):
 * - Only plasmids whose name does not exist locally are importable; the
 *   caller picks a subset (or all) of those candidates.
 * - Cassettes, GMOs and attachments are copied per imported plasmid and
 *   re-linked to the new local ids.
 * - Feature glossary entries referenced by imported cassette tokens and
 *   missing locally are copied from the source; organisms referenced by
 *   those features or by imported GMOs and missing locally are copied too.
 * - Sources without uid columns (pre-0.5 schemas) get fresh uids.
 *
 * Documented deviations (see docs/plans/parity-evidence/db-import.md):
 * - v1 plasmid fields without a v2 column (purpose, summary, clone, marker)
 *   are folded into `description`; alias is dropped (derived from cassettes).
 * - Name matching is case-insensitive (v2 uniqueness invariant); duplicate
 *   names inside the source import once instead of multiple times.
 * - The whole import runs in one transaction (legacy committed piecemeal).
 * - Risk normalization 'None' -> 'No Risk' applies to imported rows only
 *   (legacy rewrote the entire local Features table with substring REPLACE).
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import knex, { Knex } from 'knex';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { cassetteBaseTokens } from '@domain/cassette-tokens';
import { DEFAULT_RISK_GROUP, normalizeRisk, trimmedOrNull } from '@domain/glossary-normalization';
import { DomainError, Plasmid } from '@domain/types';
import { Logger } from '@infrastructure/logger';

const REQUIRED_SOURCE_TABLES = [
  'Plasmids',
  'Cassettes',
  'GMOs',
  'Attachments',
  'Features',
  'Organisms',
] as const;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GENBANK_EXTENSION_PATTERN = /\.(gb|gbk)$/i;
const DEFAULT_APPROVAL = '-';
const DEFAULT_TARGET_RISK_GROUP = 1;

/** Legacy SelectionValues labels -> v2 plasmid status */
const LEGACY_STATUS_TO_V2: Record<string, Plasmid['status']> = {
  Complete: 'validated',
  Abandoned: 'archived',
  'In Progress': 'draft',
  Planned: 'draft',
};

interface LegacyPlasmidRow {
  id: number;
  name: string | null;
  alias: string | null;
  status: number | null;
  purpose: string | null;
  summary: string | null;
  genebank: string | null;
  gb_name: string | null;
  clone: string | null;
  backbone_vector: string | null;
  marker: string | null;
  target_RG: number | null;
  generated: string | null;
  destroyed: string | null;
  date: string | null;
}

interface LegacyCassetteRow {
  cassette_id: number;
  content: string | null;
}

interface LegacyGmoRow {
  organism_name: string | null;
  approval: string | null;
  target_RG: number | string | null;
  date_generated: string | null;
  date_destroyed: string | null;
  entry_date: string | null;
}

interface LegacyAttachmentRow {
  file: Buffer | null;
  Filename: string | null;
}

interface LegacyFeatureRow {
  annotation: string | null;
  alias: string | null;
  risk: string | null;
  organism: string | null;
  uid?: string | null;
}

interface LegacyOrganismRow {
  full_name: string | null;
  short_name: string | null;
  RG: string | number | null;
  uid?: string | null;
}

export interface ImportInspection {
  /** Source plasmid names that do not exist locally (importable) */
  candidates: string[];
  /** Source plasmid names skipped because they already exist locally */
  skippedExisting: string[];
}

export interface ImportResult extends ImportInspection {
  importedPlasmids: string[];
  /** Additional source rows sharing an imported name (legacy allowed dupes) */
  skippedDuplicateNames: string[];
  cassettes: number;
  gmos: number;
  attachments: number;
  genbankFiles: number;
  addedFeatures: string[];
  addedOrganisms: string[];
}

function newUid(): string {
  return randomUUID().replace(/-/g, '');
}

/** Legacy date columns hold YYYY-MM-DD; anything else falls back */
function isoDateOrNull(value: string | null | undefined): string | null {
  const trimmed = trimmedOrNull(value);
  return trimmed && ISO_DATE_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Fold legacy plasmid text fields without a v2 column into description.
 * purpose leads unlabeled (closest legacy analog of description).
 */
function composeDescription(row: LegacyPlasmidRow): string | null {
  const parts: string[] = [];
  const purpose = trimmedOrNull(row.purpose);
  const summary = trimmedOrNull(row.summary);
  const clone = trimmedOrNull(row.clone);
  const marker = trimmedOrNull(row.marker);
  if (purpose) parts.push(purpose);
  if (summary) parts.push(`Cloning summary: ${summary}`);
  if (clone) parts.push(`Clone: ${clone}`);
  if (marker) parts.push(`Marker: ${marker}`);
  return parts.length > 0 ? parts.join('\n') : null;
}

/** Local organism resolution: short OR full name (report.service semantics) */
function organismExists(
  organisms: { fullName: string; shortName: string | null }[],
  name: string
): boolean {
  return organisms.some((o) => o.fullName === name || o.shortName === name);
}

export class ImportService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * List importable plasmid names without writing anything.
   */
  async inspectSource(sourceDb: Buffer): Promise<ImportInspection> {
    return this.withSource(sourceDb, async (source) => {
      const { candidates, skippedExisting } = await this.computeCandidates(source);
      return { candidates, skippedExisting };
    });
  }

  /**
   * Import the selected plasmids (all candidates when `names` is omitted)
   * plus their cassettes, GMOs, attachments, GenBank record and any missing
   * glossary features/organisms they reference. One transaction: either the
   * whole selection lands or nothing does.
   */
  async importFromSource(sourceDb: Buffer, names?: string[]): Promise<ImportResult> {
    return this.withSource(sourceDb, async (source) => {
      const { candidates, skippedExisting, rowsByName } = await this.computeCandidates(source);

      const requested = names === undefined ? candidates : names;
      const requestedSet = new Set(requested);
      const toImport = candidates.filter((name) => requestedSet.has(name));

      const sourceHasSelectionValues = await source.schema.hasTable('SelectionValues');
      const statusLabels = new Map<number, string>();
      if (sourceHasSelectionValues) {
        const rows = (await source('SelectionValues').select('id', 'value')) as {
          id: number;
          value: string | null;
        }[];
        for (const row of rows) {
          if (typeof row.value === 'string') {
            statusLabels.set(row.id, row.value);
          }
        }
      }
      const featuresHaveUid = await source.schema.hasColumn('Features', 'uid');
      const organismsHaveUid = await source.schema.hasColumn('Organisms', 'uid');

      const db = getQueryBuilder();
      const result: ImportResult = {
        candidates,
        skippedExisting,
        importedPlasmids: [],
        skippedDuplicateNames: [],
        cassettes: 0,
        gmos: 0,
        attachments: 0,
        genbankFiles: 0,
        addedFeatures: [],
        addedOrganisms: [],
      };

      if (toImport.length === 0) {
        return result;
      }

      await db.transaction(async (trx) => {
        const now = new Date().toISOString();
        const importedCassetteContents: string[] = [];
        const importedGmoOrganisms = new Set<string>();

        for (const name of toImport) {
          const rows = rowsByName.get(name) || [];
          const [row, ...duplicates] = rows;
          if (!row) {
            continue;
          }
          // Legacy iterated every same-named source row and imported each;
          // v2 enforces unique names, so extras are reported instead.
          result.skippedDuplicateNames.push(...duplicates.map(() => name));

          const plasmidId = randomUUID();
          const legacyDate = isoDateOrNull(row.date);
          const statusLabel = row.status === null ? undefined : statusLabels.get(row.status);
          await trx('plasmids').insert({
            id: plasmidId,
            name,
            description: composeDescription(row),
            sizeBp: null,
            parentId: null,
            backboneVector: trimmedOrNull(row.backbone_vector),
            status: (statusLabel && LEGACY_STATUS_TO_V2[statusLabel]) || 'draft',
            createdAt: legacyDate ? `${legacyDate}T00:00:00.000Z` : now,
            updatedAt: now,
          });
          result.importedPlasmids.push(name);

          const cassettes = (await source('Cassettes')
            .where('plasmid_id', row.id)
            .orderBy('cassette_id', 'asc')
            .select('cassette_id', 'content')) as LegacyCassetteRow[];
          for (let position = 0; position < cassettes.length; position += 1) {
            const content = cassettes[position].content ?? '';
            await trx('cassettes').insert({
              id: randomUUID(),
              plasmidId,
              name: content,
              sequence: null,
              type: 'other',
              position,
              createdAt: now,
              updatedAt: now,
            });
            importedCassetteContents.push(content);
            result.cassettes += 1;
          }

          const gmos = (await source('GMOs')
            .where('plasmid_id', row.id)
            .orderBy('organism_id', 'asc')
            .select(
              'organism_name',
              'approval',
              'target_RG',
              'date_generated',
              'date_destroyed',
              'entry_date'
            )) as LegacyGmoRow[];
          for (const gmo of gmos) {
            const organismName = trimmedOrNull(gmo.organism_name);
            if (!organismName) {
              continue;
            }
            const targetRg = Number(gmo.target_RG);
            const dateGenerated =
              isoDateOrNull(gmo.date_generated) ?? legacyDate ?? now.slice(0, 10);
            await trx('gmos').insert({
              id: randomUUID(),
              plasmidId,
              organismName,
              approval: trimmedOrNull(gmo.approval) ?? DEFAULT_APPROVAL,
              targetRiskGroup:
                Number.isInteger(targetRg) && targetRg >= 1 ? targetRg : DEFAULT_TARGET_RISK_GROUP,
              dateGenerated,
              dateDestroyed: isoDateOrNull(gmo.date_destroyed),
              entryDate: isoDateOrNull(gmo.entry_date) ?? dateGenerated,
              createdAt: now,
              updatedAt: now,
            });
            importedGmoOrganisms.add(organismName);
            result.gmos += 1;
          }

          const attachments = (await source('Attachments')
            .where('plasmid_id', row.id)
            .orderBy('attach_id', 'asc')
            .select('file', 'Filename')) as LegacyAttachmentRow[];
          for (const attachment of attachments) {
            if (!attachment.file) {
              continue;
            }
            const data = Buffer.from(attachment.file);
            await trx('attachments').insert({
              id: randomUUID(),
              plasmidId,
              filename: trimmedOrNull(attachment.Filename) ?? 'attachment.bin',
              mimeType: 'application/octet-stream',
              sizeBytes: data.length,
              data,
              createdAt: now,
              updatedAt: now,
            });
            result.attachments += 1;
          }

          // Legacy stored GenBank inline (Plasmids.genebank/gb_name);
          // v2 normalizes it into genbank_files.
          const genbankContent = row.genebank && row.genebank.length > 0 ? row.genebank : null;
          if (genbankContent) {
            const rawName = trimmedOrNull(row.gb_name) ?? `${name}.gb`;
            const filename = GENBANK_EXTENSION_PATTERN.test(rawName) ? rawName : `${rawName}.gb`;
            await trx('genbank_files').insert({
              plasmidId,
              filename,
              content: genbankContent,
              createdAt: now,
              updatedAt: now,
            });
            result.genbankFiles += 1;
          }
        }

        await this.importMissingGlossary(trx, source, {
          now,
          importedCassetteContents,
          importedGmoOrganisms,
          featuresHaveUid,
          organismsHaveUid,
          result,
        });
      });

      this.logger.info('ImportService.importFromSource succeeded', {
        importedPlasmids: result.importedPlasmids.length,
        cassettes: result.cassettes,
        gmos: result.gmos,
        attachments: result.attachments,
        genbankFiles: result.genbankFiles,
        addedFeatures: result.addedFeatures.length,
        addedOrganisms: result.addedOrganisms.length,
      });

      return result;
    });
  }

  /**
   * Glossary backfill (legacy import_data L1619-1685): features referenced
   * by imported cassette tokens, then organisms referenced by those features
   * or by imported GMOs. Only entries missing locally are copied.
   */
  private async importMissingGlossary(
    trx: Knex.Transaction,
    source: Knex,
    context: {
      now: string;
      importedCassetteContents: string[];
      importedGmoOrganisms: Set<string>;
      featuresHaveUid: boolean;
      organismsHaveUid: boolean;
      result: ImportResult;
    }
  ): Promise<void> {
    const { now, result } = context;

    const localAnnotations = new Set(
      ((await trx('glossary_features').select('annotation')) as { annotation: string }[]).map(
        (row) => row.annotation
      )
    );

    const tokens = new Set<string>();
    for (const content of context.importedCassetteContents) {
      for (const token of cassetteBaseTokens(content)) {
        tokens.add(token);
      }
    }

    // Organisms referenced by the features we import (legacy pulled the
    // organism column of the just-imported Features rows)
    const organismNames = new Set<string>(context.importedGmoOrganisms);

    for (const token of tokens) {
      if (localAnnotations.has(token)) {
        continue;
      }
      const featureRow = (await source('Features').where('annotation', token).first()) as
        LegacyFeatureRow | undefined;
      if (!featureRow) {
        // Legacy inserted nothing for tokens absent from the source glossary
        continue;
      }
      const uid = context.featuresHaveUid ? trimmedOrNull(featureRow.uid ?? null) : null;
      await trx('glossary_features').insert({
        id: randomUUID(),
        annotation: token,
        alias: trimmedOrNull(featureRow.alias),
        risk: normalizeRisk(featureRow.risk),
        organism: trimmedOrNull(featureRow.organism),
        uid: uid ?? newUid(),
        synced: false,
        createdAt: now,
        updatedAt: now,
      });
      localAnnotations.add(token);
      result.addedFeatures.push(token);
      const featureOrganism = trimmedOrNull(featureRow.organism);
      if (featureOrganism) {
        organismNames.add(featureOrganism);
      }
    }

    const localOrganisms = (await trx('organisms').select('fullName', 'shortName')) as {
      fullName: string;
      shortName: string | null;
    }[];

    for (const organismName of organismNames) {
      if (organismExists(localOrganisms, organismName)) {
        continue;
      }
      // Legacy matched source organisms by short_name; fall back to
      // full_name because v1 GMOs sometimes store either
      const organismRow = ((await source('Organisms').where('short_name', organismName).first()) ??
        (await source('Organisms').where('full_name', organismName).first())) as
        LegacyOrganismRow | undefined;
      if (!organismRow) {
        continue;
      }
      const fullName =
        trimmedOrNull(organismRow.full_name) ?? trimmedOrNull(organismRow.short_name);
      if (!fullName || organismExists(localOrganisms, fullName)) {
        continue;
      }
      const uid = context.organismsHaveUid ? trimmedOrNull(organismRow.uid ?? null) : null;
      const shortName = trimmedOrNull(organismRow.short_name);
      await trx('organisms').insert({
        id: randomUUID(),
        fullName,
        shortName,
        riskGroup: trimmedOrNull(String(organismRow.RG ?? '')) ?? DEFAULT_RISK_GROUP,
        uid: uid ?? newUid(),
        synced: false,
        createdAt: now,
        updatedAt: now,
      });
      localOrganisms.push({ fullName, shortName });
      result.addedOrganisms.push(fullName);
    }
  }

  /**
   * Candidates: source plasmid names not present locally (case-insensitive,
   * per v2 name uniqueness), in source order, deduplicated. Also returns the
   * source rows grouped by name for the import pass.
   */
  private async computeCandidates(source: Knex): Promise<
    ImportInspection & {
      rowsByName: Map<string, LegacyPlasmidRow[]>;
    }
  > {
    const db = getQueryBuilder();
    const localNames = new Set(
      ((await db('plasmids').select('name')) as { name: string }[]).map((row) =>
        row.name.toLowerCase()
      )
    );

    const sourceRows = (await source('Plasmids')
      .orderBy('id', 'asc')
      .select('*')) as LegacyPlasmidRow[];

    const candidates: string[] = [];
    const skippedExisting: string[] = [];
    const rowsByName = new Map<string, LegacyPlasmidRow[]>();

    for (const row of sourceRows) {
      const name = trimmedOrNull(row.name);
      if (!name) {
        continue;
      }
      if (localNames.has(name.toLowerCase())) {
        if (!skippedExisting.includes(name)) {
          skippedExisting.push(name);
        }
        continue;
      }
      const existing = rowsByName.get(name);
      if (existing) {
        existing.push(row);
      } else {
        rowsByName.set(name, [row]);
        candidates.push(name);
      }
    }

    return { candidates, skippedExisting, rowsByName };
  }

  /**
   * Write the uploaded bytes to a temp file, open it with a dedicated knex
   * connection, validate it is a GMOCU v1 database, run `fn`, then always
   * close the connection and remove the temp file.
   */
  private async withSource<T>(sourceDb: Buffer, fn: (source: Knex) => Promise<T>): Promise<T> {
    if (!Buffer.isBuffer(sourceDb) || sourceDb.length === 0) {
      throw new DomainError('VALIDATION', 'Uploaded database file is empty');
    }

    const tempPath = path.join(os.tmpdir(), `gmocu-import-${randomUUID()}.db`);
    await fs.writeFile(tempPath, sourceDb);

    const noop = (): void => undefined;
    const source = knex({
      client: 'sqlite3',
      connection: { filename: tempPath },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
      // Pool teardown on invalid files logs spurious "connection aborted"
      // warnings; failures surface as thrown errors instead
      log: { warn: noop, error: noop, deprecate: noop, debug: noop },
    });

    try {
      await this.assertGmocuV1Database(source);
      return await fn(source);
    } finally {
      await source.destroy().catch(() => undefined);
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  private async assertGmocuV1Database(source: Knex): Promise<void> {
    let missing: string[];
    try {
      const checks = await Promise.all(
        REQUIRED_SOURCE_TABLES.map((table) => source.schema.hasTable(table))
      );
      missing = REQUIRED_SOURCE_TABLES.filter((_, index) => !checks[index]);
    } catch (error) {
      this.logger.warn('ImportService: uploaded file is not a SQLite database', {
        cause: error instanceof Error ? error.message : String(error),
      });
      throw new DomainError('VALIDATION', 'Uploaded file is not a valid SQLite database');
    }

    if (missing.length > 0) {
      throw new DomainError(
        'VALIDATION',
        `Uploaded file is not a GMOCU v1 database (missing tables: ${missing.join(', ')})`,
        { missingTables: missing }
      );
    }
  }
}
