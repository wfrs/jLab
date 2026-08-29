/**
 * Integration Tests: glossary Excel import (service and API route)
 * Legacy parity (gmocu.py add_to_features L721 / add_to_organisms L741):
 * annotations normalized on import, existing keys skipped and reported,
 * blank risk becomes 'No Risk'.
 *
 * Uses the real templates shipped with the legacy app as fixtures:
 * gmocu/example/glossary_Jores_lab.xlsx (two sheets) and organisms.xlsx.
 */

import { promises as fs } from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { GlossaryExcelService } from '@services/glossary-excel.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { DomainError } from '@domain/types';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type ImportRoute = typeof import('@app/api/glossary/import/route');

const REPO_ROOT = path.resolve(__dirname, '../..');
const GLOSSARY_TEMPLATE = path.join(REPO_ROOT, 'gmocu/example/glossary_Jores_lab.xlsx');
const ORGANISMS_TEMPLATE = path.join(REPO_ROOT, 'gmocu/example/organisms.xlsx');

let importRoute: ImportRoute;
let service: GlossaryExcelService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;

/** Builds an in-memory workbook from plain rows */
async function buildWorkbook(
  sheets: { name: string; header: string[]; rows: (string | number | null)[][] }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow(sheet.header);
    for (const row of sheet.rows) {
      ws.addRow(row);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function uploadRequest(data: Buffer, filename = 'glossary.xlsx'): Request {
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array(data)], filename));
  return new Request('http://localhost/api/glossary/import', { method: 'POST', body: formData });
}

describe('Glossary Excel import (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new GlossaryExcelService();
    importRoute = await import('@app/api/glossary/import/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('legacy templates (real fixtures)', () => {
    it('imports both sheets of the two-sheet glossary template', async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);

      const result = await service.importWorkbook(data);

      expect(result.sheetsRead.sort()).toEqual(['features', 'organisms']);
      expect(result.features.added).toHaveLength(93);
      // 33 data rows, one of which repeats Discosoma sp. within the file
      expect(result.organisms.added).toHaveLength(32);
      expect(result.organisms.skippedDuplicateInFile).toEqual(['Discosoma sp.']);

      expect(await db('glossary_features').count('id as n').first()).toEqual({ n: 93 });
      expect(await db('organisms').count('id as n').first()).toEqual({ n: 32 });
    });

    it('normalizes the annotations that need it and reports the rewrites', async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);

      const result = await service.importWorkbook(data);

      const rewrites = Object.fromEntries(result.normalizedAnnotations.map((r) => [r.from, r.to]));
      expect(rewrites).toMatchObject({
        'PEST-2': 'PEST_2',
        'SpCas9-HF1': 'SpCas9_HF1',
        't-arm': 't_arm',
        'NLS-B3': 'NLS_B3',
      });
      // A hyphenated token would otherwise split into two cassette tokens
      expect(await db('glossary_features').where('annotation', 'PEST_2').first()).toBeDefined();
      expect(await db('glossary_features').where('annotation', 'PEST-2').first()).toBeUndefined();
    });

    it("rewrites the template's 'None' risk to 'No Risk'", async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);

      await service.importWorkbook(data);

      const risks = (await db('glossary_features').distinct('risk')) as { risk: string }[];
      expect(risks).toEqual([{ risk: 'No Risk' }]);
    });

    it('flags the feature organism the template does not define (UsMa)', async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);

      const result = await service.importWorkbook(data);

      expect(result.unresolvedFeatureOrganisms).toEqual(['UsMa']);
    });

    it('resolves UsMa once the separate organisms template is imported too', async () => {
      await service.importWorkbook(await fs.readFile(ORGANISMS_TEMPLATE));
      const result = await service.importWorkbook(await fs.readFile(GLOSSARY_TEMPLATE));

      expect(result.unresolvedFeatureOrganisms).toEqual([]);
      expect(await db('organisms').where('shortName', 'UsMa').first()).toBeDefined();
    });

    it('imports the single-sheet organisms template by header sniffing', async () => {
      const data = await fs.readFile(ORGANISMS_TEMPLATE);

      const result = await service.importWorkbook(data);

      // Legacy read sheet 0 blindly; the sheet here is named "Sheet1"
      expect(result.sheetsRead).toEqual(['Sheet1']);
      // 34 data rows, but this file repeats Discosoma sp. as well
      expect(result.organisms.added).toHaveLength(33);
      expect(result.organisms.skippedDuplicateInFile).toEqual(['Discosoma sp.']);
      expect(result.features.added).toEqual([]);
      const ustilago = await db('organisms').where('shortName', 'UsMa').first();
      expect(ustilago.fullName).toBe('Ustilago maydis');
      expect(ustilago.riskGroup).toBe('1');
    });

    it('is idempotent: a second import of the same file adds nothing', async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);
      await service.importWorkbook(data);

      const second = await service.importWorkbook(data);

      expect(second.features.added).toEqual([]);
      expect(second.organisms.added).toEqual([]);
      expect(second.features.skippedExisting).toHaveLength(93);
      expect(await db('glossary_features').count('id as n').first()).toEqual({ n: 93 });
    });
  });

  describe('import rules', () => {
    it('never overwrites an existing entry', async () => {
      const now = new Date().toISOString();
      await db('glossary_features').insert({
        id: randomUUID(),
        annotation: 'EGFP',
        alias: 'local alias worth keeping',
        risk: 'No Risk',
        organism: 'Aequorea victoria',
        uid: 'localuid',
        synced: false,
        createdAt: now,
        updatedAt: now,
      });

      const data = await buildWorkbook([
        {
          name: 'features',
          header: ['annotation', 'alias', 'risk', 'organism'],
          rows: [['EGFP', 'imported alias', 'None', 'AeVi']],
        },
      ]);
      const result = await service.importWorkbook(data);

      expect(result.features.skippedExisting).toEqual(['EGFP']);
      const stored = await db('glossary_features').where('annotation', 'EGFP').first();
      expect(stored.alias).toBe('local alias worth keeping');
      expect(stored.uid).toBe('localuid');
    });

    it('skips rows repeated within the file rather than failing the import', async () => {
      const data = await buildWorkbook([
        {
          name: 'features',
          header: ['annotation', 'alias', 'risk', 'organism'],
          rows: [
            ['dupFeat', 'first', 'None', 'EsCo'],
            ['dupFeat', 'second', 'None', 'EsCo'],
          ],
        },
      ]);

      const result = await service.importWorkbook(data);

      expect(result.features.added).toEqual(['dupFeat']);
      expect(result.features.skippedDuplicateInFile).toEqual(['dupFeat']);
      const stored = await db('glossary_features').where('annotation', 'dupFeat');
      expect(stored).toHaveLength(1);
      expect(stored[0].alias).toBe('first');
    });

    it('treats a normalized collision as an existing entry', async () => {
      const data = await buildWorkbook([
        {
          name: 'features',
          header: ['annotation', 'alias', 'risk', 'organism'],
          rows: [
            ['my feature', 'space form', 'None', 'EsCo'],
            ['my-feature', 'hyphen form', 'None', 'EsCo'],
          ],
        },
      ]);

      const result = await service.importWorkbook(data);

      // Both normalize to my_feature
      expect(result.features.added).toEqual(['my_feature']);
      expect(result.features.skippedDuplicateInFile).toEqual(['my_feature']);
    });

    it('skips blank key rows and counts them', async () => {
      const data = await buildWorkbook([
        {
          name: 'features',
          header: ['annotation', 'alias', 'risk', 'organism'],
          rows: [
            ['keeper', 'ok', 'None', 'EsCo'],
            [null, 'orphan alias', 'None', 'EsCo'],
          ],
        },
      ]);

      const result = await service.importWorkbook(data);

      expect(result.features.added).toEqual(['keeper']);
      expect(result.features.skippedBlank).toBe(1);
    });

    it('defaults a missing risk group to 1 and tolerates a missing short_name column', async () => {
      const data = await buildWorkbook([
        {
          name: 'organisms',
          header: ['full_name'],
          rows: [['Organism without extras']],
        },
      ]);

      const result = await service.importWorkbook(data);

      expect(result.organisms.added).toEqual(['Organism without extras']);
      const stored = await db('organisms').where('fullName', 'Organism without extras').first();
      expect(stored.riskGroup).toBe('1');
      expect(stored.shortName).toBeNull();
    });

    it('rolls back entirely when a sheet is malformed', async () => {
      const data = await buildWorkbook([
        {
          name: 'organisms',
          header: ['full_name', 'short_name', 'RG'],
          rows: [['Good organism', 'GoOr', 1]],
        },
        // features sheet present but missing its key column
        { name: 'features', header: ['alias', 'risk'], rows: [['x', 'None']] },
      ]);

      await expect(service.importWorkbook(data)).rejects.toBeInstanceOf(DomainError);
      // The organism from the first sheet must not survive the failure
      expect(await db('organisms').count('id as n').first()).toEqual({ n: 0 });
    });
  });

  describe('rejections', () => {
    it('rejects a workbook with no glossary sheet', async () => {
      const data = await buildWorkbook([
        { name: 'Unrelated', header: ['foo', 'bar'], rows: [['a', 'b']] },
      ]);

      const error = await service.importWorkbook(data).catch((e) => e as DomainError);
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).message).toContain('No glossary sheet found');
    });

    it('rejects a non-xlsx upload', async () => {
      await expect(
        service.importWorkbook(Buffer.from('this is not a workbook'))
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects an empty upload', async () => {
      await expect(service.importWorkbook(Buffer.alloc(0))).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });
  });

  describe('POST /api/glossary/import', () => {
    it('imports the real template and returns the itemized result', async () => {
      const data = await fs.readFile(GLOSSARY_TEMPLATE);

      const response = await importRoute.POST(asNextRequest(uploadRequest(data)));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.features.added).toHaveLength(93);
      expect(json.data.organisms.added).toHaveLength(32);
      expect(json.data.unresolvedFeatureOrganisms).toEqual(['UsMa']);
    });

    it('returns 400 when the file field is missing', async () => {
      const response = await importRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/glossary/import', {
            method: 'POST',
            body: new FormData(),
          })
        )
      );
      expect(response.status).toBe(400);
    });

    it('returns 400 for a non-workbook upload', async () => {
      const response = await importRoute.POST(
        asNextRequest(uploadRequest(Buffer.from('plain text'), 'notes.txt'))
      );
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.message).toContain('not a readable .xlsx workbook');
    });
  });
});
