/**
 * Label API client (browser-side)
 * Unwraps the standard envelopes (ADR-0008) and surfaces server messages.
 */

import { GlycerolStock, PlasmidPrep } from '@/domain/types';
import type {
  GlycerolLabelPayload,
  PlasmidLabelPayload,
  PrintBatch,
} from '@/services/label.service';
import { compareStockIds } from '@/domain/lab-normalization';

export class LabelApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'LabelApiError';
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = json as { message?: string; code?: string } | null;
    throw new LabelApiError(
      envelope?.message || `Request failed: ${response.status} ${response.statusText}`,
      envelope?.code || 'UNKNOWN'
    );
  }

  return (json as { data: T }).data;
}

/**
 * Ids per request. A UUID is 36 characters, so a whole-library print of 400
 * labels would put ~15 KB in the query string — past Node's 16 KB header
 * limit. Chunking keeps the endpoint a plain GET.
 */
const LABEL_FETCH_CHUNK = 50;

export async function fetchPlasmidLabels(ids: string[]): Promise<PlasmidLabelPayload[]> {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += LABEL_FETCH_CHUNK) {
    chunks.push(ids.slice(start, start + LABEL_FETCH_CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(
        `/api/labels/plasmids?ids=${encodeURIComponent(chunk.join(','))}`
      );
      const { labels } = await unwrap<{ labels: PlasmidLabelPayload[] }>(response);
      return labels;
    })
  );

  // Each chunk is sorted by accession; the concatenation is not, so sort again
  return results.flat().sort((a, b) => a.accession.localeCompare(b.accession));
}

/**
 * The plasmids page hands its selection over in sessionStorage rather than the
 * URL, for the same length reason. `?ids=` still works for a direct link.
 */
export const LABEL_SELECTION_KEY = 'jlab.label-selection';

export function stashLabelSelection(ids: string[]): void {
  try {
    window.sessionStorage.setItem(LABEL_SELECTION_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing or a full quota: the print page falls back to ?ids=
  }
}

export function readLabelSelection(): string[] {
  try {
    const raw = window.sessionStorage.getItem(LABEL_SELECTION_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function recordLabelPrints(
  kind: 'plasmid' | 'glycerol',
  ids: string[]
): Promise<{ recorded: number; printedAt?: string }> {
  const response = await fetch('/api/labels/prints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, ids }),
  });
  return unwrap<{ recorded: number; printedAt?: string }>(response);
}

export interface PrepEntryPayload {
  plasmidId: string;
  concentrationNgUl?: number | null;
}

export async function recordPrepBatch(input: {
  preppedOn: string;
  operatorInitials: string;
  entries: PrepEntryPayload[];
}): Promise<PlasmidPrep[]> {
  const response = await fetch('/api/plasmids/preps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { preps } = await unwrap<{ preps: PlasmidPrep[] }>(response);
  return preps;
}

/** The current prep of every prepped plasmid, for the plasmid table */
export async function listLatestPreps(): Promise<PlasmidPrep[]> {
  const response = await fetch('/api/plasmids/preps');
  const { preps } = await unwrap<{ preps: PlasmidPrep[] }>(response);
  return preps;
}

export async function fetchPrepHistory(plasmidId: string): Promise<PlasmidPrep[]> {
  const response = await fetch(`/api/plasmids/${plasmidId}/preps`);
  const { preps } = await unwrap<{ preps: PlasmidPrep[] }>(response);
  return preps;
}

export async function fetchGlycerolLabels(ids: string[]): Promise<GlycerolLabelPayload[]> {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += LABEL_FETCH_CHUNK) {
    chunks.push(ids.slice(start, start + LABEL_FETCH_CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(
        `/api/labels/glycerol?ids=${encodeURIComponent(chunk.join(','))}`
      );
      const { labels } = await unwrap<{ labels: GlycerolLabelPayload[] }>(response);
      return labels;
    })
  );

  return results.flat().sort((a, b) => compareStockIds(a.stockId, b.stockId));
}

export async function listGlycerolStocks(plasmidIds: string[]): Promise<GlycerolStock[]> {
  if (plasmidIds.length === 0) {
    return [];
  }
  const response = await fetch(
    `/api/glycerol-stocks?plasmidIds=${encodeURIComponent(plasmidIds.join(','))}`
  );
  const { stocks } = await unwrap<{ stocks: GlycerolStock[] }>(response);
  return stocks;
}

/** Every stock in the freezer, for the plasmid table's stock columns */
export async function listAllGlycerolStocks(): Promise<GlycerolStock[]> {
  const response = await fetch('/api/glycerol-stocks');
  const { stocks } = await unwrap<{ stocks: GlycerolStock[] }>(response);
  return stocks;
}

export async function createGlycerolStock(
  input: Partial<GlycerolStock> & { stockId: string; organism: string; strain: string }
): Promise<GlycerolStock> {
  const response = await fetch('/api/glycerol-stocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<GlycerolStock>(response);
}

export async function updateGlycerolStock(
  id: string,
  patch: Partial<GlycerolStock>
): Promise<GlycerolStock> {
  const response = await fetch(`/api/glycerol-stocks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<GlycerolStock>(response);
}

export async function fetchPrintBatches(): Promise<PrintBatch[]> {
  const response = await fetch('/api/labels/prints');
  const { batches } = await unwrap<{ batches: PrintBatch[] }>(response);
  return batches;
}

export async function fetchPrintBatch(
  kind: 'plasmid' | 'glycerol',
  printedAt: string
): Promise<string[]> {
  const response = await fetch(
    `/api/labels/prints?kind=${kind}&printedAt=${encodeURIComponent(printedAt)}`
  );
  const { ids } = await unwrap<{ ids: string[] }>(response);
  return ids;
}
