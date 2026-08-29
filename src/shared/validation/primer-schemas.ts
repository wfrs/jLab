/**
 * Primer API validation schemas (ADR-0007, layer 1: API boundary)
 * gcPercent/tmCelsius are derived server-side and not accepted as input.
 */

import { z } from 'zod';

const PRIMER_NAME_MAX_LENGTH = 255;
const PRIMER_SEQUENCE_MAX_LENGTH = 500;

/**
 * POST /api/plasmids/[id]/primers request body
 */
export const createPrimerSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Primer name is required').max(PRIMER_NAME_MAX_LENGTH),
    sequence: z
      .string()
      .trim()
      .min(1, 'Primer sequence is required')
      .max(PRIMER_SEQUENCE_MAX_LENGTH),
  })
  .strict();

/**
 * PATCH /api/primers/[id] request body
 */
export const updatePrimerSchema = z
  .object({
    name: z.string().trim().min(1, 'Primer name cannot be empty').max(PRIMER_NAME_MAX_LENGTH),
    sequence: z
      .string()
      .trim()
      .min(1, 'Primer sequence cannot be empty')
      .max(PRIMER_SEQUENCE_MAX_LENGTH),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreatePrimerRequest = z.infer<typeof createPrimerSchema>;
export type UpdatePrimerRequest = z.infer<typeof updatePrimerSchema>;
