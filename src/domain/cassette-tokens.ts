/**
 * Cassette token domain logic (pure functions)
 *
 * Legacy GMOCU parity:
 * - Cassette content is a `-`-separated string of glossary feature annotations,
 *   optionally with bracket variants: `promoter[strong]-gene-terminator`.
 * - Resolution strips bracket blocks first, then splits on `-`
 *   (so a `-` inside brackets does NOT split), and each base token must
 *   exactly match a glossary annotation (case-sensitive).
 * - Annotations are normalized on write: '-'→'_', '['→'(', ']'→')', ' '→'_'.
 */

export interface CassetteToken {
  /** Token text as typed, including any [variant] block */
  raw: string;
  /** Token with bracket blocks removed — matched against the glossary */
  base: string;
}

/**
 * Split cassette content into tokens on `-` separators that are outside
 * bracket blocks. Mirrors legacy behavior (strip `[...]`, then split on '-').
 * Empty segments (leading/trailing/double dashes) are kept as empty-raw
 * tokens so the UI can flag them; callers may filter them out.
 */
export function parseCassetteTokens(content: string): CassetteToken[] {
  const tokens: CassetteToken[] = [];
  let raw = '';
  let base = '';
  let depth = 0;

  for (const char of content) {
    if (char === '[') {
      depth += 1;
      raw += char;
    } else if (char === ']') {
      depth = Math.max(0, depth - 1);
      raw += char;
    } else if (char === '-' && depth === 0) {
      tokens.push({ raw, base });
      raw = '';
      base = '';
    } else {
      raw += char;
      if (depth === 0) {
        base += char;
      }
    }
  }
  tokens.push({ raw, base });

  return tokens;
}

/**
 * Non-empty base tokens of a cassette content string.
 */
export function cassetteBaseTokens(content: string): string[] {
  return parseCassetteTokens(content)
    .map((token) => token.base.trim())
    .filter((base) => base.length > 0);
}

/**
 * Base tokens that do not resolve against the given glossary annotations.
 */
export function unresolvedTokens(content: string, annotations: Set<string>): string[] {
  return cassetteBaseTokens(content).filter((base) => !annotations.has(base));
}

/**
 * Rename a token throughout a cassette content string (legacy update_cassettes).
 * Only full tokens are replaced — substrings of other tokens are untouched —
 * and bracket variants are preserved: `old[v]-x` → `new[v]-x`.
 * (Legacy used the regex `(?<=-)OLD(?=[-[])` on `-content-`.)
 */
export function renameTokenInContent(content: string, oldBase: string, newBase: string): string {
  return parseCassetteTokens(content)
    .map((token) => {
      // Simple form only: the base followed by optional bracket blocks —
      // matches what the legacy regex could rename; anything else is left as-is
      if (token.base === oldBase && token.raw.startsWith(oldBase)) {
        return newBase + token.raw.slice(oldBase.length);
      }
      return token.raw;
    })
    .join('-');
}

/**
 * Normalize a glossary annotation exactly as legacy GMOCU does:
 * '-'→'_', '['→'(', ']'→')', spaces→'_'
 */
export function normalizeAnnotation(input: string): string {
  return input.trim().replace(/-/g, '_').replace(/\[/g, '(').replace(/\]/g, ')').replace(/ /g, '_');
}
