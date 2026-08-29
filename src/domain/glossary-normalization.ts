/**
 * Glossary value normalization shared by every import path
 * (legacy GMOCU v1 database import and Excel template import).
 *
 * Legacy parity: risk arrives as the literal string 'None' in the shipped
 * Excel templates and in v1 databases; legacy rewrote it with
 * `UPDATE Features SET risk = REPLACE(risk, 'None', 'No Risk')`
 * (gmocu.py L1647). Blank cells were filled with 'None' first
 * (`fillna(value='None')`, L732), so they took the same route.
 */

/** Legacy default when a feature carries no risk classification */
export const DEFAULT_RISK = 'No Risk';

/** Legacy default risk group for an organism with no RG value */
export const DEFAULT_RISK_GROUP = '1';

/** Trimmed value, or null when absent/blank */
export function trimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Feature risk as jlab stores it: blank and the literal 'None' both become
 * 'No Risk'. Unlike legacy's substring REPLACE this is an exact match, so a
 * value such as 'None known' is preserved.
 */
export function normalizeRisk(risk: string | null | undefined): string {
  const trimmed = trimmedOrNull(risk);
  if (!trimmed || trimmed === 'None') {
    return DEFAULT_RISK;
  }
  return trimmed;
}
