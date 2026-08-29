/**
 * Unit Tests: cassette token domain logic (legacy GMOCU parity)
 */

import {
  parseCassetteTokens,
  cassetteBaseTokens,
  unresolvedTokens,
  normalizeAnnotation,
  renameTokenInContent,
} from '@domain/cassette-tokens';

describe('parseCassetteTokens', () => {
  it('splits on dashes', () => {
    expect(parseCassetteTokens('a-b-c')).toEqual([
      { raw: 'a', base: 'a' },
      { raw: 'b', base: 'b' },
      { raw: 'c', base: 'c' },
    ]);
  });

  it('strips bracket variants from base but keeps them in raw', () => {
    expect(parseCassetteTokens('prom[strong]-gene')).toEqual([
      { raw: 'prom[strong]', base: 'prom' },
      { raw: 'gene', base: 'gene' },
    ]);
  });

  it('does not split on dashes inside brackets (legacy: variants removed before split)', () => {
    expect(parseCassetteTokens('prom[v-2]-gene')).toEqual([
      { raw: 'prom[v-2]', base: 'prom' },
      { raw: 'gene', base: 'gene' },
    ]);
  });

  it('keeps empty segments for double/leading/trailing dashes', () => {
    expect(parseCassetteTokens('a--b-').map((t) => t.base)).toEqual(['a', '', 'b', '']);
  });

  it('handles a single token and empty content', () => {
    expect(parseCassetteTokens('solo')).toEqual([{ raw: 'solo', base: 'solo' }]);
    expect(parseCassetteTokens('')).toEqual([{ raw: '', base: '' }]);
  });
});

describe('cassetteBaseTokens', () => {
  it('returns trimmed non-empty base tokens', () => {
    expect(cassetteBaseTokens('a[x]--b-')).toEqual(['a', 'b']);
  });
});

describe('unresolvedTokens', () => {
  const glossary = new Set(['pLac', 'GFP', 'T7term']);

  it('flags tokens missing from the glossary', () => {
    expect(unresolvedTokens('pLac-GFPP-T7term', glossary)).toEqual(['GFPP']);
  });

  it('resolves variant tokens by their base (legacy behavior)', () => {
    expect(unresolvedTokens('pLac[weak]-GFP', glossary)).toEqual([]);
  });

  it('is case-sensitive (legacy: SELECT WHERE annotation = ?)', () => {
    expect(unresolvedTokens('plac', glossary)).toEqual(['plac']);
  });

  it('returns empty for fully resolved content', () => {
    expect(unresolvedTokens('pLac-GFP-T7term', glossary)).toEqual([]);
  });
});

describe('renameTokenInContent (legacy update_cassettes parity)', () => {
  it('renames full tokens only', () => {
    expect(renameTokenInContent('GFP-RFP-GFP', 'GFP', 'eGFP')).toBe('eGFP-RFP-eGFP');
  });

  it('does not touch tokens that merely contain the old name as substring', () => {
    expect(renameTokenInContent('GFPx-xGFP', 'GFP', 'eGFP')).toBe('GFPx-xGFP');
  });

  it('preserves bracket variants', () => {
    expect(renameTokenInContent('GFP[bright]-RFP', 'GFP', 'eGFP')).toBe('eGFP[bright]-RFP');
  });

  it('handles single-token content and no-match content', () => {
    expect(renameTokenInContent('GFP', 'GFP', 'eGFP')).toBe('eGFP');
    expect(renameTokenInContent('RFP-T7term', 'GFP', 'eGFP')).toBe('RFP-T7term');
  });

  it('handles normalized annotations containing parentheses', () => {
    expect(renameTokenInContent('my_(v2)-GFP', 'my_(v2)', 'my_(v3)')).toBe('my_(v3)-GFP');
  });
});

describe('normalizeAnnotation', () => {
  it('applies the exact legacy replacements', () => {
    expect(normalizeAnnotation('my-feature [v2] x')).toBe('my_feature_(v2)_x');
  });

  it('trims surrounding whitespace before normalizing', () => {
    expect(normalizeAnnotation('  GFP  ')).toBe('GFP');
  });

  it('leaves already-normalized annotations unchanged', () => {
    expect(normalizeAnnotation('pLac_promoter')).toBe('pLac_promoter');
  });
});
