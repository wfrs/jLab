/**
 * Unit Tests: plasmid table column catalogue (pure logic)
 */

import {
  COLUMN_STORAGE_KEY,
  DEFAULT_COLUMN_IDS,
  loadVisibleColumns,
  normalizeColumnIds,
  parseStoredColumns,
  PLASMID_COLUMNS,
  primaryStockByPlasmid,
  saveVisibleColumns,
} from '@/components/plasmids/plasmid-columns';
import { GlycerolStock } from '@/domain/types';

/** The lab's spreadsheet columns, in sheet order, plus Cassettes after Details */
const LAB_SHEET_LABELS = [
  'ID',
  'Name',
  'Insert',
  'Details',
  'Cassettes',
  'Category',
  'Marker bac',
  'Marker plant',
  'Concentration [ng/µL]',
  'Comment',
  'Sequencing? (ONT/Sanger?)',
  'Date sequencing',
  'Box',
  'Date plasmid',
  'Glycerol stock ID',
  'Date glycerol stock',
  'Organism',
  'Strain',
];

function stock(overrides: Partial<GlycerolStock> & { stockId: string }): GlycerolStock {
  return {
    id: overrides.stockId,
    organism: 'E. coli',
    strain: 'TOP10',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('plasmid-columns', () => {
  describe('catalogue', () => {
    it('defaults to the lab sheet columns in sheet order', () => {
      const labels = DEFAULT_COLUMN_IDS.map(
        (id) => PLASMID_COLUMNS.find((column) => column.id === id)?.label
      );
      expect(labels).toEqual(LAB_SHEET_LABELS);
    });

    it('has unique ids', () => {
      const ids = PLASMID_COLUMNS.map((column) => column.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('normalizeColumnIds', () => {
    it('orders by the catalogue regardless of click order', () => {
      expect(normalizeColumnIds(['status', 'box', 'name'])).toEqual(['name', 'box', 'status']);
    });

    it('always includes the pinned ID column', () => {
      expect(normalizeColumnIds([])).toEqual(['name']);
      expect(normalizeColumnIds(['comment'])).toEqual(['name', 'comment']);
    });

    it('drops unknown and non-string entries', () => {
      expect(normalizeColumnIds(['name', 'bogus', 42, null, 'box'])).toEqual(['name', 'box']);
    });
  });

  describe('parseStoredColumns', () => {
    it('returns null for nothing stored, bad JSON, or a non-array', () => {
      expect(parseStoredColumns(null)).toBeNull();
      expect(parseStoredColumns('{not json')).toBeNull();
      expect(parseStoredColumns('{"a":1}')).toBeNull();
    });

    it('reads a stored list', () => {
      expect(parseStoredColumns('["box","name"]')).toEqual(['name', 'box']);
    });
  });

  describe('storage round trip', () => {
    it('falls back to the defaults without storage or with a throwing one', () => {
      expect(loadVisibleColumns(null)).toEqual(DEFAULT_COLUMN_IDS);
      const broken = {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      };
      expect(loadVisibleColumns(broken)).toEqual(DEFAULT_COLUMN_IDS);
      expect(() => saveVisibleColumns(broken, ['name'])).not.toThrow();
    });

    it('saves under the storage key and loads it back', () => {
      const store = new Map<string, string>();
      const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      };

      saveVisibleColumns(storage, ['name', 'status']);

      expect(store.has(COLUMN_STORAGE_KEY)).toBe(true);
      expect(loadVisibleColumns(storage)).toEqual(['name', 'status']);
    });
  });

  describe('primaryStockByPlasmid', () => {
    it('prefers the E. coli stock over an Agrobacterium one', () => {
      const stocks = [
        stock({ stockId: 'AJM4', plasmidId: 'p1', organism: 'A. tumefaciens', strain: 'GV3101' }),
        stock({ stockId: 'CJM1', plasmidId: 'p1' }),
      ];
      expect(primaryStockByPlasmid(stocks).get('p1')?.stockId).toBe('CJM1');
    });

    it('keeps the first stock in id order when none is E. coli', () => {
      const stocks = [
        stock({ stockId: 'AJM4', plasmidId: 'p1', organism: 'A. tumefaciens' }),
        stock({ stockId: 'AJM9', plasmidId: 'p1', organism: 'A. rhizogenes' }),
      ];
      expect(primaryStockByPlasmid(stocks).get('p1')?.stockId).toBe('AJM4');
    });

    it('ignores stocks that carry no plasmid', () => {
      expect(primaryStockByPlasmid([stock({ stockId: 'AJM1', strain: 'GV3101' })]).size).toBe(0);
    });
  });
});
