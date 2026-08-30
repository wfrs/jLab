/**
 * Settings API client (browser-side)
 * Thin fetch wrapper that unwraps the standard API envelopes (ADR-0008).
 */

import { OrganismTarget } from '@/domain/types';

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

/** SQLite hands booleans back as 0/1 — normalize for React state */
function normalizeTarget(target: OrganismTarget): OrganismTarget {
  return { ...target, favourite: Boolean(target.favourite) };
}

export async function listOrganismTargets(): Promise<OrganismTarget[]> {
  const response = await fetch('/api/settings/organism-targets');
  return (await unwrap<OrganismTarget[]>(response)).map(normalizeTarget);
}

export async function addOrganismTarget(organismName: string): Promise<OrganismTarget> {
  const response = await fetch('/api/settings/organism-targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organismName }),
  });
  return normalizeTarget(await unwrap<OrganismTarget>(response));
}

export async function setOrganismTargetFavourite(
  id: string,
  favourite: boolean
): Promise<OrganismTarget> {
  const response = await fetch(`/api/settings/organism-targets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favourite }),
  });
  return normalizeTarget(await unwrap<OrganismTarget>(response));
}

export async function removeOrganismTarget(id: string): Promise<void> {
  const response = await fetch(`/api/settings/organism-targets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await unwrap<{ id: string }>(response);
}
