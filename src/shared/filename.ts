/**
 * Filename helpers for generated downloads
 */

/**
 * Make a user-provided string safe as a filename segment:
 * keeps letters, digits, dot, dash; everything else becomes underscore.
 * Returns '' for empty/whitespace input.
 */
export function sanitizeFilenamePart(input: string): string {
  return input
    .trim()
    .replace(/[^A-Za-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
