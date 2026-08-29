/**
 * Glossary API client (browser-side)
 * Thin fetch wrapper that unwraps the standard API envelopes (ADR-0008).
 */

import { GlossaryFeature, Organism } from '@/domain/types';

export interface CreateGlossaryFeaturePayload {
  annotation: string;
  alias?: string;
  risk?: string;
  organism?: string;
}

export interface UpdateGlossaryFeaturePayload {
  annotation?: string;
  alias?: string | null;
  risk?: string;
  organism?: string | null;
}

async function unwrap<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (json as { message?: string } | null)?.message ||
      `Request failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return (json as { data: T }).data;
}

export async function listGlossaryFeatures(search?: string): Promise<GlossaryFeature[]> {
  const url = new URL('/api/glossary/features', window.location.origin);
  if (search) {
    url.searchParams.append('search', search);
  }
  const response = await fetch(url.toString());
  return unwrap<GlossaryFeature[]>(response);
}

export async function createGlossaryFeature(
  payload: CreateGlossaryFeaturePayload
): Promise<GlossaryFeature> {
  const response = await fetch('/api/glossary/features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<GlossaryFeature>(response);
}

export async function updateGlossaryFeature(
  id: string,
  patch: UpdateGlossaryFeaturePayload
): Promise<GlossaryFeature> {
  const response = await fetch(`/api/glossary/features/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<GlossaryFeature>(response);
}

export async function deleteGlossaryFeature(id: string): Promise<void> {
  const response = await fetch(`/api/glossary/features/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}

// --- Organisms ---

export interface CreateOrganismPayload {
  fullName: string;
  shortName?: string;
  riskGroup?: string;
}

export interface UpdateOrganismPayload {
  fullName?: string;
  shortName?: string | null;
  riskGroup?: string;
}

export async function listOrganisms(search?: string): Promise<Organism[]> {
  const url = new URL('/api/glossary/organisms', window.location.origin);
  if (search) {
    url.searchParams.append('search', search);
  }
  const response = await fetch(url.toString());
  return unwrap<Organism[]>(response);
}

export async function createOrganism(payload: CreateOrganismPayload): Promise<Organism> {
  const response = await fetch('/api/glossary/organisms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap<Organism>(response);
}

export async function updateOrganism(id: string, patch: UpdateOrganismPayload): Promise<Organism> {
  const response = await fetch(`/api/glossary/organisms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrap<Organism>(response);
}

export async function deleteOrganism(id: string): Promise<void> {
  const response = await fetch(`/api/glossary/organisms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}
