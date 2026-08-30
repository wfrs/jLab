'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plasmid } from '@/domain/types';
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
  createPlasmid,
  deletePlasmid,
  duplicatePlasmid,
  fetchPlasmidReadiness,
  listPlasmids,
  updatePlasmid,
  UpdatePlasmidPayload,
} from '@/components/plasmids/api-client';
import { PlasmidReadinessCell } from '@/components/plasmids/PlasmidReadinessCell';
import type { PlasmidReadiness } from '@/services/data-quality.service';
import { RecordPrepDialog } from '@/components/plasmids/RecordPrepDialog';
import { listGlycerolStocks, stashLabelSelection } from '@/components/labels/api-client';

/** Debounce for the search box (ms) */
const SEARCH_DEBOUNCE_MS = 300;

/** Default name prefix for newly created plasmids */
const NEW_PLASMID_PREFIX = 'Untitled-';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'validated', label: 'Validated' },
  { value: 'archived', label: 'Archived' },
];

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
        const { payload, errors } = buildRowCreate(columnIdsFor(anchorRowCells, grid[r]), grid[r]);
        const rowLabel = payload?.name ?? `pasted row ${r + 1}`;
        errors.forEach((message) => failures.push(`${rowLabel}: ${message}`));
        if (payload) {
          try {
            createdRows.push(await createPlasmid(payload));
          } catch (err) {
            failures.push(`${rowLabel}: ${err instanceof Error ? err.message : 'create failed'}`);
          }
        }
        continue;
      }

      const id = row.getAttribute('data-row-key');
      if (!id) continue;

      const { patch, errors } = buildRowPatch(columnIdsFor(cellsOfRow(row), grid[r]), grid[r]);
      const rowName = plasmids.find((p) => p.id === id)?.name ?? id;
      errors.forEach((message) => failures.push(`${rowName}: ${message}`));

      if (Object.keys(patch).length > 0) {
        try {
          await saveField(id, patch);
          cellsApplied += Object.keys(patch).length;
          rowsTouched += 1;
        } catch (err) {
          failures.push(`${rowName}: ${err instanceof Error ? err.message : 'save failed'}`);
        }
      }
    }

    if (createdRows.length > 0) {
      // They were pasted below the table, so that is where they appear
      setPlasmids((prev) => [...prev, ...createdRows]);
      void refreshReadiness();
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

  // Sort plasmids (client-side)
  const sortedPlasmids = useMemo(() => {
    if (!sortedBy) return plasmids;
    return [...plasmids].sort((a, b) => {
      const aVal = a[sortedBy as keyof Plasmid];
      const bVal = b[sortedBy as keyof Plasmid];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [plasmids, sortedBy, sortDirection]);

  const activePlasmid = activeId ? plasmids.find((p) => p.id === activeId) || null : null;

  // Table columns — editable cells commit through saveField (autosave)
  const columns: TableColumn<Plasmid>[] = [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      width: '200px',
      render: (plasmid) => (
        <EditableCell
          value={plasmid.name}
          colId="name"
          onNavigate={handleCellNavigate}
          ariaLabel={`Name of ${plasmid.name}`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { name: String(value ?? '') })
          }
          format={(value) => <span className="font-medium">{String(value)}</span>}
        />
      ),
    },
    {
      id: 'description',
      label: 'Description',
      sortable: false,
      render: (plasmid) => (
        <EditableCell
          value={plasmid.description ?? null}
          colId="description"
          onNavigate={handleCellNavigate}
          ariaLabel={`Description of ${plasmid.name}`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { description: String(value ?? '') })
          }
        />
      ),
    },
    {
      id: 'sizeBp',
      label: 'Size (bp)',
      sortable: true,
      width: '120px',
      render: (plasmid) => (
        <EditableCell
          value={plasmid.sizeBp ?? null}
          type="number"
          mono
          colId="sizeBp"
          onNavigate={handleCellNavigate}
          ariaLabel={`Size of ${plasmid.name} in base pairs`}
          onCommit={(value: EditableCellValue) =>
            saveField(plasmid.id, { sizeBp: value === null ? null : Number(value) })
          }
          format={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value))}
        />
      ),
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      width: '130px',
      render: (plasmid) => (
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
    },
    {
      id: 'createdAt',
      label: 'Created',
      sortable: true,
      width: '130px',
      render: (plasmid) => new Date(plasmid.createdAt).toLocaleDateString(),
    },
    {
      id: 'readiness',
      label: 'Formblatt Z',
      sortable: false,
      width: '120px',
      render: (plasmid) => (
        <PlasmidReadinessCell readiness={readiness.get(plasmid.id)} plasmidName={plasmid.name} />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Main content */}
      <div className="flex-1 min-w-0 px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Plasmids
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Click any cell to edit — changes save automatically
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex gap-4 items-end">
              <Input
                label="Search plasmids"
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button intent="primary" onClick={handleCreate} loading={isCreating}>
                New Plasmid
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Plasmid Library ({plasmids.length} total)
              {selectedRows.size > 0 && (
                <span className="ml-4 text-sm font-normal text-blue-600 dark:text-blue-400">
                  {selectedRows.size} selected
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
            <div onKeyDown={handleGridKeys} onPaste={(e) => void handleGridPaste(e)}>
              <Table
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
          onRecorded={(count) => setNotice(`Recorded ${count} prep${count === 1 ? '' : 's'}.`)}
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
            // all feed readiness, so recompute when the panel closes
            void refreshReadiness();
          }}
        />
      )}
    </div>
  );
}
