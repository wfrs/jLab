/**
 * Unit Tests: Cassette API validation schemas (ADR-0007, layer 1)
 */

import { createCassetteSchema, updateCassetteSchema } from '@shared/validation/cassette-schemas';

describe('createCassetteSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createCassetteSchema.safeParse({ name: 'pLac promoter', type: 'promoter' });
    expect(result.success).toBe(true);
  });

  it('accepts a full valid payload', () => {
    const result = createCassetteSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'AmpR',
      sequence: 'ATGCATGC',
      type: 'resistance',
      position: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name or type', () => {
    expect(createCassetteSchema.safeParse({ type: 'promoter' }).success).toBe(false);
    expect(createCassetteSchema.safeParse({ name: 'x' }).success).toBe(false);
  });

  it('rejects an empty / whitespace-only name', () => {
    expect(createCassetteSchema.safeParse({ name: '  ', type: 'other' }).success).toBe(false);
  });

  it('rejects an invalid type', () => {
    expect(createCassetteSchema.safeParse({ name: 'x', type: 'enhancer' }).success).toBe(false);
  });

  it('rejects a negative or non-integer position', () => {
    expect(createCassetteSchema.safeParse({ name: 'x', type: 'other', position: -1 }).success).toBe(
      false
    );
    expect(
      createCassetteSchema.safeParse({ name: 'x', type: 'other', position: 1.5 }).success
    ).toBe(false);
  });

  it('accepts position 0', () => {
    expect(createCassetteSchema.safeParse({ name: 'x', type: 'other', position: 0 }).success).toBe(
      true
    );
  });

  it('rejects unknown keys and plasmidId in the body (comes from the URL)', () => {
    expect(
      createCassetteSchema.safeParse({ name: 'x', type: 'other', plasmidId: 'p1' }).success
    ).toBe(false);
  });
});

describe('updateCassetteSchema', () => {
  it('accepts a single-field update (autosave shape)', () => {
    expect(updateCassetteSchema.safeParse({ name: 'AmpR v2' }).success).toBe(true);
    expect(updateCassetteSchema.safeParse({ type: 'marker' }).success).toBe(true);
    expect(updateCassetteSchema.safeParse({ position: 0 }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateCassetteSchema.safeParse({}).success).toBe(false);
  });

  it('accepts null sequence (clears the column)', () => {
    expect(updateCassetteSchema.safeParse({ sequence: null }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(updateCassetteSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('rejects a negative position', () => {
    expect(updateCassetteSchema.safeParse({ position: -3 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(updateCassetteSchema.safeParse({ nam: 'typo' }).success).toBe(false);
  });
});
