/**
 * Feature API validation schemas (ADR-0007, layer 1: API boundary)
 */

import { z } from 'zod';

const FEATURE_NAME_MAX_LENGTH = 255;

const featureTypeSchema = z.enum([
  'gene',
  'promoter',
  'terminator',
  'rbs',
  'his_tag',
  'flag_tag',
  'other',
]);

const strandSchema = z.enum(['+', '-']);
const positionSchema = z.number().int().min(1, 'Positions are 1-based');

/**
 * POST /api/plasmids/[id]/features request body
 */
export const createFeatureSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Feature name is required').max(FEATURE_NAME_MAX_LENGTH),
    type: featureTypeSchema,
    startPos: positionSchema,
    endPos: positionSchema,
    strand: strandSchema.optional(),
  })
  .strict();

/**
 * PATCH /api/features/[id] request body
 */
export const updateFeatureSchema = z
  .object({
    name: z.string().trim().min(1, 'Feature name cannot be empty').max(FEATURE_NAME_MAX_LENGTH),
    type: featureTypeSchema,
    startPos: positionSchema,
    endPos: positionSchema,
    strand: strandSchema,
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateFeatureRequest = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureRequest = z.infer<typeof updateFeatureSchema>;
