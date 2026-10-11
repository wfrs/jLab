/**
 * Plasmid table column catalogue (pure, no React).
 *
 * Every column the table can show, in display order, with the lab's own
 * spreadsheet headers. The default set is the lab's "plasmids + E.coli
 * glycerol" sheet; the rest are the v2 record fields. The visible set is a
 * per-browser preference kept in localStorage.
 */

import { GlycerolStock } from '@/domain/types';

export type PlasmidColumnGroup = 'Plasmid' | 'Prep' | 'Glycerol stock' | 'Record';

export interface PlasmidColumnSpec {
  id: PlasmidColumnId;
  /** Header text; the lab's spreadsheet wording where one exists */
  label: string;
  group: PlasmidColumnGroup;
  defaultVisible: boolean;
}

export type PlasmidColumnId =
  | 'name'
  | 'constructName'
  | 'insertName'
  | 'description'
  | 'cassettes'
  | 'category'
  | 'bacterialResistance'
  | 'plantResistance'
  | 'prepConcentration'
  | 'comment'
  | 'sequencingResult'
  | 'sequencingDate'
  | 'box'
  | 'prepDate'
  | 'stockId'
  | 'stockMadeOn'
  | 'stockOrganism'
  | 'stockStrain'
  | 'status'
  | 'sizeBp'
  | 'insertSizeBp'
  | 'backboneVector'
  | 'notes'
  | 'createdAt'
  | 'readiness';

/** The accession identifies the row and anchors paste, so it cannot be hidden */
export const PINNED_COLUMN_ID: PlasmidColumnId = 'name';

export const COLUMN_STORAGE_KEY = 'jlab.plasmids.columns';

export const PLASMID_COLUMNS: readonly PlasmidColumnSpec[] = [
  { id: 'name', label: 'ID', group: 'Plasmid', defaultVisible: true },
  { id: 'constructName', label: 'Name', group: 'Plasmid', defaultVisible: true },
  { id: 'insertName', label: 'Insert', group: 'Plasmid', defaultVisible: true },
  { id: 'description', label: 'Details', group: 'Plasmid', defaultVisible: true },
  { id: 'cassettes', label: 'Cassettes', group: 'Plasmid', defaultVisible: true },
  { id: 'category', label: 'Category', group: 'Plasmid', defaultVisible: true },
  { id: 'bacterialResistance', label: 'Marker bac', group: 'Plasmid', defaultVisible: true },
  { id: 'plantResistance', label: 'Marker plant', group: 'Plasmid', defaultVisible: true },
  { id: 'prepConcentration', label: 'Concentration [ng/µL]', group: 'Prep', defaultVisible: true },
  { id: 'comment', label: 'Comment', group: 'Plasmid', defaultVisible: true },
  {
    id: 'sequencingResult',
    label: 'Sequencing? (ONT/Sanger?)',
    group: 'Plasmid',
    defaultVisible: true,
  },
  { id: 'sequencingDate', label: 'Date sequencing', group: 'Plasmid', defaultVisible: true },
  { id: 'box', label: 'Box', group: 'Plasmid', defaultVisible: true },
  { id: 'prepDate', label: 'Date plasmid', group: 'Prep', defaultVisible: true },
  { id: 'stockId', label: 'Glycerol stock ID', group: 'Glycerol stock', defaultVisible: true },
  {
    id: 'stockMadeOn',
    label: 'Date glycerol stock',
    group: 'Glycerol stock',
    defaultVisible: true,
  },
  { id: 'stockOrganism', label: 'Organism', group: 'Glycerol stock', defaultVisible: true },
  { id: 'stockStrain', label: 'Strain', group: 'Glycerol stock', defaultVisible: true },
  { id: 'status', label: 'Status', group: 'Record', defaultVisible: false },
  { id: 'sizeBp', label: 'Total size [bp]', group: 'Plasmid', defaultVisible: false },
  { id: 'insertSizeBp', label: 'Insert size [bp]', group: 'Plasmid', defaultVisible: false },
  { id: 'backboneVector', label: 'Original vector', group: 'Plasmid', defaultVisible: false },
  { id: 'notes', label: 'Other comment', group: 'Plasmid', defaultVisible: false },
  { id: 'createdAt', label: 'Created', group: 'Record', defaultVisible: false },
  { id: 'readiness', label: 'Formblatt Z', group: 'Record', defaultVisible: false },
];

export const DEFAULT_COLUMN_IDS: readonly PlasmidColumnId[] = PLASMID_COLUMNS.filter(
  (column) => column.defaultVisible
).map((column) => column.id);

const KNOWN_IDS = new Set<string>(PLASMID_COLUMNS.map((column) => column.id));

function isColumnId(value: unknown): value is PlasmidColumnId {
  return typeof value === 'string' && KNOWN_IDS.has(value);
}

/**
 * Restrict to known ids, add the pinned column, and put the result in
 * catalogue order so the table layout never depends on click order.
 */
export function normalizeColumnIds(ids: Iterable<unknown>): PlasmidColumnId[] {
  const wanted = new Set<PlasmidColumnId>([PINNED_COLUMN_ID]);
  for (const id of ids) {
    if (isColumnId(id)) {
      wanted.add(id);
    }
  }
  return PLASMID_COLUMNS.filter((column) => wanted.has(column.id)).map((column) => column.id);
}

/**
 * The stored preference, or null when there is none or it is unreadable
 * (then the default set applies).
 */
export function parseStoredColumns(raw: string | null): PlasmidColumnId[] | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeColumnIds(parsed) : null;
  } catch {
    return null;
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Browser storage can be absent or throw (private mode); never let that break the table */
export function loadVisibleColumns(storage: StorageLike | null | undefined): PlasmidColumnId[] {
  try {
    return (
      parseStoredColumns(storage?.getItem(COLUMN_STORAGE_KEY) ?? null) ?? [...DEFAULT_COLUMN_IDS]
    );
  } catch {
    return [...DEFAULT_COLUMN_IDS];
  }
}

export function saveVisibleColumns(
  storage: StorageLike | null | undefined,
  ids: readonly PlasmidColumnId[]
): void {
  try {
    storage?.setItem(COLUMN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // The choice still applies for this page view
  }
}

/**
 * The stock the "Glycerol stock" columns show for each plasmid. E. coli
 * stocks mirror plasmids one-to-one (the spreadsheet's columns), so one is
 * preferred over an Agrobacterium stock; among several, the lowest stock id
 * wins. Expects the stocks in stock-id order, as the API returns them.
 */
export function primaryStockByPlasmid(
  stocks: readonly GlycerolStock[]
): Map<string, GlycerolStock> {
  const byPlasmid = new Map<string, GlycerolStock>();
  const isEColi = (stock: GlycerolStock) => /^e\.?\s*coli/i.test(stock.organism);
  for (const stock of stocks) {
    if (!stock.plasmidId) {
      continue;
    }
    const current = byPlasmid.get(stock.plasmidId);
    if (!current || (isEColi(stock) && !isEColi(current))) {
      byPlasmid.set(stock.plasmidId, stock);
    }
  }
  return byPlasmid;
}
