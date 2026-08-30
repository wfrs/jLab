'use client';

// Extracted from the former /glossary page — rendered as the "Nucleic acids" tab

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlossaryFeature } from '@/domain/types';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CellNavDirection, EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { focusNeighborCell, handleGridKeyDown } from '@/components/ui/grid-navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  createGlossaryFeature,
  deleteGlossaryFeature,
  listGlossaryFeatures,
  updateGlossaryFeature,
  UpdateGlossaryFeaturePayload,
} from '@/components/glossary/api-client';

/** Debounce for the search box (ms) */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Glossary Page (Nucleic acids)
 * Spreadsheet-first glossary management: the annotations defined here are
 * the tokens used in cassette composition. Autosave on edit.
 * Note: '-', '[', ']', and spaces in annotations are normalized to
 * '_', '(', ')', '_' (legacy GMOCU behavior).
 */
export function NucleicAcidsTab() {
  const [features, setFeatures] = useState<GlossaryFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortedBy, setSortedBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setFeatures(await listGlossaryFeatures(searchQuery || undefined));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load glossary');
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchFeatures, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveField = useCallback(async (id: string, patch: UpdateGlossaryFeaturePayload) => {
    try {
      const updated = await updateGlossaryFeature(id, patch);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save change');
      throw err;
    }
  }, []);

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

  const handleCreate = async () => {
    if (newAnnotation.trim().length === 0) return;
    try {
      setIsCreating(true);
      setError(null);
      const created = await createGlossaryFeature({ annotation: newAnnotation.trim() });
      setFeatures((prev) => [created, ...prev]);
      setNewAnnotation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create glossary feature');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedRows);
    const confirmed = window.confirm(
      `Delete ${ids.length} glossary feature${ids.length !== 1 ? 's' : ''}? Cassettes using them will show unresolved tokens. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    const failures: string[] = [];

    for (const id of ids) {
      try {
        await deleteGlossaryFeature(id);
        setFeatures((prev) => prev.filter((f) => f.id !== id));
        setSelectedRows((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `Failed to delete ${id}`);
      }
    }

    if (failures.length > 0) {
      setError(failures.join('; '));
    }
    setIsDeleting(false);
  };

  const sortedFeatures = useMemo(() => {
    if (!sortedBy) return features;
    return [...features].sort((a, b) => {
      const aVal = a[sortedBy as keyof GlossaryFeature];
      const bVal = b[sortedBy as keyof GlossaryFeature];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [features, sortedBy, sortDirection]);

  const columns: TableColumn<GlossaryFeature>[] = [
    {
      id: 'annotation',
      label: 'Annotation',
      sortable: true,
      width: '220px',
      render: (feature) => (
        <EditableCell
          value={feature.annotation}
          mono
          onNavigate={handleCellNavigate}
          ariaLabel={`Annotation ${feature.annotation}`}
          onCommit={(value: EditableCellValue) =>
            saveField(feature.id, { annotation: String(value ?? '') })
          }
          format={(value) => <span className="font-medium font-mono">{String(value)}</span>}
        />
      ),
    },
    {
      id: 'alias',
      label: 'Alias',
      sortable: true,
      render: (feature) => (
        <EditableCell
          value={feature.alias ?? null}
          onNavigate={handleCellNavigate}
          ariaLabel={`Alias of ${feature.annotation}`}
          onCommit={(value: EditableCellValue) =>
            saveField(feature.id, { alias: value === null ? null : String(value) })
          }
        />
      ),
    },
    {
      id: 'risk',
      label: 'Risk',
      sortable: true,
      width: '160px',
      render: (feature) => (
        <EditableCell
          value={feature.risk}
          onNavigate={handleCellNavigate}
          ariaLabel={`Risk of ${feature.annotation}`}
          onCommit={(value: EditableCellValue) =>
            saveField(feature.id, { risk: String(value ?? '') })
          }
        />
      ),
    },
    {
      id: 'organism',
      label: 'Organism',
      sortable: true,
      width: '200px',
      render: (feature) => (
        <EditableCell
          value={feature.organism ?? null}
          onNavigate={handleCellNavigate}
          ariaLabel={`Organism of ${feature.annotation}`}
          onCommit={(value: EditableCellValue) =>
            saveField(feature.id, { organism: value === null ? null : String(value) })
          }
        />
      ),
    },
  ];

  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Feature annotations used as cassette tokens. Dashes, brackets, and spaces are normalized to
        underscores and parentheses.
      </p>

      <Card className="mb-6">
        <CardContent>
          <form
            className="flex gap-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <Input
              label="Search glossary"
              placeholder="Search by annotation or alias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Input
              label="New annotation"
              placeholder="e.g. pLac_promoter"
              value={newAnnotation}
              onChange={(e) => setNewAnnotation(e.target.value)}
              className="flex-1 font-mono"
            />
            <Button
              type="submit"
              intent="primary"
              loading={isCreating}
              disabled={newAnnotation.trim().length === 0}
            >
              Add Feature
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Nucleic acid features ({features.length} total)
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

          <div onKeyDown={handleGridKeys}>
            <Table
              columns={columns}
              data={sortedFeatures}
              rowKey={(feature) => feature.id}
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
              onSort={(columnId, direction) => {
                setSortedBy(columnId);
                setSortDirection(direction);
              }}
              sortedBy={sortedBy}
              sortDirection={sortDirection}
              loading={isLoading}
              emptyMessage="No glossary features yet. Add one above."
              striped
            />
          </div>
        </CardContent>
      </Card>

      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 right-6 z-20 p-4 bg-white dark:bg-surface-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-none dark:panel-lift">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            {selectedRows.size} feature{selectedRows.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button intent="secondary" size="sm" onClick={() => setSelectedRows(new Set())}>
              Clear
            </Button>
            <Button intent="danger" size="sm" onClick={handleDeleteSelected} loading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
