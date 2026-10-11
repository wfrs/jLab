'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cassette, GlycerolStock, Plasmid, PlasmidPrep } from '@/domain/types';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PlasmidStatusBadge } from '@/components/plasmids/PlasmidStatusBadge';
import { CellNavDirection, EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import {
  cellsOfRow,
  focusNeighborCell,
  handleGridKeyDown,
  locateCell,
} from '@/components/ui/grid-navigation';
import { buildRowCreate, buildRowPatch, parsePasteText } from '@/components/plasmids/paste-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PlasmidDetailPanel } from '@/components/plasmids/PlasmidDetailPanel';
import {
  createCassette,
  createPlasmid,
  deleteCassette,
  deletePlasmid,
  duplicatePlasmid,
  fetchPlasmidReadiness,
  listAllCassettes,
  listPlasmids,
  updateCassette,
  updatePlasmid,
  UpdatePlasmidPayload,
} from '@/components/plasmids/api-client';
import { PlasmidReadinessCell } from '@/components/plasmids/PlasmidReadinessCell';
import type { PlasmidReadiness } from '@/services/data-quality.service';
import { RecordPrepDialog } from '@/components/plasmids/RecordPrepDialog';
import { ColumnPicker } from '@/components/plasmids/ColumnPicker';
import { CassetteCell } from '@/components/plasmids/CassetteCell';
import {
  CassetteOption,
  cassetteOptions,
  groupCassettesByPlasmid,
  joinCassetteContents,
} from '@/components/plasmids/cassette-options';
import { listGlossaryFeatures } from '@/components/glossary/api-client';
import {
  loadVisibleColumns,
  normalizeColumnIds,
  PLASMID_COLUMNS,
  PlasmidColumnId,
  primaryStockByPlasmid,
  saveVisibleColumns,
} from '@/components/plasmids/plasmid-columns';
import {
  listAllGlycerolStocks,
  listGlycerolStocks,
  listLatestPreps,
  stashLabelSelection,
} from '@/components/labels/api-client';

/** Debounce for the search box (ms) */
const SEARCH_DEBOUNCE_MS = 300;

/** Default name prefix for newly created plasmids */
const NEW_PLASMID_PREFIX = 'Untitled-';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'validated', label: 'Validated' },
  { value: 'archived', label: 'Archived' },
];

/** Nullable free-text plasmid fields edited inline; an emptied cell clears them */
type LabTextField =
  | 'constructName'
  | 'insertName'
  | 'category'
  | 'bacterialResistance'
  | 'plantResistance'
  | 'sequencingResult'
  | 'sequencingDate'
  | 'comment'
  | 'notes'
  | 'backboneVector';

type SortValue = string | number | null | undefined;

const COLUMN_LABEL = Object.fromEntries(
  PLASMID_COLUMNS.map((column) => [column.id, column.label])
) as Record<PlasmidColumnId, string>;

/** Read-only cell for values that live on another record (prep, stock) */
function DerivedCell({ value }: { value: string | number | null | undefined }): JSX.Element {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }
  return <span>{String(value)}</span>;
}

/**
 * Plasmids Page
 * Spreadsheet-first plasmid management: inline cell editing with autosave,
 * synced detail panel, create/delete (UI/UX direction, locked for v1).
 */
export default function PlasmidsPage() {
  const router = useRouter();
  const [plasmids, setPlasmids] = useState<Plasmid[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortedBy, setSortedBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [readiness, setReadiness] = useState<Map<string, PlasmidReadiness>>(new Map());
  const [isPrepDialogOpen, setIsPrepDialogOpen] = useState(false);
  const [operatorInitials, setOperatorInitials] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<PlasmidColumnId[]>(() =>
    normalizeColumnIds(PLASMID_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id))
  );
  const [latestPreps, setLatestPreps] = useState<Map<string, PlasmidPrep>>(new Map());
  const [stocksByPlasmid, setStocksByPlasmid] = useState<Map<string, GlycerolStock>>(new Map());
  const [cassettesByPlasmid, setCassettesByPlasmid] = useState<Map<string, Cassette[]>>(new Map());
  const [cassetteChoices, setCassetteChoices] = useState<CassetteOption[]>([]);
  const [annotations, setAnnotations] = useState<Set<string>>(new Set());

  // Glossary annotations flag unknown features in cassette chips and options
  useEffect(() => {
    listGlossaryFeatures()
      .then((features) => setAnnotations(new Set(features.map((f) => f.annotation))))
      .catch(() => setAnnotations(new Set()));
  }, []);

  // The column choice is a per-browser preference; read after mount so the
  // server render and the first client render agree
  useEffect(() => {
    setVisibleColumns(loadVisibleColumns(window.localStorage));
  }, []);

  const changeVisibleColumns = (next: PlasmidColumnId[]) => {
    const normalized = normalizeColumnIds(next);
    setVisibleColumns(normalized);
    saveVisibleColumns(window.localStorage, normalized);
  };

  /**
   * Prep, glycerol stock and cassette columns come from their own records.
   * Loaded on mount and again when something that writes them finishes (the
   * prep dialog, the detail panel with its stock and cassette sections, the
   * table's own cassette picker).
   */
  const refreshDerivedColumns = useCallback(async () => {
    try {
      const [preps, stocks, cassettes] = await Promise.all([
        listLatestPreps(),
        listAllGlycerolStocks(),
        listAllCassettes(),
      ]);
      setLatestPreps(new Map(preps.map((prep) => [prep.plasmidId, prep])));
      setStocksByPlasmid(primaryStockByPlasmid(stocks));
      setCassettesByPlasmid(groupCassettesByPlasmid(cassettes));
      setCassetteChoices(cassetteOptions(cassettes));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prep and stock columns');
    }
  }, []);

  useEffect(() => {
    void refreshDerivedColumns();
  }, [refreshDerivedColumns]);

  // Initials are printed on every label, so the prep dialog opens pre-filled
  // from Settings rather than asking again each session
  useEffect(() => {
    const loadInitials = async () => {
      try {
        const response = await fetch('/api/settings');
        const json = (await response.json()) as { data?: { initials?: string } };
        setOperatorInitials(json.data?.initials ?? '');
      } catch {
        // Advisory only — the dialog still lets the initials be typed
      }
    };
    void loadInitials();
  }, []);

  /**
   * Formblatt-Z readiness per row. Refreshed on mount and whenever an edit
   * that can change it lands (cassettes, GMOs and the original vector are
   * all edited in the detail panel, so closing it is the trigger); plain
   * table edits (name/description/size/status) cannot affect readiness.
   */
  const refreshReadiness = useCallback(async () => {
    try {
      const entries = await fetchPlasmidReadiness();
      setReadiness(new Map(entries.map((entry) => [entry.plasmidId, entry])));
    } catch {
      // Readiness is advisory — a failure must not break the table
      setReadiness(new Map());
    }
  }, []);

  // Fetch plasmids from API (debounced on search)
  useEffect(() => {
    const fetchPlasmids = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await listPlasmids(searchQuery || undefined);
        setPlasmids(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plasmids');
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchPlasmids, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  /**
   * Autosave: PATCH one or more fields, then sync the row with the server
   * response. Failures surface in the page banner AND rethrow so the calling
   * cell/panel can show the inline error.
   */
  const saveField = useCallback(async (id: string, patch: UpdatePlasmidPayload) => {
    try {
      const updated = await updatePlasmid(id, patch);
      setPlasmids((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save change');
      throw err;
    }
  }, []);

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      setError(null);

      // Next free "Untitled-N" among loaded rows; server enforces uniqueness
      const maxSuffix = plasmids.reduce((max, p) => {
        const match = p.name.match(new RegExp(`^${NEW_PLASMID_PREFIX}(\\d+)$`));
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);

      const created = await createPlasmid({
        name: `${NEW_PLASMID_PREFIX}${maxSuffix + 1}`,
        status: 'draft',
      });

      setPlasmids((prev) => [created, ...prev]);
      void refreshReadiness();
      setActiveId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plasmid');
    } finally {
      setIsCreating(false);
    }
  };

  /** Spreadsheet navigation: EditableCell hands off after Enter/Tab commits */
  const handleCellNavigate = useCallback((direction: CellNavDirection, from: HTMLElement) => {
    focusNeighborCell(from, direction);
  }, []);

  /** Arrow/Home/End navigation and Ctrl+C copy on display-mode cells */
  const handleGridKeys = (event: React.KeyboardEvent) => {
    if (handleGridKeyDown(event)) {
      event.preventDefault();
    }
  };

  /**
   * Clipboard paste onto a display-mode cell: a TSV block fills existing
   * rows downward and editable columns rightward from the anchor cell
   * (one PATCH per row). Rows past the last table row become NEW plasmids
   * (one POST per row, aligned to the same columns as the anchor row) —
   * a pasted row needs a name to be created. Columns past the grid edge
   * are still ignored and counted.
   */
  const handleGridPaste = async (event: React.ClipboardEvent) => {
    const anchor = (event.target as HTMLElement).closest?.('[data-editable-cell]');
    if (!(anchor instanceof HTMLElement)) return;
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    event.preventDefault();

    const position = locateCell(anchor);
    if (!position) return;

    const grid = parsePasteText(text);
    const failures: string[] = [];
    const createdRows: Plasmid[] = [];
    let cellsApplied = 0;
    let rowsTouched = 0;
    let overflow = 0;
    let cassettesAdded = 0;

    /** Pasted cassette contents become cassette records; returns how many landed */
    const addPastedCassettes = async (
      plasmidId: string,
      rowLabel: string,
      contents: string[]
    ): Promise<number> => {
      let added = 0;
      for (const content of contents) {
        try {
          await createCassette(plasmidId, { name: content, type: 'other' });
          added += 1;
        } catch (err) {
          failures.push(`${rowLabel}: ${err instanceof Error ? err.message : 'cassette failed'}`);
        }
      }
      return added;
    };

    // Overflow rows have no row element to read columns from; every row
    // shares the anchor row's layout, so align against that once.
    const anchorRowCells = cellsOfRow(position.row);
    const columnIdsFor = (rowCells: HTMLElement[], cells: string[]): (string | null)[] =>
      cells.map((_cell, c) => {
        const cellElement = rowCells[position.colIndex + c];
        if (!cellElement) {
          overflow += 1;
          return null;
        }
        return cellElement.getAttribute('data-col');
      });

    for (let r = 0; r < grid.length; r++) {
      const row = position.rows[position.rowIndex + r];

      if (!row) {
        // Below the table: this row becomes a new plasmid
        const { payload, cassettes, errors } = buildRowCreate(
          columnIdsFor(anchorRowCells, grid[r]),
          grid[r]
        );
        const rowLabel = payload?.name ?? `pasted row ${r + 1}`;
        errors.forEach((message) => failures.push(`${rowLabel}: ${message}`));
        if (payload) {
          try {
            const created = await createPlasmid(payload);
            createdRows.push(created);
            cassettesAdded += await addPastedCassettes(created.id, rowLabel, cassettes);
          } catch (err) {
            failures.push(`${rowLabel}: ${err instanceof Error ? err.message : 'create failed'}`);
          }
        }
        continue;
      }

      const id = row.getAttribute('data-row-key');
      if (!id) continue;

      const { patch, cassettes, errors } = buildRowPatch(
        columnIdsFor(cellsOfRow(row), grid[r]),
        grid[r]
      );
      const rowName = plasmids.find((p) => p.id === id)?.name ?? id;
      errors.forEach((message) => failures.push(`${rowName}: ${message}`));

      let rowChanged = false;
      if (Object.keys(patch).length > 0) {
        try {
          await saveField(id, patch);
          cellsApplied += Object.keys(patch).length;
          rowChanged = true;
        } catch (err) {
          failures.push(`${rowName}: ${err instanceof Error ? err.message : 'save failed'}`);
        }
      }
      const added = await addPastedCassettes(id, rowName, cassettes);
      if (added > 0) {
        cassettesAdded += added;
        cellsApplied += 1;
        rowChanged = true;
      }
      if (rowChanged) rowsTouched += 1;
    }

    if (createdRows.length > 0) {
      // They were pasted below the table, so that is where they appear
      setPlasmids((prev) => [...prev, ...createdRows]);
      void refreshReadiness();
    }
    if (cassettesAdded > 0) {
      afterCassetteChange();
    }

    const summary: string[] = [];
    if (cellsApplied > 0) {
      summary.push(
        `Pasted ${cellsApplied} cell${cellsApplied !== 1 ? 's' : ''} into ${rowsTouched} row${rowsTouched !== 1 ? 's' : ''}`
      );
    }
    if (createdRows.length > 0) {
      summary.push(`Created ${createdRows.length} plasmid${createdRows.length !== 1 ? 's' : ''}`);
    }
    if (overflow > 0) {
      summary.push(`${overflow} cell${overflow !== 1 ? 's' : ''} beyond the last column ignored`);
    }
    setNotice(summary.length > 0 ? summary.join(' · ') : null);
    setError(failures.length > 0 ? failures.join('; ') : null);
  };

  /** Copy the selected rows to the clipboard as TSV (name, description, size, status) */
  const handleCopySelected = async () => {
    const rows = sortedPlasmids.filter((p) => selectedRows.has(p.id));
    const tsv = rows
      .map((p) => [p.name, p.description ?? '', p.sizeBp ?? '', p.status].join('\t'))
      .join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setNotice(`Copied ${rows.length} row${rows.length !== 1 ? 's' : ''} to the clipboard`);
      setError(null);
    } catch {
      setError('Clipboard access was blocked by the browser');
    }
  };

  /** Duplicate the active plasmid and select the new copy */
  const handleDuplicate = async (id: string) => {
    try {
      setError(null);
      const copy = await duplicatePlasmid(id);
      setPlasmids((prev) => [copy, ...prev]);
      void refreshReadiness();
      setActiveId(copy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate plasmid');
    }
  };

  /**
   * Print the selection. Accession order rather than selection order, because
   * a cut-up sheet gets filed into boxes in accession order. The ids travel in
   * sessionStorage: 400 UUIDs would overflow a query string.
   */
  const handlePrintLabels = () => {
    const ids = sortedPlasmids.filter((p) => selectedRows.has(p.id)).map((p) => p.id);
    if (ids.length === 0) {
      return;
    }
    stashLabelSelection(ids);
    // Same tab: a new one opened with noopener gets a fresh sessionStorage, and
    // without noopener it keeps a handle on this page for no benefit. Back
    // returns to the selection.
    router.push(`/labels/print?kind=plasmid&n=${ids.length}`);
  };

  /**
   * Print the glycerol stock labels for the selected plasmids. The stocks are
   * resolved server-side rather than assumed: a plasmid may have an
   * Agrobacterium stock, several, or none.
   */
  const handlePrintStockLabels = async () => {
    const plasmidIds = sortedPlasmids.filter((p) => selectedRows.has(p.id)).map((p) => p.id);
    if (plasmidIds.length === 0) {
      return;
    }
    try {
      const stocks = await listGlycerolStocks(plasmidIds);
      if (stocks.length === 0) {
        setNotice('None of the selected plasmids has a glycerol stock recorded.');
        return;
      }
      stashLabelSelection(stocks.map((stock) => stock.id));
      router.push(`/labels/print?kind=glycerol&n=${stocks.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load glycerol stocks');
    }
  };

  /**
   * Golden Gate dilutions for the selected plasmids. Sizes and concentrations
   * are already recorded, so the parts sheet's retyping is unnecessary.
   */
  const handleGoldenGate = () => {
    const ids = sortedPlasmids.filter((p) => selectedRows.has(p.id)).map((p) => p.id);
    if (ids.length === 0) {
      return;
    }
    stashLabelSelection(ids);
    router.push(`/tools/golden-gate?n=${ids.length}`);
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedRows);
    const confirmed = window.confirm(
      `Delete ${ids.length} plasmid${ids.length !== 1 ? 's' : ''}? Related cassettes, primers, and features are deleted too. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    const failures: string[] = [];

    for (const id of ids) {
      try {
        await deletePlasmid(id);
        setPlasmids((prev) => prev.filter((p) => p.id !== id));
        setSelectedRows((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (activeId === id) {
          setActiveId(null);
        }
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `Failed to delete ${id}`);
      }
    }

    if (failures.length > 0) {
      setError(failures.join('; '));
    }
    void refreshReadiness();
    setIsDeleting(false);
  };

  /** What a column sorts by; derived columns read their own record */
  const sortValueOf = useCallback(
    (plasmid: Plasmid, columnId: string): SortValue => {
      switch (columnId as PlasmidColumnId) {
        case 'prepConcentration':
          return latestPreps.get(plasmid.id)?.concentrationNgUl;
        case 'prepDate':
          return latestPreps.get(plasmid.id)?.preppedOn;
        case 'stockId':
          return stocksByPlasmid.get(plasmid.id)?.stockId;
        case 'stockMadeOn':
          return stocksByPlasmid.get(plasmid.id)?.madeOn;
        case 'stockOrganism':
          return stocksByPlasmid.get(plasmid.id)?.organism;
        case 'stockStrain':
          return stocksByPlasmid.get(plasmid.id)?.strain;
        case 'cassettes':
          return joinCassetteContents(cassettesByPlasmid.get(plasmid.id) ?? []);
        case 'readiness':
          return readiness.get(plasmid.id)?.level;
        default: {
          const value = plasmid[columnId as keyof Plasmid];
          return typeof value === 'string' || typeof value === 'number' ? value : null;
        }
      }
    },
    [latestPreps, stocksByPlasmid, cassettesByPlasmid, readiness]
  );

  // Sort plasmids (client-side); empty values sort last in either direction
  const sortedPlasmids = useMemo(() => {
    if (!sortedBy) return plasmids;
    const sign = sortDirection === 'asc' ? 1 : -1;
    return [...plasmids].sort((a, b) => {
      const aVal = sortValueOf(a, sortedBy);
      const bVal = sortValueOf(b, sortedBy);
      const aEmpty = aVal === null || aVal === undefined || aVal === '';
      const bEmpty = bVal === null || bVal === undefined || bVal === '';
      if (aEmpty || bEmpty) {
        return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sign * (aVal - bVal);
      }
      return sign * String(aVal).localeCompare(String(bVal));
    });
  }, [plasmids, sortedBy, sortDirection, sortValueOf]);

  const activePlasmid = activeId ? plasmids.find((p) => p.id === activeId) || null : null;

  /**
   * Cassette edits from the table. Cassettes are their own records, so the
   * row is not patched; the derived columns and readiness (cassette tokens
   * feed Formblatt Z) reload afterwards. Errors rethrow so the picker can
   * show them inline.
   */
  const afterCassetteChange = useCallback(() => {
    void refreshDerivedColumns();
    void refreshReadiness();
  }, [refreshDerivedColumns, refreshReadiness]);

  const addCassette = async (plasmidId: string, content: string) => {
    try {
      await createCassette(plasmidId, { name: content, type: 'other' });
      setError(null);
      afterCassetteChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cassette');
      throw err;
    }
  };

  const replaceCassette = async (cassette: Cassette, content: string) => {
    try {
      await updateCassette(cassette.id, { name: content });
      setError(null);
      afterCassetteChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change cassette');
      throw err;
    }
  };

  const removeCassette = async (cassette: Cassette) => {
    if (!window.confirm(`Delete cassette "${cassette.name}"? This cannot be undone.`)) return;
    try {
      await deleteCassette(cassette.id);
      setError(null);
      afterCassetteChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cassette');
    }
  };

  // Table columns — editable cells commit through saveField (autosave).
  // Every catalogue column is defined; the ColumnPicker chooses which show.
  const textCell = (plasmid: Plasmid, field: LabTextField, mono = false) => (
    <EditableCell
      value={plasmid[field] ?? null}
      colId={field}
      mono={mono}
      onNavigate={handleCellNavigate}
      ariaLabel={`${COLUMN_LABEL[field]} of ${plasmid.name}`}
      onCommit={(value: EditableCellValue) => {
        const text = value === null ? '' : String(value).trim();
        return saveField(plasmid.id, { [field]: text === '' ? null : text });
      }}
    />
  );

  const numberCell = (plasmid: Plasmid, field: 'insertSizeBp' | 'box') => (
    <EditableCell
      value={plasmid[field] ?? null}
      type="number"
      mono
      colId={field}
      onNavigate={handleCellNavigate}
      ariaLabel={`${COLUMN_LABEL[field]} of ${plasmid.name}`}
      onCommit={(value: EditableCellValue) =>
        saveField(plasmid.id, { [field]: value === null ? null : Number(value) })
      }
    />
  );

  const column = (
    id: PlasmidColumnId,
    render: (plasmid: Plasmid) => React.ReactNode,
    options: { sortable?: boolean; width?: string } = {}
  ): TableColumn<Plasmid> => ({
    id,
    label: COLUMN_LABEL[id],
    sortable: options.sortable ?? true,
    ...(options.width && { width: options.width }),
    render,
  });

  const columnDefs: Record<PlasmidColumnId, TableColumn<Plasmid>> = {
    name: column(
      'name',
      (plasmid) => (
        <EditableCell
          value={plasmid.name}
          colId="name"
          onNavigate={handleCellNavigate}
          ariaLabel={`ID of ${plasmid.name}`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { name: String(value ?? '') })
          }
          format={(value) => <span className="font-medium">{String(value)}</span>}
        />
      ),
      { width: '140px' }
    ),
    constructName: column('constructName', (p) => textCell(p, 'constructName'), {
      width: '160px',
    }),
    insertName: column('insertName', (p) => textCell(p, 'insertName'), { width: '160px' }),
    description: column(
      'description',
      (plasmid) => (
        <EditableCell
          value={plasmid.description ?? null}
          colId="description"
          onNavigate={handleCellNavigate}
          ariaLabel={`Details of ${plasmid.name}`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { description: String(value ?? '') })
          }
        />
      ),
      { sortable: false, width: '360px' }
    ),
    cassettes: column(
      'cassettes',
      (plasmid) => (
        <CassetteCell
          plasmidName={plasmid.name}
          cassettes={cassettesByPlasmid.get(plasmid.id) ?? []}
          options={cassetteChoices}
          annotations={annotations}
          onAdd={(content) => addCassette(plasmid.id, content)}
          onReplace={replaceCassette}
          onRemove={removeCassette}
        />
      ),
      { width: '320px' }
    ),
    category: column('category', (p) => textCell(p, 'category'), { width: '120px' }),
    bacterialResistance: column('bacterialResistance', (p) => textCell(p, 'bacterialResistance'), {
      width: '120px',
    }),
    plantResistance: column('plantResistance', (p) => textCell(p, 'plantResistance'), {
      width: '120px',
    }),
    prepConcentration: column(
      'prepConcentration',
      (p) => <DerivedCell value={latestPreps.get(p.id)?.concentrationNgUl} />,
      { width: '150px' }
    ),
    comment: column('comment', (p) => textCell(p, 'comment'), { width: '200px' }),
    sequencingResult: column('sequencingResult', (p) => textCell(p, 'sequencingResult'), {
      width: '180px',
    }),
    sequencingDate: column('sequencingDate', (p) => textCell(p, 'sequencingDate', true), {
      width: '140px',
    }),
    box: column('box', (p) => numberCell(p, 'box'), { width: '80px' }),
    prepDate: column('prepDate', (p) => <DerivedCell value={latestPreps.get(p.id)?.preppedOn} />, {
      width: '130px',
    }),
    stockId: column('stockId', (p) => <DerivedCell value={stocksByPlasmid.get(p.id)?.stockId} />, {
      width: '140px',
    }),
    stockMadeOn: column(
      'stockMadeOn',
      (p) => <DerivedCell value={stocksByPlasmid.get(p.id)?.madeOn} />,
      { width: '150px' }
    ),
    stockOrganism: column(
      'stockOrganism',
      (p) => <DerivedCell value={stocksByPlasmid.get(p.id)?.organism} />,
      { width: '140px' }
    ),
    stockStrain: column(
      'stockStrain',
      (p) => <DerivedCell value={stocksByPlasmid.get(p.id)?.strain} />,
      { width: '160px' }
    ),
    status: column(
      'status',
      (plasmid) => (
        <EditableCell
          value={plasmid.status}
          type="select"
          options={STATUS_OPTIONS}
          colId="status"
          onNavigate={handleCellNavigate}
          ariaLabel={`Status of ${plasmid.name}`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { status: value as Plasmid['status'] })
          }
          format={() => <PlasmidStatusBadge status={plasmid.status} />}
        />
      ),
      { width: '130px' }
    ),
    sizeBp: column(
      'sizeBp',
      (plasmid) => (
        <EditableCell
          value={plasmid.sizeBp ?? null}
          type="number"
          mono
          colId="sizeBp"
          onNavigate={handleCellNavigate}
          ariaLabel={`Total size of ${plasmid.name} in base pairs`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { sizeBp: value === null ? null : Number(value) })
          }
          format={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value))}
        />
      ),
      { width: '130px' }
    ),
    insertSizeBp: column('insertSizeBp', (p) => numberCell(p, 'insertSizeBp'), {
      width: '130px',
    }),
    backboneVector: column('backboneVector', (p) => textCell(p, 'backboneVector'), {
      width: '150px',
    }),
    notes: column('notes', (p) => textCell(p, 'notes'), { width: '200px' }),
    createdAt: column('createdAt', (plasmid) => new Date(plasmid.createdAt).toLocaleDateString(), {
      width: '130px',
    }),
    readiness: column(
      'readiness',
      (plasmid) => (
        <PlasmidReadinessCell readiness={readiness.get(plasmid.id)} plasmidName={plasmid.name} />
      ),
      { sortable: false, width: '120px' }
    ),
  };

  const columns = visibleColumns.map((id) => columnDefs[id]);

  return (
    // The page is viewport-high and never scrolls itself: the table scrolls
    // inside its card with its header pinned, so the heading, search and the
    // detail panel stay put however long the library is
    <div className="h-[calc(100vh-var(--app-nav-height))] bg-gray-50 dark:bg-gray-900 flex">
      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col px-6 py-8">
        {/* Header */}
        <div className="mb-8 shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Plasmids
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Click any cell to edit — changes save automatically
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6 shrink-0">
          <CardContent>
            <div className="flex gap-4 items-end">
              <Input
                label="Search plasmids"
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <ColumnPicker visible={visibleColumns} onChange={changeVisibleColumns} />
              <Button intent="primary" onClick={handleCreate} loading={isCreating}>
                New Plasmid
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="shrink-0">
            <CardTitle>
              Plasmid Library ({plasmids.length} total)
              {selectedRows.size > 0 && (
                <span className="ml-4 text-sm font-normal text-blue-600 dark:text-blue-400">
                  {selectedRows.size} selected
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            {error && (
              <div
                role="alert"
                className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
              >
                <p className="text-blue-800 dark:text-blue-200 text-sm">{notice}</p>
              </div>
            )}

            {/* Grid shortcuts: arrows/Home/End navigate cells, Ctrl+C copies
                the focused cell, pasting a TSV block fills rows/columns */}
            <div
              className="flex-1 min-h-0"
              onKeyDown={handleGridKeys}
              onPaste={(e) => void handleGridPaste(e)}
            >
              <Table
                className="h-full"
                fixedLayout
                columns={columns}
                data={sortedPlasmids}
                rowKey={(plasmid) => plasmid.id}
                selectedRows={selectedRows}
                onRowSelect={(id, selected) => {
                  setSelectedRows((prev) => {
                    const next = new Set(prev);
                    if (selected) {
                      next.add(id);
                    } else {
                      next.delete(id);
                    }
                    return next;
                  });
                }}
                onRowClick={(plasmid) => setActiveId(plasmid.id)}
                onSort={(columnId, direction) => {
                  setSortedBy(columnId);
                  setSortDirection(direction);
                }}
                sortedBy={sortedBy}
                sortDirection={sortDirection}
                loading={isLoading}
                emptyMessage="No plasmids found. Create one to get started."
                striped
              />
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedRows.size > 0 && (
          <div className="fixed bottom-6 right-6 z-20 p-4 bg-white dark:bg-surface-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-none dark:panel-lift">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              {selectedRows.size} plasmid{selectedRows.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button intent="secondary" size="sm" onClick={() => setSelectedRows(new Set())}>
                Clear
              </Button>
              <Button intent="secondary" size="sm" onClick={() => void handleCopySelected()}>
                Copy
              </Button>
              <Button intent="secondary" size="sm" onClick={() => setIsPrepDialogOpen(true)}>
                Record prep
              </Button>
              <Button intent="secondary" size="sm" onClick={handlePrintLabels}>
                Plasmid labels
              </Button>
              <Button intent="secondary" size="sm" onClick={() => void handlePrintStockLabels()}>
                Stock labels
              </Button>
              <Button intent="secondary" size="sm" onClick={handleGoldenGate}>
                Golden Gate
              </Button>
              <Button intent="danger" size="sm" onClick={handleDeleteSelected} loading={isDeleting}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {isPrepDialogOpen && (
        <RecordPrepDialog
          plasmids={sortedPlasmids.filter((p) => selectedRows.has(p.id))}
          defaultInitials={operatorInitials}
          onClose={() => setIsPrepDialogOpen(false)}
          onRecorded={(count) => {
            setNotice(`Recorded ${count} prep${count === 1 ? '' : 's'}.`);
            void refreshDerivedColumns();
          }}
        />
      )}

      {/* Synced detail panel */}
      {activePlasmid && (
        <PlasmidDetailPanel
          plasmid={activePlasmid}
          onSave={(patch) => saveField(activePlasmid.id, patch)}
          onDuplicate={() => handleDuplicate(activePlasmid.id)}
          onClose={() => {
            setActiveId(null);
            // Cassettes, GMOs and the original vector are panel-edited and
            // all feed readiness, so recompute when the panel closes; the
            // panel also records preps and stocks
            void refreshReadiness();
            void refreshDerivedColumns();
          }}
        />
      )}
    </div>
  );
}
