/**
 * Cassette API validation schemas (ADR-0007, layer 1: API boundary)
 * Zod schemas validate shape/type at the route boundary;
 * domain invariants (plasmid existence, position defaulting) stay in CassetteService.
 */

import { z } from 'zod';

const CASSETTE_NAME_MAX_LENGTH = 255;
const SEQUENCE_MAX_LENGTH = 1_000_000;

const cassetteTypeSchema = z.enum([
  'promoter',
  'terminator',
  'marker',
  'origin',
  'resistance',
  'other',
]);

/**
 * POST /api/plasmids/[id]/cassettes request body
 * plasmidId comes from the URL, not the body.
 */
export const createCassetteSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Cassette name is required').max(CASSETTE_NAME_MAX_LENGTH),
    sequence: z.string().max(SEQUENCE_MAX_LENGTH).optional(),
    type: cassetteTypeSchema,
    position: z.number().int().nonnegative('Position cannot be negative').optional(),
  })
  .strict();

/**
 * PATCH /api/cassettes/[id] request body
 * All fields optional; `null` sequence clears the stored sequence.
 */
export const updateCassetteSchema = z
  .object({
    name: z.string().trim().min(1, 'Cassette name cannot be empty').max(CASSETTE_NAME_MAX_LENGTH),
    sequence: z.string().max(SEQUENCE_MAX_LENGTH).nullable(),
    type: cassetteTypeSchema,
    position: z.number().int().nonnegative('Position cannot be negative'),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateCassetteRequest = z.infer<typeof createCassetteSchema>;
export type UpdateCassetteRequest = z.infer<typeof updateCassetteSchema>;
