/**
 * Integration Tests: label payloads, print history and prep batches.
 *
 * There is no legacy behaviour to compare against — GMOCU has no label code —
 * so the standard is the lab's own artefacts: `plasmid_labels.docx` for what a
 * label says, and `plasmids_JM_expanded.xlsx` for where the values come from.
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { LabelService } from '@services/label.service';
import { PlasmidPrepService } from '@services/plasmid-prep.service';
import { buildPlasmidLabelLines } from '@domain/label-content';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type LabelsRoute = typeof import('@app/api/labels/plasmids/route');
type PrintsRoute = typeof import('@app/api/labels/prints/route');
type PrepsRoute = typeof import('@app/api/plasmids/preps/route');

let labelsRoute: LabelsRoute;
let printsRoute: PrintsRoute;
let prepsRoute: PrepsRoute;
let labelService: LabelService;
let prepService: PlasmidPrepService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

async function addPlasmid(name: string, constructName: string | null = null): Promise<string> {
  const id = randomUUID();
  await db('plasmids').insert({
    id,
    name,
    constructName,
    description: null,
    sizeBp: null,
    parentId: null,
    backboneVector: null,
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function addPrep(
  plasmidId: string,
  preppedOn: string,
  concentrationNgUl: number | null,
  operatorInitials = 'JM'
): Promise<void> {
  await db('plasmid_preps').insert({
    id: randomUUID(),
    plasmidId,
    preppedOn,
    operatorInitials,
    concentrationNgUl,
    createdAt: now(),
    updatedAt: now(),
  });
}

describe('Label API', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    labelsRoute = await import('@app/api/labels/plasmids/route');
    printsRoute = await import('@app/api/labels/prints/route');
    prepsRoute = await import('@app/api/plasmids/preps/route');
    labelService = new LabelService();
    prepService = new PlasmidPrepService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('building payloads', () => {
    it('joins a plasmid to its prep, reproducing pJM0001 line for line', async () => {
      const id = await addPlasmid('pJM0001', 'pMiso000');
      await addPrep(id, '2024-01-31', 80);

      const [label] = await labelService.buildPlasmidLabels([id]);

      expect(label).toMatchObject({
        accession: 'pJM0001',
        constructName: 'pMiso000',
        operatorInitials: 'JM',
        preppedOn: '2024-01-31',
        concentrationNgUl: 80,
      });

      // The printed label reads: pJM0001 / pMiso000 / JM 31.01.24 / 80.0 ng/µL
      expect(buildPlasmidLabelLines(label!).map((line) => line.text)).toEqual([
        'pJM0001',
        'pMiso000',
        'JM 31.01.24',
        '80.0 ng/µL',
      ]);
    });

    it('takes the newest prep when a plasmid has been remade', async () => {
      // "the plasmid was prepped new because the stock was empty" — the label
      // must carry the current tube, not the first one.
      const id = await addPlasmid('pJM0021', 'pMisoG');
      await addPrep(id, '2024-06-20', 21.2);
      await addPrep(id, '2025-03-25', 148.6);

      const [label] = await labelService.buildPlasmidLabels([id]);

      expect(label?.preppedOn).toBe('2025-03-25');
      expect(label?.concentrationNgUl).toBe(148.6);
    });

    it('leaves date and concentration null when a plasmid has never been prepped', async () => {
      // pJM0355 and pJM0356 are designed but not yet cloned
      const id = await addPlasmid('pJM0355', 'pMisoPlanned');

      const [label] = await labelService.buildPlasmidLabels([id]);

      expect(label?.preppedOn).toBeNull();
      expect(label?.concentrationNgUl).toBeNull();
      expect(buildPlasmidLabelLines(label!).map((line) => line.text)).toEqual([
        'pJM0355',
        'pMisoPlanned',
      ]);
    });

    it('keeps a measured-less prep distinct from an unmeasured one', async () => {
      const id = await addPlasmid('pJM0376', 'pMisoX');
      await addPrep(id, '2025-03-25', null);

      const [label] = await labelService.buildPlasmidLabels([id]);

      expect(label?.preppedOn).toBe('2025-03-25');
      expect(label?.concentrationNgUl).toBeNull();
      // Not "0.0 ng/µL"
      expect(buildPlasmidLabelLines(label!).map((line) => line.text)).toContain('xxxx ng/µL');
    });

    it('orders labels by accession, not by the order the ids arrived in', async () => {
      const third = await addPlasmid('pJM0003');
      const first = await addPlasmid('pJM0001');
      const second = await addPlasmid('pJM0002');

      const labels = await labelService.buildPlasmidLabels([third, first, second]);

      expect(labels.map((label) => label.accession)).toEqual(['pJM0001', 'pJM0002', 'pJM0003']);
    });

    it('de-duplicates repeated ids rather than printing a label twice', async () => {
      const id = await addPlasmid('pJM0001', 'pMiso000');

      const labels = await labelService.buildPlasmidLabels([id, id, id]);

      expect(labels).toHaveLength(1);
    });

    it('rejects an unknown id instead of printing a short sheet', async () => {
      // A missing label is not noticed until the tubes are already labelled.
      const id = await addPlasmid('pJM0001');

      await expect(labelService.buildPlasmidLabels([id, 'missing-id'])).rejects.toThrow(
        /Unknown plasmid/
      );
    });

    it('rejects an empty selection', async () => {
      await expect(labelService.buildPlasmidLabels([])).rejects.toThrow(/At least one/);
    });
  });

  describe('GET /api/labels/plasmids', () => {
    it('returns the labels in an envelope', async () => {
      const id = await addPlasmid('pJM0001', 'pMiso000');
      await addPrep(id, '2024-01-31', 80);

      const response = await labelsRoute.GET(
        asNextRequest(new Request(`http://localhost/api/labels/plasmids?ids=${id}`))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.correlationId).toBeDefined();
      expect(body.data.labels).toHaveLength(1);
      expect(body.data.labels[0].accession).toBe('pJM0001');
    });

    it('400s when ids is missing', async () => {
      const response = await labelsRoute.GET(
        asNextRequest(new Request('http://localhost/api/labels/plasmids'))
      );

      expect(response.status).toBe(400);
    });

    it('404s for an unknown plasmid', async () => {
      const response = await labelsRoute.GET(
        asNextRequest(new Request('http://localhost/api/labels/plasmids?ids=nope'))
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.category).toBe('NOT_FOUND');
    });
  });

  describe('print history', () => {
    it('records one row per label and reports it back on the next build', async () => {
      const first = await addPlasmid('pJM0001', 'pMiso000');
      const second = await addPlasmid('pJM0002', 'pMiso001');

      const response = await printsRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/labels/prints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'plasmid', ids: [first, second] }),
          })
        )
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.recorded).toBe(2);

      const labels = await labelService.buildPlasmidLabels([first, second]);
      expect(labels.every((label) => label.lastPrintedAt)).toBe(true);
    });

    it('keeps every print, so a reprint is visible as a second row', async () => {
      const id = await addPlasmid('pJM0001');

      await labelService.recordPrints('plasmid', [id]);
      await labelService.recordPrints('plasmid', [id]);

      expect(await labelService.listPrints('plasmid', id)).toHaveLength(2);
    });

    it('does not mark a label printed just because another one was', async () => {
      const printed = await addPlasmid('pJM0001');
      const untouched = await addPlasmid('pJM0002');

      await labelService.recordPrints('plasmid', [printed]);

      const labels = await labelService.buildPlasmidLabels([printed, untouched]);
      expect(labels[0]?.lastPrintedAt).toBeDefined();
      expect(labels[1]?.lastPrintedAt).toBeUndefined();
    });

    it('rejects a bad kind at the boundary', async () => {
      const response = await printsRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/labels/prints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'sticker', ids: ['a'] }),
          })
        )
      );

      expect(response.status).toBe(400);
    });
  });

  describe('prep batches', () => {
    it('records one prep per plasmid from a shared date and operator', async () => {
      // pJM0084-pJM0096 all carry 06.11.24 in the lab's spreadsheet
      const ids = await Promise.all([
        addPlasmid('pJM0084'),
        addPlasmid('pJM0085'),
        addPlasmid('pJM0086'),
      ]);

      const response = await prepsRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/plasmids/preps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              preppedOn: '2024-11-06',
              operatorInitials: 'JM',
              entries: [
                { plasmidId: ids[0], concentrationNgUl: 120.5 },
                { plasmidId: ids[1], concentrationNgUl: 98 },
                { plasmidId: ids[2], concentrationNgUl: null },
              ],
            }),
          })
        )
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.preps).toHaveLength(3);

      const labels = await labelService.buildPlasmidLabels(ids);
      expect(labels.map((label) => label.preppedOn)).toEqual([
        '2024-11-06',
        '2024-11-06',
        '2024-11-06',
      ]);
      expect(labels[2]?.concentrationNgUl).toBeNull();
    });

    it('rolls the whole batch back when one plasmid is unknown', async () => {
      // A half-recorded prep session would put an old date beside a new
      // concentration — exactly the pJM0055 problem this replaces.
      const known = await addPlasmid('pJM0084');

      await expect(
        prepService.recordBatch({
          preppedOn: '2024-11-06',
          operatorInitials: 'JM',
          entries: [{ plasmidId: known }, { plasmidId: 'missing-id' }],
        })
      ).rejects.toThrow(/Unknown plasmid/);

      expect(await db('plasmid_preps').count({ c: '*' }).first()).toMatchObject({ c: 0 });
    });

    it('rejects a negative concentration', async () => {
      const id = await addPlasmid('pJM0084');

      await expect(
        prepService.recordBatch({
          preppedOn: '2024-11-06',
          operatorInitials: 'JM',
          entries: [{ plasmidId: id, concentrationNgUl: -5 }],
        })
      ).rejects.toThrow(/positive/);
    });

    it('rejects a non-ISO date', async () => {
      const id = await addPlasmid('pJM0084');

      await expect(
        prepService.recordBatch({
          preppedOn: '06.11.2024',
          operatorInitials: 'JM',
          entries: [{ plasmidId: id }],
        })
      ).rejects.toThrow(/ISO date/);
    });

    it('rejects the same plasmid twice in one batch', async () => {
      const id = await addPlasmid('pJM0084');

      await expect(
        prepService.recordBatch({
          preppedOn: '2024-11-06',
          operatorInitials: 'JM',
          entries: [{ plasmidId: id }, { plasmidId: id }],
        })
      ).rejects.toThrow(/twice/);
    });

    it('takes its preps and print history with it when the plasmid is deleted', async () => {
      // Every other child table is already cascaded in PlasmidService.delete;
      // these three arrived with the label work and must join them.
      const { PlasmidService } = await import('@services/plasmid.service');
      const id = await addPlasmid('pJM0084');
      await addPrep(id, '2024-11-06', 120.5);
      await labelService.recordPrints('plasmid', [id]);
      await db('glycerol_stocks').insert({
        id: randomUUID(),
        stockId: 'CJM84',
        plasmidId: id,
        organism: 'E. coli',
        strain: 'TOP10',
        createdAt: now(),
        updatedAt: now(),
      });

      await new PlasmidService().deletePlasmid(id);

      expect(await db('plasmid_preps').where('plasmidId', id)).toHaveLength(0);
      expect(await db('label_prints').where({ kind: 'plasmid', targetId: id })).toHaveLength(0);

      // The tube is still in the freezer, so the stock survives, unlinked
      const stock = await db('glycerol_stocks').where('stockId', 'CJM84').first();
      expect(stock).toBeDefined();
      expect(stock.plasmidId).toBeNull();
    });

    it('lists a plasmid’s preps newest first', async () => {
      const id = await addPlasmid('pJM0021');
      await addPrep(id, '2024-06-20', 21.2);
      await addPrep(id, '2025-03-25', 148.6);

      const history = await prepService.listForPlasmid(id);

      expect(history.map((prep) => prep.preppedOn)).toEqual(['2025-03-25', '2024-06-20']);
    });
  });
});
