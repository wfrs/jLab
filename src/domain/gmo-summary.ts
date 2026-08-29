/**
 * GMO summary display string (legacy GMOCU parity)
 *
 * Legacy stored a denormalized GMO_summary column built as:
 *   'RG {rg}   |   Approval: {approval}   |   {generated}   -   {destroyed|tbd}   |   {organism}'
 * and string-replaced 'tbd' on destruction. v2 derives the same string from
 * the record's fields at display/report time instead of storing it.
 */

import { Gmo } from './types';

/** Placeholder legacy uses while a GMO has not been destroyed yet */
export const DESTROYED_PENDING = 'tbd';

export function buildGmoSummary(
  gmo: Pick<
    Gmo,
    'targetRiskGroup' | 'approval' | 'dateGenerated' | 'dateDestroyed' | 'organismName'
  >
): string {
  const destroyed = gmo.dateDestroyed || DESTROYED_PENDING;
  return `RG ${gmo.targetRiskGroup}   |   Approval: ${gmo.approval}   |   ${gmo.dateGenerated}   -   ${destroyed}   |   ${gmo.organismName}`;
}
