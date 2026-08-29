/**
 * Unit Tests: Plasmid API validation schemas (ADR-0007, layer 1)
 */

import {
  createPlasmidSchema,
  updatePlasmidSchema,
  stripUndefined,
} from '@shared/validation/plasmid-schemas';

describe('createPlasmidSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createPlasmidSchema.safeParse({ name: 'pGFP' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('pGFP');
    }
  });

  it('accepts a full valid payload', () => {
    const result = createPlasmidSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'pGFP',
      description: 'Green fluorescent protein vector',
      sizeBp: 5400,
      parentId: 'parent-1',
      status: 'validated',
    });
    expect(result.success).toBe(true);
  });

  it('trims the name', () => {
    const result = createPlasmidSchema.safeParse({ name: '  pGFP  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('pGFP');
    }
  });

  it('rejects a missing name', () => {
    const result = createPlasmidSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects an empty / whitespace-only name', () => {
    expect(createPlasmidSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createPlasmidSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a non-positive sizeBp', () => {
    expect(createPlasmidSchema.safeParse({ name: 'p1', sizeBp: 0 }).success).toBe(false);
    expect(createPlasmidSchema.safeParse({ name: 'p1', sizeBp: -100 }).success).toBe(false);
  });

  it('rejects a non-integer sizeBp', () => {
    expect(createPlasmidSchema.safeParse({ name: 'p1', sizeBp: 3.14 }).success).toBe(false);
  });

  it('rejects an invalid status', () => {
    expect(createPlasmidSchema.safeParse({ name: 'p1', status: 'published' }).success).toBe(false);
  });

  it('rejects unknown keys (catches client typos)', () => {
    expect(createPlasmidSchema.safeParse({ name: 'p1', sizebp: 100 }).success).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(createPlasmidSchema.safeParse({ name: 42 }).success).toBe(false);
    expect(createPlasmidSchema.safeParse({ name: 'p1', sizeBp: '5400' }).success).toBe(false);
  });
});

describe('updatePlasmidSchema', () => {
  it('accepts a single-field update (autosave shape)', () => {
    expect(updatePlasmidSchema.safeParse({ name: 'pGFP-2' }).success).toBe(true);
    expect(updatePlasmidSchema.safeParse({ status: 'archived' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updatePlasmidSchema.safeParse({}).success).toBe(false);
  });

  it('allows empty description (clearing the field)', () => {
    expect(updatePlasmidSchema.safeParse({ description: '' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(updatePlasmidSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('accepts null sizeBp and parentId (column clears)', () => {
    expect(updatePlasmidSchema.safeParse({ sizeBp: null }).success).toBe(true);
    expect(updatePlasmidSchema.safeParse({ parentId: null }).success).toBe(true);
  });

  it('rejects a non-positive sizeBp', () => {
    expect(updatePlasmidSchema.safeParse({ sizeBp: -5 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(updatePlasmidSchema.safeParse({ nam: 'typo' }).success).toBe(false);
  });
});

describe('stripUndefined', () => {
  it('removes undefined values but keeps null and falsy values', () => {
    const result = stripUndefined({
      a: undefined,
      b: null,
      c: '',
      d: 0,
      e: 'value',
    });
    expect(result).toEqual({ b: null, c: '', d: 0, e: 'value' });
    expect(Object.keys(result)).not.toContain('a');
  });

  it('returns an empty object unchanged', () => {
    expect(stripUndefined({})).toEqual({});
  });
});
