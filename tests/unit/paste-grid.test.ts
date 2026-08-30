/**
 * Unit Tests: clipboard paste parsing for the plasmid table (pure logic)
 */

import {
  buildRowCreate,
  buildRowPatch,
  normalizeStatus,
  parsePasteText,
} from '@/components/plasmids/paste-grid';

describe('paste-grid', () => {
  describe('parsePasteText', () => {
    it('splits rows on newlines and cells on tabs', () => {
      expect(parsePasteText('a\tb\nc\td')).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);
    });

    it('normalizes Windows/Mac line endings', () => {
      expect(parsePasteText('a\r\nb\rc')).toEqual([['a'], ['b'], ['c']]);
    });

    it('drops the trailing empty row from a whole-row copy', () => {
      expect(parsePasteText('a\tb\n')).toEqual([['a', 'b']]);
    });

    it('keeps a single value as a 1×1 grid', () => {
      expect(parsePasteText('hello')).toEqual([['hello']]);
    });

    it('keeps interior empty cells', () => {
      expect(parsePasteText('a\t\tc')).toEqual([['a', '', 'c']]);
    });
  });

  describe('normalizeStatus', () => {
    it('accepts labels case-insensitively', () => {
      expect(normalizeStatus('Draft')).toBe('draft');
      expect(normalizeStatus('VALIDATED')).toBe('validated');
      expect(normalizeStatus(' archived ')).toBe('archived');
    });

    it('rejects unknown values', () => {
      expect(normalizeStatus('planned')).toBeNull();
      expect(normalizeStatus('')).toBeNull();
    });
  });

  describe('buildRowPatch', () => {
    it('maps cells to their aligned columns', () => {
      const { patch, errors } = buildRowPatch(
        ['name', 'description', 'sizeBp', 'status'],
        ['pNew', 'A vector', '6425', 'Validated']
      );
      expect(patch).toEqual({
        name: 'pNew',
        description: 'A vector',
        sizeBp: 6425,
        status: 'validated',
      });
      expect(errors).toEqual([]);
    });

    it('tolerates thousands separators in sizes and clears on empty', () => {
      expect(buildRowPatch(['sizeBp'], ['6,425']).patch).toEqual({ sizeBp: 6425 });
      expect(buildRowPatch(['sizeBp'], ['']).patch).toEqual({ sizeBp: null });
    });

    it('collects errors without dropping valid cells', () => {
      const { patch, errors } = buildRowPatch(
        ['name', 'sizeBp', 'status'],
        ['ok', 'not-a-number', 'bogus']
      );
      expect(patch).toEqual({ name: 'ok' });
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('not-a-number');
      expect(errors[1]).toContain('bogus');
    });

    it('skips null (unknown/overflow) columns and rejects empty names', () => {
      const { patch, errors } = buildRowPatch([null, 'name'], ['ignored', '  ']);
      expect(patch).toEqual({});
      expect(errors).toEqual(['name cannot be empty']);
    });
  });

  describe('buildRowCreate (rows pasted below the table)', () => {
    it('builds a full create payload from aligned cells', () => {
      const { payload, errors } = buildRowCreate(
        ['name', 'description', 'sizeBp', 'status'],
        ['pNew', 'A vector', '6,425', 'Validated']
      );
      expect(payload).toEqual({
        name: 'pNew',
        description: 'A vector',
        sizeBp: 6425,
        status: 'validated',
      });
      expect(errors).toEqual([]);
    });

    it('creates from a name alone', () => {
      expect(buildRowCreate(['name'], ['pOnly']).payload).toEqual({ name: 'pOnly' });
    });

    it('omits an empty size instead of sending null', () => {
      const { payload } = buildRowCreate(['name', 'sizeBp'], ['pNew', '']);
      expect(payload).toEqual({ name: 'pNew' });
    });

    it('refuses a row without a name column in reach', () => {
      // Anchored on the description column, the name column is behind the
      // block and can never be filled
      const { payload, errors } = buildRowCreate(['description', 'sizeBp'], ['vector', '100']);
      expect(payload).toBeNull();
      expect(errors).toEqual(['needs a name to create a plasmid']);
    });

    it('refuses an empty name without doubling the explanation', () => {
      const { payload, errors } = buildRowCreate(['name', 'sizeBp'], ['  ', '100']);
      expect(payload).toBeNull();
      expect(errors).toEqual(['name cannot be empty']);
    });

    it('keeps cell errors alongside a valid payload', () => {
      const { payload, errors } = buildRowCreate(['name', 'status'], ['pNew', 'bogus']);
      expect(payload).toEqual({ name: 'pNew' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('bogus');
    });
  });
});
