/**
 * Organism + GMO API validation schemas (ADR-0007, layer 1)
 */

import { z } from 'zod';

const TEXT_FIELD_MAX_LENGTH = 255;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isoDateSchema = z.string().regex(ISO_DATE_PATTERN, 'Must be an ISO date (YYYY-MM-DD)');

/**
 * POST /api/glossary/organisms request body
 */
export const createOrganismSchema = z
  .object({
    id: z.string().uuid().optional(),
    fullName: z.string().trim().min(1, 'Full name is required').max(TEXT_FIELD_MAX_LENGTH),
    shortName: z.string().max(TEXT_FIELD_MAX_LENGTH).optional(),
    riskGroup: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH).optional(),
  })
  .strict();

/**
 * PATCH /api/glossary/organisms/[id] request body
 */
export const updateOrganismSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name cannot be empty').max(TEXT_FIELD_MAX_LENGTH),
    shortName: z.string().max(TEXT_FIELD_MAX_LENGTH).nullable(),
    riskGroup: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

/**
 * POST /api/plasmids/[id]/gmos request body
 * plasmidId comes from the URL, not the body.
 */
export const createGmoSchema = z
  .object({
    id: z.string().uuid().optional(),
    organismName: z.string().trim().min(1, 'Organism is required').max(TEXT_FIELD_MAX_LENGTH),
    approval: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH).optional(),
    targetRiskGroup: z.number().int().min(1).optional(),
    dateGenerated: isoDateSchema.optional(),
  })
  .strict();

/**
 * PATCH /api/gmos/[id] request body
 * `dateDestroyed` marks destruction; `null` reverts it.
 */
export const updateGmoSchema = z
  .object({
    approval: z.string().trim().min(1).max(TEXT_FIELD_MAX_LENGTH),
    targetRiskGroup: z.number().int().min(1),
    dateGenerated: isoDateSchema,
    dateDestroyed: isoDateSchema.nullable(),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateOrganismRequest = z.infer<typeof createOrganismSchema>;
export type UpdateOrganismRequest = z.infer<typeof updateOrganismSchema>;
export type CreateGmoRequest = z.infer<typeof createGmoSchema>;
export type UpdateGmoRequest = z.infer<typeof updateGmoSchema>;
