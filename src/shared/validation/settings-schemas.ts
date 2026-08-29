/**
 * Settings API validation schema (ADR-0007, layer 1)
 */

import { z } from 'zod';

const TEXT_FIELD_MAX_LENGTH = 255;
const INITIALS_MAX_LENGTH = 10;

/**
 * PATCH /api/settings request body
 * Empty strings are allowed (clearing a field); email must be valid when set.
 */
export const updateSettingsSchema = z
  .object({
    name: z.string().trim().max(TEXT_FIELD_MAX_LENGTH),
    initials: z.string().trim().max(INITIALS_MAX_LENGTH),
    email: z.union([z.literal(''), z.string().trim().email('Invalid email address')]),
    institution: z.string().trim().max(TEXT_FIELD_MAX_LENGTH),
    duplicateGmos: z.boolean(),
  })
  .partial()
  .strict()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateSettingsRequest = z.infer<typeof updateSettingsSchema>;
