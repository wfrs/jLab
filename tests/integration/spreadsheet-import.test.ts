/**
 * Spreadsheet import — integration tests against the lab's real workbook.
 *
 * The file is the authoritative record, so these tests double as a contract:
 * if a future export breaks one of the invariants below, the import fails
 * loudly rather than drifting.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Knex } from 'knex';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { SpreadsheetImportService } from '@services/spreadsheet-import.service';
import { derivedStockId } from '@domain/lab-normalization';
import { DataQualityService } from '@services/data-quality.service';
import { GlycerolStockRepository } from '@services/glycerol-stock.repository';

const WORKBOOK = join(process.cwd(), 'gmocu', 'example', 'plasmids_JM_expanded.xlsx');

describe('SpreadsheetImportService', () => {
  let db: Knex;
  let service: SpreadsheetImportService;
  let workbook: Buffer;

  beforeAll(async () => {
    workbook = readFileSync(WORKBOOK);
    db = createTestDb();
    await createTestSchema(db);
    setQueryBuilder(db);
    service = new SpreadsheetImportService();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('inspectWorkbook', () => {
    it('reports the three sheets without writing anything', async () => {
      const inspection = await service.inspectWorkbook(workbook);

      expect(inspection.sheets).toEqual(
        expect.arrayContaining(['plasmids + E.coli glycerol', 'Glycerol Agro', 'parts'])
      );
      expect(inspection.plasmidRows).toBe(405);
      expect(inspection.namedPlasmids).toBe(390);
      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 0 });
    });

    it('rejects a file that is not a workbook', async () => {
      await expect(service.inspectWorkbook(Buffer.from('not a workbook'))).rejects.toThrow(
        /readable .xlsx/
      );
    });
  });

  describe('importWorkbook', () => {
    it('imports the named plasmids and skips numbers reserved ahead of use', async () => {
      const result = await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      expect(result.plasmids.added).toBe(390);
      expect(result.plasmids.skippedReserved).toBe(15);
      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 390 });

      const first = await db('plasmids').where('name', 'pJM0001').first();
      expect(first).toMatchObject({
        name: 'pJM0001',
        constructName: 'pMiso000',
        sizeBp: 3823,
        category: 'EV',
        bacterialResistance: 'Kan',
        box: 1,
      });
    });

    /**
     * The invariant the whole design leans on: an E. coli stock ID is the
     * plasmid number with a C prefix. Verified across every stock-bearing row.
     */
    it('finds no stock ID that disagrees with its plasmid number', async () => {
      const result = await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      expect(result.stockIdMismatches).toEqual([]);

      const stocks = (await db('glycerol_stocks')
        .join('plasmids', 'glycerol_stocks.plasmidId', 'plasmids.id')
        .whereLike('glycerol_stocks.stockId', 'C%')
        .select('glycerol_stocks.stockId', 'plasmids.name')) as Array<{
        stockId: string;
        name: string;
      }>;

      // 404 rows carry a stock ID, but 15 of them sit on reserved plasmid
      // numbers that are skipped along with their stock.
      expect(stocks.length).toBe(389);
      for (const stock of stocks) {
        expect(stock.stockId).toBe(derivedStockId(stock.name));
      }
    });

    it('leaves pJM0021 without an E. coli stock, because its stock is Agrobacterium', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const plasmid = await db('plasmids').where('name', 'pJM0021').first();
      expect(plasmid.constructName).toBe('pMisoG (virGN54D)');

      const coli = await db('glycerol_stocks')
        .where('plasmidId', plasmid.id)
        .whereLike('stockId', 'C%')
        .first();
      expect(coli).toBeUndefined();

      const agro = await db('glycerol_stocks').where('stockId', 'AJM24').first();
      expect(agro).toMatchObject({ plasmidId: plasmid.id, strain: 'AS109' });
    });

    /**
     * The sheet is authoritative even where it disagrees with a printed label,
     * so the import must not "correct" it. AJM24 records strain AS109 under
     * A. tumefaciens, while AJM20, AJM21 and AJM38 all pair AS109 with
     * A. rhizogenes and the printed label reads A. rhizogenes.
     *
     * Import what the sheet says; let a data-quality check raise it.
     */
    it('imports an organism that contradicts its strain rather than correcting it', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const organismsForAs109 = (await db('glycerol_stocks')
        .where('strain', 'AS109')
        .distinct('organism')
        .pluck('organism')) as string[];

      expect(organismsForAs109.sort()).toEqual(['A. rhizogenes', 'A. tumefaciens']);
      expect(await db('glycerol_stocks').where('stockId', 'AJM24').first()).toMatchObject({
        organism: 'A. tumefaciens',
      });
    });

    it('keeps the strain provenance the Agrobacterium sheet records', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      // Reaches the printed label as '(Tübingen; #1)'.
      const stock = await db('glycerol_stocks').where('stockId', 'AJM20').first();
      expect(stock.sourceNote).toMatch(/Tübingen/);
    });

    it('imports planned plasmids with a reserved stock and no prep', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      for (const accession of ['pJM0355', 'pJM0356']) {
        const plasmid = await db('plasmids').where('name', accession).first();
        expect(plasmid.comment).toBe('not designed yet');

        // No prep means the plasmid does not physically exist — the app
        // derives "planned" from this rather than storing a status.
        const preps = await db('plasmid_preps').where('plasmidId', plasmid.id);
        expect(preps).toHaveLength(0);

        const stock = await db('glycerol_stocks')
          .where('stockId', derivedStockId(accession)!)
          .first();
        expect(stock.madeOn).toBeNull();
      }
    });

    it('creates one prep per plasmid that has been made', async () => {
      const result = await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      expect(result.preps.added).toBe(387);

      const plasmid = await db('plasmids').where('name', 'pJM0001').first();
      const prep = await db('plasmid_preps').where('plasmidId', plasmid.id).first();
      expect(prep).toMatchObject({
        preppedOn: '2024-01-31',
        operatorInitials: 'JM',
        concentrationNgUl: 80,
      });
    });

    it('records Agrobacterium stocks obtained from other people without a plasmid link', async () => {
      const result = await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      expect(result.externalStocks).toHaveLength(6);

      const stock = await db('glycerol_stocks').where('stockId', 'AJM16').first();
      expect(stock.externalSource).toBe('Tobi');
      expect(stock.plasmidId).toBeNull();
    });

    it('links Agrobacterium aliquots to their parent stock', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      for (const [child, parent] of [
        ['AJM5.1', 'AJM5'],
        ['AJM5.2', 'AJM5'],
        ['AJM22.1', 'AJM22'],
      ]) {
        const stock = await db('glycerol_stocks').where('stockId', child).first();
        expect(stock.parentStockId).toBe(parent);
      }

      const plain = await db('glycerol_stocks').where('stockId', 'AJM5').first();
      expect(plain.parentStockId).toBeNull();
    });

    it('normalizes every spelling of the resistance column', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const values = (await db('plasmids')
        .distinct('bacterialResistance')
        .whereNotNull('bacterialResistance')
        .pluck('bacterialResistance')) as string[];

      // 14 spellings in the sheet collapse to a handful of canonical values.
      expect(values.length).toBeLessThanOrEqual(6);
      for (const value of values) {
        expect(value).not.toMatch(/bac/i);
        expect(value).not.toMatch(/\?\?/);
      }
      expect(values).toEqual(expect.arrayContaining(['Kan', 'Amp', 'Spec']));
    });

    it('keeps the uncertainty marker the author wrote', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const plasmid = await db('plasmids').where('name', 'pJM0117').first();
      expect(plasmid.bacterialResistance).toBe('Kan?');
    });

    it('never imports the three columns the lab asked us to drop', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const columns = Object.keys(await db('plasmids').first());
      expect(columns).not.toContain('column1');
      expect(columns).not.toContain('column2');
      expect(columns).not.toContain('comment3');
    });

    it('preserves the lab notes that flag their own data problems', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      const plasmid = await db('plasmids').where('name', 'pJM0018').first();
      expect(plasmid.notes).toMatch(/dates arent correct/i);
    });

    /**
     * The point of importing as-is: the spreadsheet's own prose notes become
     * structured findings instead of being cleaned away by hand.
     */
    describe('data-quality findings on the imported data', () => {
      let checks: Map<string, string[]>;

      beforeEach(async () => {
        await service.importWorkbook(workbook, { operatorInitials: 'JM' });
        const report = await new DataQualityService().runChecks();
        checks = new Map(report.checks.map((check) => [check.id, check.items]));
      });

      it('flags the two plasmids the lab noted as not designed yet', () => {
        const items = checks.get('plasmid-never-prepped') ?? [];
        expect(items).toHaveLength(2);
        expect(items.join(' ')).toContain('pJM0355');
        expect(items.join(' ')).toContain('pJM0356');
        // The lab's own words are carried through, not paraphrased.
        expect(items.join(' ')).toContain('not designed yet');
      });

      it('flags the rows whose notes say the dates are wrong', () => {
        const items = checks.get('plasmid-flagged-in-notes') ?? [];
        expect(items.join(' ')).toMatch(/pJM0018/);
        expect(items.join(' ')).toMatch(/pJM0019/);
      });

      it('flags the single uncertain resistance value', () => {
        const items = checks.get('resistance-uncertain') ?? [];
        expect(items).toHaveLength(1);
        expect(items[0]).toContain('pJM0117');
      });

      it('flags the strain recorded under two organisms', () => {
        const items = checks.get('strain-organism-conflict') ?? [];
        expect(items).toEqual(['AS109: A. rhizogenes / A. tumefaciens']);
      });

      it('does not flag the 388 plasmids that were genuinely made', () => {
        // A plasmid with a prep is real; only reserved-and-unmade ones show up.
        expect(checks.get('plasmid-never-prepped')).toHaveLength(2);
      });
    });

    describe('reading the imported stocks back', () => {
      beforeEach(async () => {
        await service.importWorkbook(workbook, { operatorInitials: 'JM' });
      });

      it('finds a stock by the lab identifier printed on the label', async () => {
        const stock = await new GlycerolStockRepository().getByStockId('CJM1');
        expect(stock).toMatchObject({ organism: 'E. coli', strain: 'TOP10', madeOn: '2024-01-23' });
      });

      it('lists every stock made from one plasmid', async () => {
        const plasmid = await db('plasmids').where('name', 'pJM0051').first();
        const stocks = await new GlycerolStockRepository().listByPlasmid(plasmid.id);

        // pJM0051 has both an E. coli stock and two Agrobacterium ones.
        expect(stocks.map((s) => s.stockId).sort()).toEqual(['AJM38', 'AJM4', 'CJM51']);
      });
    });

    it('is idempotent — a second import updates rather than duplicating', async () => {
      await service.importWorkbook(workbook, { operatorInitials: 'JM' });
      const second = await service.importWorkbook(workbook, { operatorInitials: 'JM' });

      expect(second.plasmids.added).toBe(0);
      expect(second.plasmids.updated).toBe(390);
      expect(second.preps.added).toBe(0);
      expect(second.stocks.added).toBe(0);

      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 390 });
      expect(await db('plasmid_preps').count({ c: '*' }).first()).toMatchObject({ c: 387 });
    });
  });
});
