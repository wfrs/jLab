/**
 * Zod schemas for the database maintenance endpoints (ADR-0007).
 */

import { z } from 'zod';
import { RESET_CONFIRMATION } from '@/services/database-reset.service';

export const resetDatabaseSchema = z.object({
  /**
   * Exact, case-sensitive. Typing a phrase forces a context switch in a way a
   * "yes/no" dialog does not, and the server checking it too means the UI is
   * not the only thing standing between a stray request and 84 MB.
   */
  confirmation: z.literal(RESET_CONFIRMATION, {
    errorMap: () => ({ message: `Confirmation must be exactly "${RESET_CONFIRMATION}"` }),
  }),
});

export type ResetDatabaseInput = z.infer<typeof resetDatabaseSchema>;
