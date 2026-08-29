'use client';

/**
 * OrganismsTab — organism glossary table (legacy "Organisms" tab)
 * Spreadsheet-first with inline autosave, mirroring the Nucleic acids tab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Organism } from '@/domain/types';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  createOrganism,
  deleteOrganism,
  listOrganisms,
  updateOrganism,
  UpdateOrganismPayload,
} from './api-client';

/** Debounce for the search box (ms) */
const SEARCH_DEBOUNCE_MS = 300;

export function OrganismsTab(): JSX.Element {
  const [organisms, setOrganisms] = useState<Organism[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortedBy, setSortedBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchOrganisms = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setOrganisms(await listOrganisms(searchQuery || undefined));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organisms');
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchOrganisms, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveField = useCallback(async (id: string, patch: UpdateOrganismPayload) => {
    try {
      const updated = await updateOrganism(id, patch);
      setOrganisms((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save change');
      throw err;
    }
  }, []);

  const handleCreate = async () => {
    if (newFullName.trim().length === 0) return;
    try {
      setIsCreating(true);
      setError(null);
      const created = await createOrganism({ fullName: newFullName.trim() });
      setOrganisms((prev) => [created, ...prev]);
      setNewFullName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organism');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedRows);
    const confirmed = window.confirm(
      `Delete ${ids.length} organism${ids.length !== 1 ? 's' : ''}? GMO records referencing them keep the name but new GMOs cannot use it. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    const failures: string[] = [];

    for (const id of ids) {
      try {
        await deleteOrganism(id);
        setOrganisms((prev) => prev.filter((o) => o.id !== id));
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

  const sortedOrganisms = useMemo(() => {
    if (!sortedBy) return organisms;
    return [...organisms].sort((a, b) => {
      const aVal = a[sortedBy as keyof Organism];
      const bVal = b[sortedBy as keyof Organism];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [organisms, sortedBy, sortDirection]);

  const columns: TableColumn<Organism>[] = [
    {
      id: 'fullName',
      label: 'Full name',
      sortable: true,
      render: (organism) => (
        <EditableCell
          value={organism.fullName}
          ariaLabel={`Full name of ${organism.fullName}`}
          onCommit={(value: EditableCellValue) =>
            saveField(organism.id, { fullName: String(value ?? '') })
          }
          format={(value) => <span className="font-medium italic">{String(value)}</span>}
        />
      ),
    },
    {
      id: 'shortName',
      label: 'Short name',
      sortable: true,
      width: '200px',
      render: (organism) => (
        <EditableCell
          value={organism.shortName ?? null}
          ariaLabel={`Short name of ${organism.fullName}`}
          onCommit={(value: EditableCellValue) =>
            saveField(organism.id, { shortName: value === null ? null : String(value) })
          }
        />
      ),
    },
    {
      id: 'riskGroup',
      label: 'Risk group',
      sortable: true,
      width: '130px',
      render: (organism) => (
        <EditableCell
          value={organism.riskGroup}
          mono
          ariaLabel={`Risk group of ${organism.fullName}`}
          onCommit={(value: EditableCellValue) =>
            saveField(organism.id, { riskGroup: String(value ?? '') })
          }
        />
      ),
    },
  ];

  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Organisms available for GMO generation. The risk group seeds new GMO records.
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
              label="Search organisms"
              placeholder="Search by full or short name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Input
              label="New organism (full name)"
              placeholder="e.g. Escherichia coli K-12"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              intent="primary"
              loading={isCreating}
              disabled={newFullName.trim().length === 0}
            >
              Add Organism
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Organisms ({organisms.length} total)
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

          <Table
            columns={columns}
            data={sortedOrganisms}
            rowKey={(organism) => organism.id}
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
            emptyMessage="No organisms yet. Add one above."
            striped
          />
        </CardContent>
      </Card>

      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 right-6 z-20 p-4 bg-white dark:bg-surface-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-none dark:panel-lift">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            {selectedRows.size} organism{selectedRows.size !== 1 ? 's' : ''} selected
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
