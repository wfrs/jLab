/**
 * Plasmid API client (browser-side)
 * Thin fetch wrapper that unwraps the standard API envelopes (ADR-0008)
 * and surfaces server error messages to the UI.
 */

import {
  AttachmentMeta,
  Cassette,
  Feature,
  GenbankMeta,
  Gmo,
  Plasmid,
  Primer,
} from '@/domain/types';
import type { PlasmidReadiness } from '@/services/data-quality.service';
import { MAX_PAGE_SIZE } from '@/shared/pagination';

export interface PlasmidListResult {
  data: Plasmid[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatePlasmidPayload {
  name: string;
  description?: string;
  sizeBp?: number;
  parentId?: string;
  status?: Plasmid['status'];
}

export interface UpdatePlasmidPayload {
  name?: string;
  description?: string;
  sizeBp?: number | null;
  parentId?: string | null;
  backboneVector?: string | null;
  status?: Plasmid['status'];
  /** Lab spreadsheet fields; `null` clears each */
  constructName?: string | null;
  insertName?: string | null;
  insertSizeBp?: number | null;
  category?: string | null;
  bacterialResistance?: string | null;
  plantResistance?: string | null;
  box?: number | null;
  sequencingResult?: string | null;
  sequencingDate?: string | null;
  comment?: string | null;
  notes?: string | null;
}

/** Error carrying the server's envelope message (e.g. validation failures) */
export class PlasmidApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: string
  ) {
    super(message);
    this.name = 'PlasmidApiError';
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (json as { message?: string } | null)?.message ||
      `Request failed: ${response.status} ${response.statusText}`;
    const code = (json as { code?: string } | null)?.code || 'UNKNOWN';
    const category = (json as { category?: string } | null)?.category || 'INTERNAL';
    throw new PlasmidApiError(message, code, category);
  }

  return (json as { data: T }).data;
}

async function fetchPlasmidPage(
  search: string | undefined,
  offset: number
): Promise<PlasmidListResult> {
  const url = new URL('/api/plasmids', window.location.origin);
  if (search) {
    url.searchParams.append('search', search);
  }
  url.searchParams.append('limit', String(MAX_PAGE_SIZE));
  url.searchParams.append('offset', String(offset));
  const response = await fetch(url.toString());
  return unwrap<PlasmidListResult>(response);
}

/**
 * The whole library, like the legacy GMOCU table. The API serves at most
 * MAX_PAGE_SIZE rows per request, so the first page's `total` decides how
 * many further pages to fetch; those are requested concurrently.
 */
export async function listPlasmids(search?: string): Promise<PlasmidListResult> {
  const first = await fetchPlasmidPage(search, 0);
  const remainingOffsets: number[] = [];
  for (let offset = first.data.length; offset < first.total; offset += MAX_PAGE_SIZE) {
    remainingOffsets.push(offset);
  }
  const rest =
    first.data.length === 0
      ? []
      : await Promise.all(remainingOffsets.map((offset) => fetchPlasmidPage(search, offset)));

  const data = [first, ...rest].flatMap((page) => page.data);
  return { data, total: first.total, limit: data.length, offset: 0 };
}

export async function createPlasmid(payload: CreatePlasmidPayload): Promise<Plasmid> {
  const response = await fetch('/api/plasmids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Plasmid>(response);
}

export async function updatePlasmid(id: string, patch: UpdatePlasmidPayload): Promise<Plasmid> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Plasmid>(response);
}

export async function duplicatePlasmid(id: string): Promise<Plasmid> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
  return unwrap<Plasmid>(response);
}

export async function deletePlasmid(id: string): Promise<void> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- Cassettes ---

export interface CreateCassettePayload {
  name: string;
  type: Cassette['type'];
  sequence?: string;
  position?: number;
}

export interface UpdateCassettePayload {
  name?: string;
  type?: Cassette['type'];
  sequence?: string | null;
  position?: number;
}

/** Every cassette in the library, for the table's Cassettes column and picker */
export async function listAllCassettes(): Promise<Cassette[]> {
  const response = await fetch('/api/cassettes');
  return unwrap<Cassette[]>(response);
}

export async function listCassettes(plasmidId: string): Promise<Cassette[]> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/cassettes`);
  return unwrap<Cassette[]>(response);
}

export async function createCassette(
  plasmidId: string,
  payload: CreateCassettePayload
): Promise<Cassette> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/cassettes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Cassette>(response);
}

export async function updateCassette(id: string, patch: UpdateCassettePayload): Promise<Cassette> {
  const response = await fetch(`/api/cassettes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Cassette>(response);
}

export async function deleteCassette(id: string): Promise<void> {
  const response = await fetch(`/api/cassettes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- GMOs ---

export interface CreateGmoPayload {
  organismName: string;
  approval?: string;
  targetRiskGroup?: number;
  dateGenerated?: string;
}

export interface UpdateGmoPayload {
  approval?: string;
  targetRiskGroup?: number;
  dateGenerated?: string;
  dateDestroyed?: string | null;
}

export async function listGmos(plasmidId: string): Promise<Gmo[]> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/gmos`);
  return unwrap<Gmo[]>(response);
}

export async function createGmo(plasmidId: string, payload: CreateGmoPayload): Promise<Gmo> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/gmos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Gmo>(response);
}

export interface AddFavouriteGmosResult {
  created: Gmo[];
  skipped: string[];
}

/** Add every favourite organism as a GMO (legacy -ADDFAV-) */
export async function addFavouriteGmos(plasmidId: string): Promise<AddFavouriteGmosResult> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/gmos/favourites`, {
    method: 'POST',
  });
  return unwrap<AddFavouriteGmosResult>(response);
}

export async function updateGmo(id: string, patch: UpdateGmoPayload): Promise<Gmo> {
  const response = await fetch(`/api/gmos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Gmo>(response);
}

export async function deleteGmo(id: string): Promise<void> {
  const response = await fetch(`/api/gmos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- Primers ---

export interface CreatePrimerPayload {
  name: string;
  sequence: string;
}

export interface UpdatePrimerPayload {
  name?: string;
  sequence?: string;
}

export async function listPrimers(plasmidId: string): Promise<Primer[]> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/primers`);
  return unwrap<Primer[]>(response);
}

export async function createPrimer(
  plasmidId: string,
  payload: CreatePrimerPayload
): Promise<Primer> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/primers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Primer>(response);
}

export async function updatePrimer(id: string, patch: UpdatePrimerPayload): Promise<Primer> {
  const response = await fetch(`/api/primers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Primer>(response);
}

export async function deletePrimer(id: string): Promise<void> {
  const response = await fetch(`/api/primers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- Features ---

export interface CreateFeaturePayload {
  name: string;
  type: Feature['type'];
  startPos: number;
  endPos: number;
  strand?: Feature['strand'];
}

export interface UpdateFeaturePayload {
  name?: string;
  type?: Feature['type'];
  startPos?: number;
  endPos?: number;
  strand?: Feature['strand'];
}

export async function listFeatures(plasmidId: string): Promise<Feature[]> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/features`);
  return unwrap<Feature[]>(response);
}

export async function createFeature(
  plasmidId: string,
  payload: CreateFeaturePayload
): Promise<Feature> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Feature>(response);
}

export async function updateFeature(id: string, patch: UpdateFeaturePayload): Promise<Feature> {
  const response = await fetch(`/api/features/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Feature>(response);
}

export async function deleteFeature(id: string): Promise<void> {
  const response = await fetch(`/api/features/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- Attachments ---

export async function listAttachments(plasmidId: string): Promise<AttachmentMeta[]> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/attachments`);
  return unwrap<AttachmentMeta[]>(response);
}

export async function uploadAttachment(plasmidId: string, file: File): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return unwrap<AttachmentMeta>(response);
}

export async function deleteAttachment(id: string): Promise<void> {
  const response = await fetch(`/api/attachments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

/** Browser navigation to this URL downloads the file */
export function attachmentDownloadUrl(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}`;
}

// --- GenBank ---

export async function getGenbankMeta(plasmidId: string): Promise<GenbankMeta | null> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/genbank`);
  return unwrap<GenbankMeta | null>(response);
}

export async function uploadGenbank(plasmidId: string, file: File): Promise<GenbankMeta> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/genbank`, {
    method: 'PUT',
    body: formData,
  });
  return unwrap<GenbankMeta>(response);
}

export async function deleteGenbank(plasmidId: string): Promise<void> {
  const response = await fetch(`/api/plasmids/${encodeURIComponent(plasmidId)}/genbank`, {
    method: 'DELETE',
  });
  await unwrap<{ plasmidId: string }>(response);
}

/** Browser navigation to this URL downloads the GenBank file */
export function genbankDownloadUrl(plasmidId: string): string {
  return `/api/plasmids/${encodeURIComponent(plasmidId)}/genbank?download=1`;
}

// --- Formblatt-Z readiness ---

/** One readiness entry per plasmid (row-level indicator) */
export async function fetchPlasmidReadiness(): Promise<PlasmidReadiness[]> {
  const response = await fetch('/api/plasmids/readiness');
  return unwrap<PlasmidReadiness[]>(response);
}
