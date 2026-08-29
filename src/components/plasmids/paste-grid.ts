/**
 * Clipboard paste parsing for the plasmid table (pure logic, unit-tested).
 * Pasted text is interpreted as a TSV block (Excel/Sheets convention):
 * rows split on newlines, cells on tabs. The block fills existing rows
 * downward and editable columns rightward from the anchor cell.
 */

import { UpdatePlasmidPayload } from './api-client';

const STATUS_VALUES = ['draft', 'validated', 'archived'] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

/** Parse clipboard text into a rectangular-ish grid of cell strings */
export function parsePasteText(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  // Trailing newline (standard when copying whole rows) → drop the empty tail
  if (rows.length > 1 && rows[rows.length - 1] === '') {
    rows.pop();
  }
  return rows.map((row) => row.split('\t'));
}

/** Case-insensitive status normalization ("Draft" → 'draft'); null if unknown */
export function normalizeStatus(raw: string): StatusValue | null {
  const lowered = raw.trim().toLowerCase();
  return (STATUS_VALUES as readonly string[]).includes(lowered) ? (lowered as StatusValue) : null;
}

export interface RowPatchResult {
  patch: UpdatePlasmidPayload;
  errors: string[];
}

/**
 * Build one PATCH payload for a row from pasted cells aligned to column ids.
 * `columnIds[i]` is the target column for `cells[i]`; unknown/read-only
 * columns are skipped silently (counted by the caller via alignment).
 */
export function buildRowPatch(columnIds: (string | null)[], cells: string[]): RowPatchResult {
  const patch: UpdatePlasmidPayload = {};
  const errors: string[] = [];

  cells.forEach((raw, index) => {
    const columnId = columnIds[index];
    if (!columnId) return;

    switch (columnId) {
      case 'name': {
        const name = raw.trim();
        if (name.length === 0) {
          errors.push('name cannot be empty');
        } else {
          patch.name = name;
        }
        break;
      }
      case 'description':
        patch.description = raw;
        break;
      case 'sizeBp': {
        const trimmed = raw.trim();
        if (trimmed === '') {
          patch.sizeBp = null;
        } else {
          // Tolerate thousands separators from spreadsheet exports (6,425)
          const parsed = Number(trimmed.replace(/[\s,]/g, ''));
          if (!Number.isFinite(parsed)) {
            errors.push(`"${raw}" is not a number`);
          } else {
            patch.sizeBp = parsed;
          }
        }
        break;
      }
      case 'status': {
        const status = normalizeStatus(raw);
        if (!status) {
          errors.push(`"${raw}" is not a status (draft/validated/archived)`);
        } else {
          patch.status = status;
        }
        break;
      }
      default:
        // Not a pastable column
        break;
    }
  });

  return { patch, errors };
}
