/**
 * Spreadsheet grid navigation over EditableCell display elements.
 * DOM-based: cells are `[data-editable-cell]` elements inside `tbody tr`
 * rows, so the grid needs no coordinate bookkeeping in React state.
 */

import type { CellNavDirection } from './EditableCell';

export interface CellPosition {
  /** Row element the cell belongs to */
  row: HTMLTableRowElement;
  /** All editable cells in that row, in DOM order */
  rowCells: HTMLElement[];
  /** Index of the cell within rowCells */
  colIndex: number;
  /** All rows of the grid body */
  rows: HTMLTableRowElement[];
  /** Index of the row within rows */
  rowIndex: number;
}

/** Resolve a cell element's grid coordinates; null when it isn't in a grid */
export function locateCell(cell: HTMLElement): CellPosition | null {
  const row = cell.closest('tr');
  const body = cell.closest('tbody');
  if (!row || !body) return null;

  const rowCells = Array.from(row.querySelectorAll<HTMLElement>('[data-editable-cell]'));
  const colIndex = rowCells.indexOf(cell);
  if (colIndex === -1) return null;

  const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr'));
  return { row, rowCells, colIndex, rows, rowIndex: rows.indexOf(row) };
}

/** Editable cells of a row, in DOM order */
export function cellsOfRow(row: HTMLTableRowElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>('[data-editable-cell]'));
}

/**
 * Focus the neighboring cell in the given direction (clamped at the grid
 * edges — focus stays on the current cell rather than wrapping).
 */
export function focusNeighborCell(from: HTMLElement, direction: CellNavDirection): void {
  const position = locateCell(from);
  if (!position) {
    from.focus();
    return;
  }

  let target: HTMLElement | undefined;
  if (direction === 'left' || direction === 'right') {
    target = position.rowCells[position.colIndex + (direction === 'right' ? 1 : -1)];
  } else {
    const nextRow = position.rows[position.rowIndex + (direction === 'down' ? 1 : -1)];
    if (nextRow) {
      const cells = cellsOfRow(nextRow);
      target = cells[Math.min(position.colIndex, cells.length - 1)];
    }
  }

  (target ?? from).focus();
}

/**
 * Grid keydown handling for display-mode cells: arrow navigation,
 * Home/End within the row, and Ctrl/Cmd+C cell copy.
 * Returns true when the event was handled (caller prevents default).
 */
export function handleGridKeyDown(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || !target.hasAttribute?.('data-editable-cell')) return false;

  const arrowDirections: Record<string, CellNavDirection> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  if (event.key in arrowDirections && !event.ctrlKey && !event.metaKey) {
    focusNeighborCell(target, arrowDirections[event.key]);
    return true;
  }

  if ((event.key === 'Home' || event.key === 'End') && !event.ctrlKey && !event.metaKey) {
    const position = locateCell(target);
    if (position) {
      const cell =
        event.key === 'Home'
          ? position.rowCells[0]
          : position.rowCells[position.rowCells.length - 1];
      cell?.focus();
      return true;
    }
    return false;
  }

  if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
    const value = target.getAttribute('data-cell-value') ?? '';
    void navigator.clipboard?.writeText(value);
    return true;
  }

  return false;
}
