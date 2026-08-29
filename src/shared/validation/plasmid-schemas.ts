/**
 * Plasmid API validation schemas (ADR-0007, layer 1: API boundary)
 * Zod schemas validate shape/type at the route boundary;
 * domain invariants (uniqueness, parent existence) stay in PlasmidService.
 */

import { z } from 'zod';

const PLASMID_NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 10_000;

const plasmidStatusSchema = z.enum(['draft', 'validated', 'archived']);

/**
 * POST /api/plasmids request body
 */
export const createPlasmidSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Plasmid name is required').max(PLASMID_NAME_MAX_LENGTH),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    sizeBp: z.number().int().positive('Plasmid size must be greater than 0').optional(),
    parentId: z.string().min(1).optional(),
    backboneVector: z.string().max(PLASMID_NAME_MAX_LENGTH).optional(),
    status: plasmidStatusSchema.optional(),
  })
  .strict();

/**
 * PATCH /api/plasmids/[id] request body
 * All fields optional; `null` clears a nullable column (sizeBp, parentId).
 * Empty-string description is allowed (clears the field content).
 */
export const updatePlasmidSchema = z
  .object({
    name: z.string().trim().min(1, 'Plasmid name cannot be empty').max(PLASMID_NAME_MAX_LENGTH),
    description: z.string().max(DESCRIPTION_MAX_LENGTH),
    sizeBp: z.number().int().positive('Plasmid size must be greater than 0').nullable(),
    parentId: z.string().min(1).nullable(),
    backboneVector: z.string().max(PLASMID_NAME_MAX_LENGTH).nullable(),
    status: plasmidStatusSchema,
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreatePlasmidRequest = z.infer<typeof createPlasmidSchema>;
export type UpdatePlasmidRequest = z.infer<typeof updatePlasmidSchema>;

export { stripUndefined } from './strip-undefined';
