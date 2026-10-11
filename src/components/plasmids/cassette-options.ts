/**
 * Cassette reuse options for the plasmid table (pure, unit-tested).
 *
 * A cassette is a combination of features ('Pt7-EGFP-tag6His-Tt7'), and many
 * plasmids carry the same one. The table offers every distinct content in
 * the library, most used first, so a cassette is picked rather than retyped.
 */

import { Cassette } from '@/domain/types';

export interface CassetteOption {
  content: string;
  /** Plasmids carrying this cassette */
  count: number;
}

/** Longest list the picker shows; type-ahead narrows it */
export const MAX_CASSETTE_OPTIONS = 50;

/** Separator between a plasmid's cassettes when they travel as one string (copy, paste) */
export const CASSETTE_LIST_SEPARATOR = '; ';

/** A plasmid's cassettes in position order, keyed by plasmid id */
export function groupCassettesByPlasmid(cassettes: readonly Cassette[]): Map<string, Cassette[]> {
  const byPlasmid = new Map<string, Cassette[]>();
  for (const cassette of cassettes) {
    const list = byPlasmid.get(cassette.plasmidId) ?? [];
    list.push(cassette);
    byPlasmid.set(cassette.plasmidId, list);
  }
  for (const list of byPlasmid.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  return byPlasmid;
}

/** Distinct contents with how many plasmids use each, most used first, then alphabetical */
export function cassetteOptions(cassettes: readonly Cassette[]): CassetteOption[] {
  const plasmidsByContent = new Map<string, Set<string>>();
  for (const cassette of cassettes) {
    const content = cassette.name.trim();
    if (content === '') {
      continue;
    }
    const plasmids = plasmidsByContent.get(content) ?? new Set<string>();
    plasmids.add(cassette.plasmidId);
    plasmidsByContent.set(content, plasmids);
  }
  return Array.from(plasmidsByContent, ([content, plasmids]) => ({
    content,
    count: plasmids.size,
  })).sort((a, b) => b.count - a.count || a.content.localeCompare(b.content));
}

/** Case-insensitive substring match on the content; an empty query keeps the order */
export function filterCassetteOptions(
  options: readonly CassetteOption[],
  query: string,
  limit: number = MAX_CASSETTE_OPTIONS
): CassetteOption[] {
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? options
      : options.filter((option) => option.content.toLowerCase().includes(needle));
  return matches.slice(0, limit);
}

export function joinCassetteContents(cassettes: readonly Cassette[]): string {
  return cassettes.map((cassette) => cassette.name).join(CASSETTE_LIST_SEPARATOR);
}

/** The inverse of joinCassetteContents for pasted cells; blanks are dropped */
export function splitCassetteContents(text: string): string[] {
  return text
    .split(CASSETTE_LIST_SEPARATOR.trim())
    .map((content) => content.trim())
    .filter((content) => content !== '');
}
