/**
 * Integration Tests: glycerol stock labels and stock records.
 *
 * The specification is `gmocu/example/glycerol_stock_labels.docx` — GMOCU has
 * no label code. Every expectation below is taken from a label the lab has
 * actually printed.
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { LabelService } from '@services/label.service';
import { GlycerolStockService } from '@services/glycerol-stock.service';
import { buildGlycerolLabelLines } from '@domain/label-content';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type GlycerolRoute = typeof import('@app/api/labels/glycerol/route');
type StocksRoute = typeof import('@app/api/glycerol-stocks/route');

let glycerolRoute: GlycerolRoute;
let stocksRoute: StocksRoute;
let labelService: LabelService;
let stockService: GlycerolStockService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

async function addPlasmid(name: string, constructName: string | null = null): Promise<string> {
  const id = randomUUID();
  await db('plasmids').insert({
    id,
    name,
    constructName,
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function addStock(stockId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  await db('glycerol_stocks').insert({
    id,
    stockId,
    plasmidId: null,
    organism: 'E. coli',
    strain: 'TOP10',
    constructLabel: null,
    madeOn: '2024-01-23',
    operatorInitials: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
  return id;
}

const linesOf = (label: Parameters<typeof buildGlycerolLabelLines>[0]) =>
  buildGlycerolLabelLines(label).map((line) => line.text);

describe('Glycerol stock labels', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    glycerolRoute = await import('@app/api/labels/glycerol/route');
    stocksRoute = await import('@app/api/glycerol-stocks/route');
    labelService = new LabelService();
    stockService = new GlycerolStockService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('building payloads', () => {
    it('joins a stock to its plasmid, reproducing CJM1 line for line', async () => {
      const plasmidId = await addPlasmid('pJM0001', 'pMiso000');
      const id = await addStock('CJM1', { plasmidId });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(label).toMatchObject({
        stockId: 'CJM1',
        organism: 'E. coli',
        strain: 'TOP10',
        constructName: 'pMiso000',
        accession: 'pJM0001',
        madeOn: '2024-01-23',
      });
      expect(linesOf(label!)).toEqual(['CJM1', 'E. coli TOP10', 'pMiso000', '23.01.2024']);
    });

    it('falls back to the stock’s own construct when jlab has no plasmid', async () => {
      // The Agrobacterium sheet names constructs that have no plasmid record
      const id = await addStock('AJM7', {
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90',
        constructLabel: 'pPXm_35SprFL-sGeNL(N)',
        madeOn: '2025-03-25',
      });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(label?.constructName).toBe('pPXm_35SprFL-sGeNL(N)');
      expect(label?.accession).toBeNull();
    });

    it('prefers the stock’s own construct name over the plasmid’s', async () => {
      // The two sheets disagree: AJM9 carries pPXm_35SprFL-sGeNL(C) while
      // pJM0152 is named pPXm_35S_sNL(C). The printed label uses the stock's.
      const plasmidId = await addPlasmid('pJM0152', 'pPXm_35S_sNL(C)');
      const id = await addStock('AJM9', {
        plasmidId,
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90 (Goldbio)',
        constructLabel: 'pPXm_35SprFL-sGeNL(C)',
        madeOn: '2025-03-25',
      });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(label?.constructName).toBe('pPXm_35SprFL-sGeNL(C)');
      expect(linesOf(label!)).toEqual([
        'AJM9',
        'A. tumefaciens GV3101 pMP90 (Goldbio)',
        'pPXm_35SprFL-sGeNL(C) (pJM0152)',
        '25.03.2025',
      ]);
    });

    it('falls back to the plasmid name when the stock records none', async () => {
      const plasmidId = await addPlasmid('pJM0001', 'pMiso000');
      const id = await addStock('CJM1', { plasmidId, constructLabel: null });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(label?.constructName).toBe('pMiso000');
    });

    it('spells out the accession for Agrobacterium but not for E. coli', async () => {
      const plasmidId = await addPlasmid('pJM0152', 'pPXm_35SprFL-sGeNL(C)');
      const agro = await addStock('AJM9', {
        plasmidId,
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90',
      });
      const ecoli = await addStock('CJM152', { plasmidId });

      const labels = await labelService.buildGlycerolLabels([agro, ecoli]);
      const byId = (id: string) => linesOf(labels.find((label) => label.id === id)!);

      expect(byId(agro)).toContain('pPXm_35SprFL-sGeNL(C) (pJM0152)');
      expect(byId(ecoli)).toContain('pPXm_35SprFL-sGeNL(C)');
    });

    it('renders a strain-only stock as three lines', async () => {
      const id = await addStock('AJM1', {
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90 (CPGE)',
        madeOn: '2024-06-20',
      });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(linesOf(label!)).toEqual(['AJM1', 'A. tumefaciens GV3101 pMP90 (CPGE)', '20.06.2024']);
    });

    it('orders by stock number, so AJM10 does not come before AJM2', async () => {
      const ten = await addStock('AJM10', { organism: 'A. tumefaciens', strain: 'GV3101' });
      const two = await addStock('AJM2', { organism: 'A. tumefaciens', strain: 'GV3101' });
      const aliquot = await addStock('AJM2.1', { organism: 'A. tumefaciens', strain: 'GV3101' });

      const labels = await labelService.buildGlycerolLabels([ten, two, aliquot]);

      expect(labels.map((label) => label.stockId)).toEqual(['AJM2', 'AJM2.1', 'AJM10']);
    });

    it('prints a reserved number without a date', async () => {
      // CJM355 exists as a number; the stock was never made
      const id = await addStock('CJM355', { madeOn: null });

      const [label] = await labelService.buildGlycerolLabels([id]);

      expect(label?.madeOn).toBeNull();
      expect(linesOf(label!)).toEqual(['CJM355', 'E. coli TOP10']);
    });

    it('rejects an unknown stock rather than printing a short sheet', async () => {
      await expect(labelService.buildGlycerolLabels(['missing'])).rejects.toThrow(/Unknown/);
    });
  });

  describe('GET /api/labels/glycerol', () => {
    it('returns the labels in an envelope', async () => {
      const id = await addStock('CJM1');

      const response = await glycerolRoute.GET(
        asNextRequest(new Request(`http://localhost/api/labels/glycerol?ids=${id}`))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.labels[0].stockId).toBe('CJM1');
    });

    it('400s without ids and 404s for an unknown one', async () => {
      const missingIds = await glycerolRoute.GET(
        asNextRequest(new Request('http://localhost/api/labels/glycerol'))
      );
      expect(missingIds.status).toBe(400);

      const unknown = await glycerolRoute.GET(
        asNextRequest(new Request('http://localhost/api/labels/glycerol?ids=nope'))
      );
      expect(unknown.status).toBe(404);
    });
  });

  describe('recording stocks', () => {
    it('remaking overwrites the date rather than adding a row', async () => {
      // The lab's own model: CJM348, CJM353 and CJM370 each hold one date
      const plasmidId = await addPlasmid('pJM0348', 'pMisoX');
      const id = await addStock('CJM348', { plasmidId, madeOn: '2025-05-28' });

      await stockService.update(id, { madeOn: '2025-07-17' });

      expect(await db('glycerol_stocks').where('stockId', 'CJM348')).toHaveLength(1);
      const [label] = await labelService.buildGlycerolLabels([id]);
      expect(label?.madeOn).toBe('2025-07-17');
    });

    it('refuses a second record for one tube', async () => {
      await addStock('CJM1');

      await expect(
        stockService.create({ stockId: 'CJM1', organism: 'E. coli', strain: 'TOP10' })
      ).rejects.toThrow(/already exists/);
    });

    it('requires an organism and a strain', async () => {
      await expect(
        stockService.create({ stockId: 'CJM9', organism: '', strain: 'TOP10' })
      ).rejects.toThrow(/Organism is required/);
      await expect(
        stockService.create({ stockId: 'CJM9', organism: 'E. coli', strain: '  ' })
      ).rejects.toThrow(/Strain is required/);
    });

    it('refuses a non-ISO made-on date', async () => {
      await expect(
        stockService.create({
          stockId: 'CJM9',
          organism: 'E. coli',
          strain: 'TOP10',
          madeOn: '23.01.2024',
        })
      ).rejects.toThrow(/ISO date/);
    });

    it('lists every stock of the selected plasmids in one query', async () => {
      const first = await addPlasmid('pJM0001', 'pMiso000');
      const second = await addPlasmid('pJM0002', 'pMiso001');
      await addStock('CJM1', { plasmidId: first });
      await addStock('AJM4', {
        plasmidId: first,
        organism: 'A. tumefaciens',
        strain: 'GV3101',
      });
      await addStock('CJM2', { plasmidId: second });

      const stocks = await stockService.listForPlasmids([first, second]);

      expect(stocks.map((stock) => stock.stockId).sort()).toEqual(['AJM4', 'CJM1', 'CJM2']);
    });

    it('lists the whole freezer when no plasmid filter is given', async () => {
      const first = await addPlasmid('pJM0001', 'pMiso000');
      await addStock('CJM1', { plasmidId: first });
      await addStock('AJM4', { plasmidId: null, organism: 'A. tumefaciens', strain: 'GV3101' });

      const stockIdsOf = async (url: string) => {
        const response = await stocksRoute.GET(asNextRequest(new Request(url)));
        expect(response.status).toBe(200);
        const json = await response.json();
        return (json.data.stocks as { stockId: string }[]).map((stock) => stock.stockId);
      };

      expect(await stockIdsOf('http://localhost/api/glycerol-stocks')).toEqual(['AJM4', 'CJM1']);
      expect(await stockIdsOf(`http://localhost/api/glycerol-stocks?plasmidIds=${first}`)).toEqual([
        'CJM1',
      ]);
      // An empty filter is still a filter: an empty selection fetches nothing
      expect(await stockIdsOf('http://localhost/api/glycerol-stocks?plasmidIds=')).toEqual([]);
    });

    it('creates a stock through the route', async () => {
      const plasmidId = await addPlasmid('pJM0005', 'pMiso301');

      const response = await stocksRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/glycerol-stocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stockId: 'CJM5',
              plasmidId,
              organism: 'E. coli',
              strain: 'TOP10',
              madeOn: '2024-01-23',
            }),
          })
        )
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.stockId).toBe('CJM5');
    });

    it('400s on a stock with no ID', async () => {
      const response = await stocksRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/glycerol-stocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stockId: '', organism: 'E. coli', strain: 'TOP10' }),
          })
        )
      );

      expect(response.status).toBe(400);
    });
  });
});
