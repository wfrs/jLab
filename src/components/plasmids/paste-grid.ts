/**
 * Clipboard paste parsing for the plasmid table (pure logic, unit-tested).
 * Pasted text is interpreted as a TSV block (Excel/Sheets convention):
 * rows split on newlines, cells on tabs. The block fills existing rows
 * downward and editable columns rightward from the anchor cell.
 */

import { CreatePlasmidPayload, UpdatePlasmidPayload } from './api-client';
import { splitCassetteContents } from './cassette-options';

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
  /** Cassette contents to add to the row (own records, not plasmid fields) */
  cassettes: string[];
  errors: string[];
}

/**
 * Build one PATCH payload for a row from pasted cells aligned to column ids.
 * `columnIds[i]` is the target column for `cells[i]`; unknown/read-only
 * columns are skipped silently (counted by the caller via alignment).
 */
export function buildRowPatch(columnIds: (string | null)[], cells: string[]): RowPatchResult {
  const patch: UpdatePlasmidPayload = {};
  const cassettes: string[] = [];
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
      case 'insertSizeBp':
      case 'box': {
        const parsed = parseNumberCell(raw);
        if (parsed === undefined) {
          errors.push(`"${raw}" is not a number`);
        } else {
          patch[columnId] = parsed;
        }
        break;
      }
      case 'sequencingDate': {
        const trimmed = raw.trim();
        if (trimmed !== '' && !ISO_DATE_PATTERN.test(trimmed)) {
          errors.push(`"${raw}" is not an ISO date (YYYY-MM-DD)`);
        } else {
          patch.sequencingDate = trimmed === '' ? null : trimmed;
        }
        break;
      }
      case 'cassettes':
        cassettes.push(...splitCassetteContents(raw));
        break;
      case 'constructName':
      case 'insertName':
      case 'category':
      case 'bacterialResistance':
      case 'plantResistance':
      case 'sequencingResult':
      case 'comment':
      case 'notes': {
        // Lab text fields: an empty cell clears the stored value
        const trimmed = raw.trim();
        patch[columnId] = trimmed === '' ? null : trimmed;
        break;
      }
      default:
        // Not a pastable column
        break;
    }
  });

  return { patch, cassettes, errors };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Empty clears (null); unparseable is undefined so the caller can report it */
function parseNumberCell(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  // Tolerate thousands separators from spreadsheet exports (6,425)
  const parsed = Number(trimmed.replace(/[\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface RowCreateResult {
  /** Null when the row cannot become a plasmid (no name in an aligned cell) */
  payload: CreatePlasmidPayload | null;
  /** Cassettes to add once the plasmid exists */
  cassettes: string[];
  errors: string[];
}

/**
 * Build a create payload for a pasted row that landed below the table.
 * Same column alignment and cell parsing as buildRowPatch, but the result
 * must stand on its own: without a non-empty name in an aligned column the
 * row cannot be created and says so.
 */
export function buildRowCreate(columnIds: (string | null)[], cells: string[]): RowCreateResult {
  const { patch, cassettes, errors } = buildRowPatch(columnIds, cells);

  if (!patch.name) {
    // A name error ("name cannot be empty") already explains itself
    if (!errors.some((message) => message.includes('name'))) {
      errors.push('needs a name to create a plasmid');
    }
    return { payload: null, cassettes, errors };
  }

  const payload: CreatePlasmidPayload = { name: patch.name };
  if (patch.description !== undefined) payload.description = patch.description;
  // Update semantics allow null to clear; a new plasmid just omits the field
  if (typeof patch.sizeBp === 'number') payload.sizeBp = patch.sizeBp;
  if (patch.status !== undefined) payload.status = patch.status;

  return { payload, cassettes, errors };
}
