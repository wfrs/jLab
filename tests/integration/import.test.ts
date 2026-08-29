/**
 * Integration Tests: GMOCU v1 Database Import (service and API route)
 * Legacy parity (gmocu.py import_data L1502-1694): candidates are source
 * plasmids whose name is new locally; selected ones import with cassettes,
 * GMOs, attachments and GenBank; missing glossary features/organisms they
 * reference are copied along.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import knex, { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { ImportService } from '@services/import.service';
import { PlasmidService } from '@services/plasmid.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { DomainError } from '@domain/types';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type ImportRoute = typeof import('@app/api/import/route');

let importRoute: ImportRoute;
let importService: ImportService;
let plasmidService: PlasmidService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;

const GB_CONTENT = 'LOCUS       pImp001                 4200 bp    DNA     circular\nORIGIN\n//\n';
const ATTACHMENT_BYTES = Buffer.from([0, 1, 2, 253, 254, 255]);

interface LegacyFixtureOptions {
  /** Pre-0.5 sources have no uid/synced columns on Features/Organisms */
  withUid?: boolean;
}

/** Builds a legacy GMOCU v1 SQLite file and returns its bytes */
async function buildLegacySourceDb(options: LegacyFixtureOptions = {}): Promise<Buffer> {
  const withUid = options.withUid ?? true;
  const filePath = path.join(os.tmpdir(), `gmocu-fixture-${randomUUID()}.db`);
  const source = knex({
    client: 'sqlite3',
    connection: { filename: filePath },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });

  try {
    await source.schema.createTable('Plasmids', (table) => {
      table.increments('id');
      table.text('name');
      table.text('alias');
      table.integer('status');
      table.text('gb');
      table.text('purpose');
      table.text('summary');
      table.text('genebank');
      table.text('gb_name');
      table.integer('FKattachment');
      table.text('clone');
      table.text('backbone_vector');
      table.text('marker');
      table.integer('organism_selector');
      table.integer('target_RG');
      table.text('generated');
      table.text('destroyed');
      table.text('date');
    });
    await source.schema.createTable('SelectionValues', (table) => {
      table.increments('id');
      table.text('value');
    });
    await source.schema.createTable('Cassettes', (table) => {
      table.increments('cassette_id');
      table.text('content');
      table.integer('plasmid_id');
    });
    await source.schema.createTable('GMOs', (table) => {
      table.increments('organism_id');
      table.text('GMO_summary');
      table.text('organism_name');
      table.text('approval');
      table.integer('plasmid_id');
      table.integer('target_RG');
      table.text('date_generated');
      table.text('date_destroyed');
      table.text('entry_date');
    });
    await source.schema.createTable('Attachments', (table) => {
      table.binary('file');
      table.text('Filename');
      table.increments('attach_id');
      table.integer('plasmid_id');
    });
    await source.schema.createTable('Features', (table) => {
      table.increments('id');
      table.text('annotation');
      table.text('alias');
      table.text('risk');
      table.text('organism');
      if (withUid) {
        table.text('uid');
        table.integer('synced');
      }
    });
    await source.schema.createTable('Organisms', (table) => {
      table.increments('id');
      table.text('full_name');
      table.text('short_name');
      table.text('RG');
      if (withUid) {
        table.text('uid');
        table.integer('synced');
      }
    });

    await source('SelectionValues').insert([
      { id: 1, value: 'Complete' },
      { id: 2, value: 'In Progress' },
      { id: 3, value: 'Abandoned' },
      { id: 4, value: 'Planned' },
    ]);

    await source('Plasmids').insert([
      {
        id: 1,
        name: 'pImp001',
        alias: 'pLac-GFP-T7term',
        status: 1,
        purpose: 'Expression test',
        summary: 'Assembled via Gibson',
        genebank: GB_CONTENT,
        gb_name: 'pImp001.gb',
        clone: 'c3',
        backbone_vector: 'pUC19',
        marker: 'AmpR',
        target_RG: 1,
        generated: '2023-05-10',
        destroyed: '',
        date: '2023-05-10',
      },
      {
        id: 2,
        name: 'pImp002',
        status: 4,
        purpose: '',
        date: 'not-a-date',
      },
      // Legacy allowed duplicate names inside one database
      { id: 3, name: 'pImp001', status: 2, purpose: 'duplicate row', date: '2023-06-01' },
      // Exists locally in the tests below
      { id: 4, name: 'pExisting', status: 1, date: '2023-01-01' },
    ]);

    await source('Cassettes').insert([
      { cassette_id: 1, content: 'pLac-GFP[v2]-T7term', plasmid_id: 1 },
      { cassette_id: 2, content: 'AmpR', plasmid_id: 1 },
      { cassette_id: 3, content: 'GFP', plasmid_id: 2 },
      { cassette_id: 4, content: 'unrelated', plasmid_id: 4 },
    ]);

    await source('GMOs').insert([
      {
        organism_id: 1,
        GMO_summary: 'RG 1   |   Approval: App-1',
        organism_name: 'E. coli',
        approval: 'App-1',
        plasmid_id: 1,
        target_RG: 1,
        date_generated: '2023-05-11',
        date_destroyed: '',
        entry_date: null,
      },
    ]);

    await source('Attachments').insert([
      { file: ATTACHMENT_BYTES, Filename: 'gel.png', plasmid_id: 1 },
    ]);

    const uid = (value: string) => (withUid ? { uid: value, synced: 0 } : {});
    await source('Features').insert([
      {
        annotation: 'pLac',
        alias: 'lac promoter',
        risk: 'None',
        organism: 'E. coli',
        ...uid('uidplac'),
      },
      {
        annotation: 'GFP',
        alias: 'green fluorescent protein',
        risk: 'No Risk',
        organism: 'A. victoria',
        ...uid('uidgfp'),
      },
      { annotation: 'T7term', alias: '', risk: '', organism: 'A. victoria', ...uid('uidt7') },
      {
        annotation: 'AmpR',
        alias: 'ampicillin resistance',
        risk: 'No Risk',
        organism: 'E. coli',
        ...uid('uidampr'),
      },
    ]);

    await source('Organisms').insert([
      { full_name: 'Escherichia coli', short_name: 'E. coli', RG: '1', ...uid('uidecoli') },
      { full_name: 'Aequorea victoria', short_name: 'A. victoria', RG: '1', ...uid('uidvict') },
    ]);
  } finally {
    await source.destroy();
  }

  const data = await fs.readFile(filePath);
  await fs.unlink(filePath).catch(() => undefined);
  return data;
}

/** Minimal valid SQLite file that is not a GMOCU database */
async function buildNonGmocuSqlite(): Promise<Buffer> {
  const filePath = path.join(os.tmpdir(), `not-gmocu-${randomUUID()}.db`);
  const other = knex({
    client: 'sqlite3',
    connection: { filename: filePath },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
  try {
    await other.schema.createTable('Unrelated', (table) => {
      table.increments('id');
    });
  } finally {
    await other.destroy();
  }
  const data = await fs.readFile(filePath);
  await fs.unlink(filePath).catch(() => undefined);
  return data;
}

function importRequest(data: Buffer, fields: Record<string, string> = {}): Request {
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array(data)], 'gmocu.db'));
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request('http://localhost/api/import', { method: 'POST', body: formData });
}

describe('GMOCU v1 Database Import (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    importService = new ImportService();
    plasmidService = new PlasmidService();
    importRoute = await import('@app/api/import/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
    await plasmidService.createPlasmid({ id: randomUUID(), name: 'pExisting' });
  });

  describe('inspectSource', () => {
    it('lists new plasmids as candidates and existing ones as skipped', async () => {
      const sourceDb = await buildLegacySourceDb();
      const inspection = await importService.inspectSource(sourceDb);

      expect(inspection.candidates).toEqual(['pImp001', 'pImp002']);
      expect(inspection.skippedExisting).toEqual(['pExisting']);
    });

    it('matches existing names case-insensitively (v2 uniqueness invariant)', async () => {
      await plasmidService.createPlasmid({ id: randomUUID(), name: 'PIMP001' });
      const sourceDb = await buildLegacySourceDb();

      const inspection = await importService.inspectSource(sourceDb);

      expect(inspection.candidates).toEqual(['pImp002']);
      expect(inspection.skippedExisting).toContain('pImp001');
    });

    it('writes nothing to the local database', async () => {
      const sourceDb = await buildLegacySourceDb();
      await importService.inspectSource(sourceDb);

      expect(await db('plasmids').count('id as n').first()).toEqual({ n: 1 });
      expect(await db('glossary_features').count('id as n').first()).toEqual({ n: 0 });
    });
  });

  describe('importFromSource', () => {
    it('imports plasmids with mapped fields, children, and glossary backfill', async () => {
      const sourceDb = await buildLegacySourceDb();
      const result = await importService.importFromSource(sourceDb);

      expect(result.importedPlasmids).toEqual(['pImp001', 'pImp002']);
      expect(result.skippedExisting).toEqual(['pExisting']);
      expect(result.skippedDuplicateNames).toEqual(['pImp001']);

      // Plasmid field mapping
      const p1 = await db('plasmids').where('name', 'pImp001').first();
      expect(p1.status).toBe('validated'); // legacy Complete
      expect(p1.backboneVector).toBe('pUC19');
      expect(p1.description).toBe(
        'Expression test\nCloning summary: Assembled via Gibson\nClone: c3\nMarker: AmpR'
      );
      expect(p1.createdAt).toBe('2023-05-10T00:00:00.000Z'); // legacy entry date
      const p2 = await db('plasmids').where('name', 'pImp002').first();
      expect(p2.status).toBe('draft'); // legacy Planned
      expect(p2.description).toBeNull();

      // Only one pImp001 despite the duplicate source row
      expect(await db('plasmids').where('name', 'pImp001').count('id as n').first()).toEqual({
        n: 1,
      });

      // Cassettes: content -> name, source order -> position, type other
      const cassettes = await db('cassettes').where('plasmidId', p1.id).orderBy('position');
      expect(cassettes.map((c) => c.name)).toEqual(['pLac-GFP[v2]-T7term', 'AmpR']);
      expect(cassettes.every((c) => c.type === 'other')).toBe(true);
      expect(result.cassettes).toBe(3);

      // GMOs: organism verbatim, defaults applied, entryDate falls back
      const gmos = await db('gmos').where('plasmidId', p1.id);
      expect(gmos).toHaveLength(1);
      expect(gmos[0].organismName).toBe('E. coli');
      expect(gmos[0].approval).toBe('App-1');
      expect(gmos[0].dateGenerated).toBe('2023-05-11');
      expect(gmos[0].dateDestroyed).toBeNull();
      expect(gmos[0].entryDate).toBe('2023-05-11');

      // Attachments: BLOB round-trip
      const attachments = await db('attachments').where('plasmidId', p1.id);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe('gel.png');
      expect(attachments[0].sizeBytes).toBe(ATTACHMENT_BYTES.length);
      expect(Buffer.from(attachments[0].data).equals(ATTACHMENT_BYTES)).toBe(true);

      // GenBank normalized out of the legacy plasmid row
      const genbank = await db('genbank_files').where('plasmidId', p1.id).first();
      expect(genbank.filename).toBe('pImp001.gb');
      expect(genbank.content).toBe(GB_CONTENT);
      expect(result.genbankFiles).toBe(1);

      // Glossary backfill from cassette tokens (variant [v2] stripped)
      expect(result.addedFeatures.sort()).toEqual(['AmpR', 'GFP', 'T7term', 'pLac'].sort());
      const pLac = await db('glossary_features').where('annotation', 'pLac').first();
      expect(pLac.risk).toBe('No Risk'); // legacy 'None' normalization
      expect(pLac.uid).toBe('uidplac'); // source uid preserved
      expect(pLac.organism).toBe('E. coli');

      // Organisms referenced by features and GMOs
      expect(result.addedOrganisms.sort()).toEqual(['Aequorea victoria', 'Escherichia coli']);
      const ecoli = await db('organisms').where('fullName', 'Escherichia coli').first();
      expect(ecoli.shortName).toBe('E. coli');
      expect(ecoli.riskGroup).toBe('1');
      expect(ecoli.uid).toBe('uidecoli');
    });

    it('imports only the selected candidates', async () => {
      const sourceDb = await buildLegacySourceDb();
      const result = await importService.importFromSource(sourceDb, ['pImp002']);

      expect(result.importedPlasmids).toEqual(['pImp002']);
      expect(result.candidates).toEqual(['pImp001', 'pImp002']);
      expect(await db('plasmids').where('name', 'pImp001').first()).toBeUndefined();
      expect(await db('plasmids').where('name', 'pImp002').first()).toBeDefined();
      // Only pImp002's token backfills
      expect(result.addedFeatures).toEqual(['GFP']);
    });

    it('does not re-add glossary entries that already exist locally', async () => {
      const now = new Date().toISOString();
      await db('glossary_features').insert({
        id: randomUUID(),
        annotation: 'GFP',
        alias: 'local GFP',
        risk: 'No Risk',
        organism: 'A. victoria',
        uid: 'localuid',
        synced: false,
        createdAt: now,
        updatedAt: now,
      });
      await db('organisms').insert({
        id: randomUUID(),
        fullName: 'Aequorea victoria',
        shortName: 'A. victoria',
        riskGroup: '1',
        uid: 'localorg',
        synced: false,
        createdAt: now,
        updatedAt: now,
      });

      const sourceDb = await buildLegacySourceDb();
      const result = await importService.importFromSource(sourceDb);

      expect(result.addedFeatures).not.toContain('GFP');
      const gfp = await db('glossary_features').where('annotation', 'GFP');
      expect(gfp).toHaveLength(1);
      expect(gfp[0].alias).toBe('local GFP'); // untouched

      // 'A. victoria' resolves via shortName -> organism not duplicated
      expect(result.addedOrganisms).toEqual(['Escherichia coli']);
      expect(await db('organisms').count('id as n').first()).toEqual({ n: 2 });
    });

    it('imports pre-0.5 sources without uid columns, generating fresh uids', async () => {
      const sourceDb = await buildLegacySourceDb({ withUid: false });
      const result = await importService.importFromSource(sourceDb);

      expect(result.importedPlasmids).toEqual(['pImp001', 'pImp002']);
      const pLac = await db('glossary_features').where('annotation', 'pLac').first();
      expect(pLac.uid).toMatch(/^[0-9a-f]{32}$/);
      const ecoli = await db('organisms').where('fullName', 'Escherichia coli').first();
      expect(ecoli.uid).toMatch(/^[0-9a-f]{32}$/);
    });

    it('rejects files that are not SQLite databases', async () => {
      await expect(
        importService.importFromSource(Buffer.from('definitely not a sqlite file'))
      ).rejects.toMatchObject({ code: 'VALIDATION' });
      expect(await db('plasmids').count('id as n').first()).toEqual({ n: 1 });
    });

    it('rejects SQLite files without the GMOCU v1 tables', async () => {
      const nonGmocu = await buildNonGmocuSqlite();
      const error = await importService.importFromSource(nonGmocu).catch((e) => e as DomainError);
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION');
      expect((error as DomainError).message).toContain('missing tables');
    });

    it('rejects empty uploads', async () => {
      await expect(importService.importFromSource(Buffer.alloc(0))).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });
  });

  describe('POST /api/import', () => {
    it('dryRun=1 returns candidates without importing', async () => {
      const sourceDb = await buildLegacySourceDb();
      const response = await importRoute.POST(
        asNextRequest(importRequest(sourceDb, { dryRun: '1' }))
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.candidates).toEqual(['pImp001', 'pImp002']);
      expect(json.data.skippedExisting).toEqual(['pExisting']);
      expect(await db('plasmids').count('id as n').first()).toEqual({ n: 1 });
    });

    it('imports the plasmids named in the "names" field', async () => {
      const sourceDb = await buildLegacySourceDb();
      const response = await importRoute.POST(
        asNextRequest(importRequest(sourceDb, { names: JSON.stringify(['pImp001']) }))
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.importedPlasmids).toEqual(['pImp001']);
      expect(await db('plasmids').where('name', 'pImp001').first()).toBeDefined();
      expect(await db('plasmids').where('name', 'pImp002').first()).toBeUndefined();
    });

    it('imports all candidates when "names" is omitted (legacy Import all)', async () => {
      const sourceDb = await buildLegacySourceDb();
      const response = await importRoute.POST(asNextRequest(importRequest(sourceDb)));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.importedPlasmids).toEqual(['pImp001', 'pImp002']);
    });

    it('returns 400 when the file field is missing', async () => {
      const formData = new FormData();
      const response = await importRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/import', { method: 'POST', body: formData })
        )
      );
      expect(response.status).toBe(400);
    });

    it('returns 400 for a malformed "names" field', async () => {
      const sourceDb = await buildLegacySourceDb();
      const response = await importRoute.POST(
        asNextRequest(importRequest(sourceDb, { names: 'not-json' }))
      );
      expect(response.status).toBe(400);
      expect(await db('plasmids').count('id as n').first()).toEqual({ n: 1 });
    });

    it('returns 400 for a non-database upload', async () => {
      const response = await importRoute.POST(
        asNextRequest(importRequest(Buffer.from('plain text')))
      );
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.message).toContain('not a valid SQLite database');
    });
  });
});
