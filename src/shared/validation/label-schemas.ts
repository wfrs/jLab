/**
 * Zod schemas for the label endpoints (ADR-0007: validate at the boundary).
 */

import { z } from 'zod';

/** Ids arrive as a comma-separated query parameter: `?ids=a,b,c` */
export const labelIdsQuerySchema = z
  .string()
  .min(1, 'ids is required')
  .transform((raw) =>
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  )
  .refine((ids) => ids.length > 0, 'ids must contain at least one id')
  .refine((ids) => ids.length <= 500, 'ids is limited to 500 labels per request');

export const recordPrintsSchema = z.object({
  kind: z.enum(['plasmid', 'glycerol']),
  ids: z.array(z.string().min(1)).min(1, 'At least one id is required').max(500),
});

export type RecordPrintsInput = z.infer<typeof recordPrintsSchema>;

/** A prep batch: one date and operator, one concentration per plasmid */
export const recordPrepBatchSchema = z.object({
  preppedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'preppedOn must be an ISO date (YYYY-MM-DD)'),
  operatorInitials: z.string().trim().min(1, 'operatorInitials is required').max(10),
  entries: z
    .array(
      z.object({
        plasmidId: z.string().min(1),
        concentrationNgUl: z.number().nonnegative().finite().nullable().optional(),
      })
    )
    .min(1, 'At least one plasmid is required')
    .max(500),
});

export type RecordPrepBatchInputDto = z.infer<typeof recordPrepBatchSchema>;

/** A glycerol stock as created or edited from the detail panel */
export const createGlycerolStockSchema = z.object({
  stockId: z.string().trim().min(1, 'Stock ID is required').max(32),
  plasmidId: z.string().min(1).nullable().optional(),
  organism: z.string().trim().min(1, 'Organism is required').max(64),
  strain: z.string().trim().min(1, 'Strain is required').max(120),
  constructLabel: z.string().trim().max(200).nullable().optional(),
  madeOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'madeOn must be an ISO date (YYYY-MM-DD)')
    .nullable()
    .optional(),
  operatorInitials: z.string().trim().max(10).nullable().optional(),
  bacterialResistance: z.string().trim().max(120).nullable().optional(),
});

export const updateGlycerolStockSchema = createGlycerolStockSchema.partial();

export type CreateGlycerolStockDto = z.infer<typeof createGlycerolStockSchema>;
export type UpdateGlycerolStockDto = z.infer<typeof updateGlycerolStockSchema>;
