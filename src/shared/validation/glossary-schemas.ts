/**
 * Glossary feature API validation schemas (ADR-0007, layer 1)
 * Shape/type checks only — annotation normalization and uniqueness live
 * in GlossaryFeatureService (legacy parity: invalid characters are
 * normalized, not rejected).
 */

import { z } from 'zod';

const ANNOTATION_MAX_LENGTH = 255;
const TEXT_FIELD_MAX_LENGTH = 255;

/**
 * POST /api/glossary/features request body
 */
export const createGlossaryFeatureSchema = z
  .object({
    id: z.string().uuid().optional(),
    annotation: z.string().trim().min(1, 'Annotation is required').max(ANNOTATION_MAX_LENGTH),
    alias: z.string().max(TEXT_FIELD_MAX_LENGTH).optional(),
    risk: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH).optional(),
    organism: z.string().max(TEXT_FIELD_MAX_LENGTH).optional(),
  })
  .strict();

/**
 * PATCH /api/glossary/features/[id] request body
 * `null` clears alias/organism.
 */
export const updateGlossaryFeatureSchema = z
  .object({
    annotation: z.string().trim().min(1, 'Annotation cannot be empty').max(ANNOTATION_MAX_LENGTH),
    alias: z.string().max(TEXT_FIELD_MAX_LENGTH).nullable(),
    risk: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH),
    organism: z.string().max(TEXT_FIELD_MAX_LENGTH).nullable(),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateGlossaryFeatureRequest = z.infer<typeof createGlossaryFeatureSchema>;
export type UpdateGlossaryFeatureRequest = z.infer<typeof updateGlossaryFeatureSchema>;
