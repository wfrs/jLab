/**
 * Integration Tests: Plasmid duplication (service + API route)
 * Legacy parity (gmocu.py 2051–2086): copy content fields + ' (Copy)' name,
 * copy cassettes, copy GMOs only when duplicateGmos is on (with today's
 * dates, destroyed cleared); status resets; GenBank/attachments stay behind.
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { PlasmidService } from '@services/plasmid.service';
import { CassetteService } from '@services/cassette.service';
import { GmoService } from '@services/gmo.service';
import { SettingsService } from '@services/settings.service';
import { AttachmentService } from '@services/attachment.service';
import { GenbankService } from '@services/genbank.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type DuplicateRoute = typeof import('@app/api/plasmids/[id]/duplicate/route');

let duplicateRoute: DuplicateRoute;
let plasmidService: PlasmidService;
let cassetteService: CassetteService;
let gmoService: GmoService;
let settingsService: SettingsService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;
const todayIso = new Date().toISOString().slice(0, 10);

/** GMO creation requires the organism in the glossary */
async function seedOrganism(fullName: string, riskGroup: string): Promise<void> {
  const now = new Date().toISOString();
  await db('organisms').insert({
    id: randomUUID(),
    fullName,
    riskGroup,
    uid: randomUUID().replace(/-/g, '').slice(0, 16),
    synced: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function createSourcePlasmid(): Promise<string> {
  const plasmid = await plasmidService.createPlasmid({
    id: randomUUID(),
    name: 'pSource',
    description: 'GFP expression vector',
    sizeBp: 5400,
    backboneVector: 'pUC19',
    status: 'validated',
  });
  return plasmid.id;
}

describe('Plasmid duplication (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    plasmidService = new PlasmidService();
    cassetteService = new CassetteService();
    gmoService = new GmoService();
    settingsService = new SettingsService();

    duplicateRoute = await import('@app/api/plasmids/[id]/duplicate/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  it('copies content fields, appends " (Copy)", and resets status', async () => {
    const sourceId = await createSourcePlasmid();

    const copy = await plasmidService.duplicatePlasmid(sourceId);

    expect(copy.id).not.toBe(sourceId);
    expect(copy.name).toBe('pSource (Copy)');
    expect(copy.description).toBe('GFP expression vector');
    expect(copy.sizeBp).toBe(5400);
    expect(copy.backboneVector).toBe('pUC19');
    // Legacy resets status to the default; source stays untouched
    expect(copy.status).toBe('draft');
    expect((await plasmidService.getPlasmid(sourceId)).status).toBe('validated');
  });

  it('numbers clashing copy names: (Copy), (Copy 2), (Copy 3)', async () => {
    const sourceId = await createSourcePlasmid();

    expect((await plasmidService.duplicatePlasmid(sourceId)).name).toBe('pSource (Copy)');
    expect((await plasmidService.duplicatePlasmid(sourceId)).name).toBe('pSource (Copy 2)');
    expect((await plasmidService.duplicatePlasmid(sourceId)).name).toBe('pSource (Copy 3)');
  });

  it('copies all cassettes with fields and positions, under new ids', async () => {
    const sourceId = await createSourcePlasmid();
    await cassetteService.createCassette({
      id: randomUUID(),
      plasmidId: sourceId,
      name: 'pT7-GFP-T7term',
      type: 'other',
    });
    await cassetteService.createCassette({
      id: randomUUID(),
      plasmidId: sourceId,
      name: 'AmpR',
      type: 'resistance',
      sequence: 'ATGC',
    });

    const copy = await plasmidService.duplicatePlasmid(sourceId);

    const sourceCassettes = await cassetteService.listPlasmidCassettes(sourceId);
    const copyCassettes = await cassetteService.listPlasmidCassettes(copy.id);
    expect(copyCassettes).toHaveLength(2);
    expect(copyCassettes.map((c) => [c.name, c.type, c.sequence ?? null, c.position])).toEqual(
      sourceCassettes.map((c) => [c.name, c.type, c.sequence ?? null, c.position])
    );
    const sourceIds = new Set(sourceCassettes.map((c) => c.id));
    for (const cassette of copyCassettes) {
      expect(sourceIds.has(cassette.id)).toBe(false);
    }
  });

  it('does not copy GMOs when duplicateGmos is off (default)', async () => {
    const sourceId = await createSourcePlasmid();
    await seedOrganism('Escherichia coli K-12', '1');
    await gmoService.createGmo({
      id: randomUUID(),
      plasmidId: sourceId,
      organismName: 'Escherichia coli K-12',
      targetRiskGroup: 1,
    });

    const copy = await plasmidService.duplicatePlasmid(sourceId);

    expect(await gmoService.listPlasmidGmos(copy.id)).toHaveLength(0);
    expect(await gmoService.listPlasmidGmos(sourceId)).toHaveLength(1);
  });

  it("copies GMOs with today's dates and destroyed cleared when the setting is on", async () => {
    await settingsService.updateSettings({ duplicateGmos: true });
    const sourceId = await createSourcePlasmid();
    await seedOrganism('Escherichia coli K-12', '2');
    await seedOrganism('Saccharomyces cerevisiae', '1');
    await gmoService.createGmo({
      id: randomUUID(),
      plasmidId: sourceId,
      organismName: 'Escherichia coli K-12',
      approval: 'Az. 42',
      targetRiskGroup: 2,
      dateGenerated: '2020-01-15',
    });
    // A destroyed GMO is copied as a live one (legacy copies all rows
    // "but with current date")
    const destroyed = await gmoService.createGmo({
      id: randomUUID(),
      plasmidId: sourceId,
      organismName: 'Saccharomyces cerevisiae',
      targetRiskGroup: 1,
      dateGenerated: '2019-03-01',
    });
    await gmoService.updateGmo(destroyed.id, { dateDestroyed: '2021-06-30' });

    const copy = await plasmidService.duplicatePlasmid(sourceId);

    const copied = await gmoService.listPlasmidGmos(copy.id);
    expect(copied).toHaveLength(2);
    for (const gmo of copied) {
      expect(gmo.dateGenerated).toBe(todayIso);
      expect(gmo.entryDate).toBe(todayIso);
      expect(gmo.dateDestroyed).toBeNull();
    }
    const coli = copied.find((g) => g.organismName === 'Escherichia coli K-12');
    expect(coli).toMatchObject({ approval: 'Az. 42', targetRiskGroup: 2 });
  });

  it('leaves GenBank file and attachments behind (legacy parity)', async () => {
    const sourceId = await createSourcePlasmid();
    await new GenbankService().setFile({
      plasmidId: sourceId,
      filename: 'pSource.gb',
      content: 'LOCUS pSource\n//\n',
    });
    await new AttachmentService().createAttachment({
      plasmidId: sourceId,
      filename: 'gel.png',
      data: Buffer.from('PNG'),
    });

    const copy = await plasmidService.duplicatePlasmid(sourceId);

    expect(await new GenbankService().getMeta(copy.id)).toBeNull();
    expect(await new AttachmentService().listPlasmidAttachments(copy.id)).toHaveLength(0);
    // Source keeps its files
    expect(await new GenbankService().getMeta(sourceId)).not.toBeNull();
    expect(await new AttachmentService().listPlasmidAttachments(sourceId)).toHaveLength(1);
  });

  describe('Duplicate API', () => {
    it('POST returns 201 with the new plasmid', async () => {
      const sourceId = await createSourcePlasmid();

      const response = await duplicateRoute.POST(
        asNextRequest(
          new Request(`http://localhost/api/plasmids/${sourceId}/duplicate`, { method: 'POST' })
        ),
        { params: { id: sourceId } }
      );

      expect(response.status).toBe(201);
      const body = (await response.json()).data;
      expect(body.name).toBe('pSource (Copy)');
      expect(body.id).not.toBe(sourceId);
    });

    it('POST returns 404 for an unknown plasmid', async () => {
      const response = await duplicateRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/plasmids/nope/duplicate', { method: 'POST' })
        ),
        { params: { id: 'nope' } }
      );
      expect(response.status).toBe(404);
    });
  });
});
