/**
 * Integration Tests: SettingsService + Settings API + settings-driven reports
 */

import { Knex } from 'knex';
import ExcelJS from 'exceljs';
import { SettingsService } from '@services/settings.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type SettingsRoutes = typeof import('@app/api/settings/route');
type FormblattRoute = typeof import('@app/api/reports/formblatt-z/route');
type PlasmidListRoute = typeof import('@app/api/reports/plasmid-list/route');

let settingsRoutes: SettingsRoutes;
let formblattRoute: FormblattRoute;
let plasmidListRoute: PlasmidListRoute;
let service: SettingsService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;

function jsonRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

describe('Settings (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new SettingsService();

    settingsRoutes = await import('@app/api/settings/route');
    formblattRoute = await import('@app/api/reports/formblatt-z/route');
    plasmidListRoute = await import('@app/api/reports/plasmid-list/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('SettingsService', () => {
    it('creates the default row on first access', async () => {
      const settings = await service.getSettings();
      expect(settings.id).toBe('default');
      expect(settings.name).toBe('');
      expect(Number(settings.duplicateGmos)).toBe(0);

      // Second call returns the same row, not a new one
      await service.getSettings();
      expect(await db('settings').count('* as c').first()).toMatchObject({ c: 1 });
    });

    it('partially updates fields', async () => {
      await service.updateSettings({ name: 'J. Doe', initials: 'JD' });
      const settings = await service.getSettings();
      expect(settings.name).toBe('J. Doe');
      expect(settings.initials).toBe('JD');
      expect(settings.institution).toBe('');

      await service.updateSettings({ duplicateGmos: true });
      expect(Number((await service.getSettings()).duplicateGmos)).toBe(1);
    });
  });

  describe('Settings API', () => {
    it('GET returns the settings (creating defaults)', async () => {
      const response = await settingsRoutes.GET(
        asNextRequest(jsonRequest('http://localhost/api/settings', 'GET'))
      );
      expect(response.status).toBe(200);
      expect((await response.json()).data.id).toBe('default');
    });

    it('PATCH updates fields and validates email', async () => {
      const ok = await settingsRoutes.PATCH(
        asNextRequest(
          jsonRequest('http://localhost/api/settings', 'PATCH', {
            institution: 'Az.: 123',
            email: 'j.doe@example.org',
          })
        )
      );
      expect(ok.status).toBe(200);
      expect((await ok.json()).data.institution).toBe('Az.: 123');

      const bad = await settingsRoutes.PATCH(
        asNextRequest(
          jsonRequest('http://localhost/api/settings', 'PATCH', { email: 'not-an-email' })
        )
      );
      expect(bad.status).toBe(400);
    });

    it('PATCH rejects unknown fields and empty updates', async () => {
      const unknown = await settingsRoutes.PATCH(
        asNextRequest(jsonRequest('http://localhost/api/settings', 'PATCH', { theme: 'light' }))
      );
      expect(unknown.status).toBe(400);

      const empty = await settingsRoutes.PATCH(
        asNextRequest(jsonRequest('http://localhost/api/settings', 'PATCH', {}))
      );
      expect(empty.status).toBe(400);
    });
  });

  describe('Settings-driven reports (legacy filename/footer parity)', () => {
    it('Formblatt-Z filename includes the sanitized user name; footer the institution', async () => {
      await service.updateSettings({ name: 'J. Doe', institution: 'Az.: 42' });

      const response = await formblattRoute.GET(
        asNextRequest(jsonRequest('http://localhost/api/reports/formblatt-z', 'GET'))
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('Formblatt-Z_J._Doe_');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(await (response as unknown as Response).arrayBuffer()) as unknown as ArrayBuffer
      );
      const sheet = workbook.getWorksheet('Sheet1')!;
      expect(sheet.headerFooter.oddFooter).toBe('Formblatt Z, Az.: 42');
    });

    it('Plasmid list footer carries the initials', async () => {
      await service.updateSettings({ name: 'J. Doe', initials: 'JD' });

      const response = await plasmidListRoute.GET(
        asNextRequest(jsonRequest('http://localhost/api/reports/plasmid-list', 'GET'))
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('Plasmidlist_J._Doe_');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(await (response as unknown as Response).arrayBuffer()) as unknown as ArrayBuffer
      );
      const sheet = workbook.getWorksheet('Sheet1')!;
      expect(sheet.headerFooter.oddFooter).toContain('JD Plasmidlist, date: ');
    });

    it('reports still work with empty settings (no name segment)', async () => {
      const response = await plasmidListRoute.GET(
        asNextRequest(jsonRequest('http://localhost/api/reports/plasmid-list', 'GET'))
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toMatch(/Plasmidlist_\d{4}-\d{2}-\d{2}/);
    });
  });
});
