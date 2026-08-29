/**
 * Table Component
 * Reusable table with sorting, row selection, and customizable columns
 * Follows design system patterns for spacing, typography, and focus states
 */

import React from 'react';
import { clsx } from 'clsx';

export interface TableColumn<T> {
  id: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (item: T) => string;
  selectedRows?: Set<string>;
  onRowSelect?: (rowKey: string, selected: boolean) => void;
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  sortedBy?: string | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean;
}

/**
 * Table Header Cell
 */
function TableHeaderCell<T>({
  column,
  sorted = false,
  sortDirection,
  onSort,
}: {
  column: TableColumn<T>;
  sorted?: boolean;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
}) {
  const isSortable = column.sortable && onSort;

  return (
    <th
      className={clsx(
        'px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100',
        'text-sm bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
        isSortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
      style={{ width: column.width }}
      onClick={() => isSortable && onSort?.(column.id)}
      role={isSortable ? 'button' : undefined}
      tabIndex={isSortable ? 0 : undefined}
    >
      <div className="flex items-center gap-2">
        <span>{column.label}</span>
        {isSortable && (
          <span className="text-gray-400 dark:text-gray-500">
            {sorted && sortDirection ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )}
      </div>
    </th>
  );
}

/**
 * Table Row
 */
function TableRow<T>({
  item,
  columns,
  rowKey,
  isSelected = false,
  onSelectChange,
  onRowClick,
  striped = true,
  rowIndex,
}: {
  item: T;
  columns: TableColumn<T>[];
  rowKey?: string;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onRowClick?: () => void;
  striped?: boolean;
  rowIndex: number;
}) {
  return (
    <tr
      {...(rowKey && { 'data-row-key': rowKey })}
      className={clsx(
        'border-b border-gray-200 dark:border-gray-700',
        'hover:bg-blue-50 dark:hover:bg-gray-800/70 transition-colors',
        striped && rowIndex % 2 === 0 && 'bg-gray-50/50 dark:bg-gray-800/30',
        isSelected && 'bg-blue-100 dark:bg-blue-900/40',
        onRowClick && 'cursor-pointer'
      )}
      onClick={onRowClick}
    >
      <td className="px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={isSelected || false}
          onChange={(e) => onSelectChange?.(e.target.checked)}
          className="w-4 h-4 cursor-pointer accent-blue-600"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      {columns.map((column) => (
        <td
          key={column.id}
          className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300"
          style={{ width: column.width }}
        >
          {column.render ? column.render(item) : '—'}
        </td>
      ))}
    </tr>
  );
}

/**
 * Table Component
 * Displays data in a spreadsheet-style table with sorting and row selection
 */
export const Table = React.forwardRef<HTMLTableElement, TableProps<any>>(
  (
    {
      columns,
      data,
      rowKey,
      selectedRows,
      onRowSelect,
      onSort,
      sortedBy,
      sortDirection,
      onRowClick,
      loading,
      emptyMessage = 'No data available',
      striped = true,
    },
    ref
  ) => {
    const handleSort = (columnId: string) => {
      if (!onSort) return;

      let direction: 'asc' | 'desc' = 'asc';
      if (sortedBy === columnId && sortDirection === 'asc') {
        direction = 'desc';
      }

      onSort(columnId, direction);
    };

    return (
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table
          ref={ref}
          className="w-full text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900"
        >
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-blue-600"
                  checked={data.length > 0 && selectedRows?.size === data.length}
                  onChange={(e) => {
                    data.forEach((item) => {
                      const key = rowKey(item);
                      onRowSelect?.(key, e.target.checked);
                    });
                  }}
                />
              </th>
              {columns.map((column) => {
                const headerProps: {
                  column: TableColumn<any>;
                  sorted?: boolean;
                  sortDirection?: 'asc' | 'desc';
                  onSort?: (columnId: string) => void;
                } = {
                  column,
                  sorted: sortedBy === column.id,
                };

                if (sortDirection !== undefined) {
                  headerProps.sortDirection = sortDirection;
                }

                if (onSort) {
                  headerProps.onSort = handleSort;
                }

                return <TableHeaderCell key={column.id} {...headerProps} />;
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const rowProps: {
                  item: any;
                  columns: TableColumn<any>[];
                  rowKey?: string;
                  isSelected?: boolean;
                  onSelectChange?: (selected: boolean) => void;
                  onRowClick?: () => void;
                  striped?: boolean;
                  rowIndex: number;
                } = {
                  item,
                  columns,
                  rowKey: rowKey(item),
                  rowIndex: index,
                  striped: striped,
                };

                if (selectedRows?.has(rowKey(item))) {
                  rowProps.isSelected = true;
                }

                if (onRowSelect) {
                  rowProps.onSelectChange = (selected) => onRowSelect(rowKey(item), selected);
                }

                if (onRowClick) {
                  rowProps.onRowClick = () => onRowClick(item);
                }

                return <TableRow key={rowKey(item)} {...rowProps} />;
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';
