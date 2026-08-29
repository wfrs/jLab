/**
 * Integration Tests: Report API routes
 * Verifies XLSX responses (read back with exceljs) and the integrity-gate 400
 */

import { Knex } from 'knex';
import ExcelJS from 'exceljs';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type FormblattRoute = typeof import('@app/api/reports/formblatt-z/route');
type PlasmidListRoute = typeof import('@app/api/reports/plasmid-list/route');

let formblattRoute: FormblattRoute;
let plasmidListRoute: PlasmidListRoute;
let db: Knex;

const NOW = new Date().toISOString();

const asNextRequest = (req: Request) => req as never;

async function readWorkbook(response: Response): Promise<ExcelJS.Worksheet> {
  const buffer = Buffer.from(await response.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.getWorksheet('Sheet1')!;
}

describe('Report API routes (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    formblattRoute = await import('@app/api/reports/formblatt-z/route');
    plasmidListRoute = await import('@app/api/reports/plasmid-list/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);

    await db('organisms').insert({
      id: 'org-1',
      fullName: 'Escherichia coli K-12',
      shortName: 'E. coli',
      riskGroup: '1',
      uid: 'u1',
      synced: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db('glossary_features').insert({
      id: 'f-1',
      annotation: 'GFP',
      risk: 'No Risk',
      organism: 'E. coli',
      uid: 'fu1',
      synced: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db('plasmids').insert({
      id: 'p-1',
      name: 'pTest',
      backboneVector: 'pUC19',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db('cassettes').insert({
      id: 'cas-1',
      plasmidId: 'p-1',
      name: 'GFP',
      type: 'other',
      position: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db('gmos').insert({
      id: 'gmo-1',
      plasmidId: 'p-1',
      organismName: 'Escherichia coli K-12',
      approval: '-',
      targetRiskGroup: 1,
      dateGenerated: '2026-08-01',
      dateDestroyed: null,
      entryDate: '2026-08-01',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  describe('GET /api/reports/formblatt-z', () => {
    it('returns a valid XLSX with German headers by default', async () => {
      const response = await formblattRoute.GET(
        asNextRequest(new Request('http://localhost/api/reports/formblatt-z'))
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('spreadsheetml');
      expect(response.headers.get('Content-Disposition')).toContain('Formblatt-Z_');

      const sheet = await readWorkbook(response as unknown as Response);
      expect(sheet.getCell('A1').value).toBe('Nr.');
      expect(sheet.getCell('B1').value).toBe('Spender Bezeichnung');
      // Data row
      expect(sheet.getCell('B2').value).toBe('E. coli');
      expect(sheet.getCell('F2').value).toBe('pUC19');
      expect(sheet.getCell('I2').value).toBe('E. coli-pTest');
    });

    it('returns English headers with ?lang=en', async () => {
      const response = await formblattRoute.GET(
        asNextRequest(new Request('http://localhost/api/reports/formblatt-z?lang=en'))
      );
      const sheet = await readWorkbook(response as unknown as Response);
      expect(sheet.getCell('A1').value).toBe('No');
      expect(sheet.getCell('B1').value).toBe('Donor designation');
    });

    it('applies the legacy print setup', async () => {
      const response = await formblattRoute.GET(
        asNextRequest(new Request('http://localhost/api/reports/formblatt-z'))
      );
      const sheet = await readWorkbook(response as unknown as Response);
      expect(sheet.pageSetup.orientation).toBe('landscape');
      expect(sheet.pageSetup.fitToWidth).toBe(1);
      expect(Math.round(sheet.getColumn(2).width || 0)).toBe(30);
    });

    it('returns 400 with the missing lists when the glossary gate fails', async () => {
      await db('cassettes').insert({
        id: 'cas-2',
        plasmidId: 'p-1',
        name: 'GFP-XXX',
        type: 'other',
        position: 1,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const response = await formblattRoute.GET(
        asNextRequest(new Request('http://localhost/api/reports/formblatt-z'))
      );
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.category).toBe('VALIDATION');
      expect(json.details.missingFeatures).toEqual(['pTest: XXX']);
    });
  });

  describe('GET /api/reports/plasmid-list', () => {
    it('returns a valid XLSX listing plasmids', async () => {
      const response = await plasmidListRoute.GET(
        asNextRequest(new Request('http://localhost/api/reports/plasmid-list'))
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('Plasmidlist_');

      const sheet = await readWorkbook(response as unknown as Response);
      expect(sheet.getCell('A1').value).toBe('No.');
      expect(sheet.getCell('B2').value).toBe('pTest');
      expect(sheet.getCell('D2').value).toBe('pUC19');
    });
  });
});
