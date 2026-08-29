/**
 * PlasmidReadinessCell
 * Row-level Formblatt-Z readiness indicator (locked UX requirement).
 * A quiet dot plus a short label; the reasons ride along as a tooltip and
 * in the accessible name, so the row stays scannable without a popup.
 */

import type { PlasmidReadiness, ReadinessLevel } from '@/services/data-quality.service';

const LEVEL_STYLES: Record<ReadinessLevel, { dot: string; text: string; label: string }> = {
  ready: {
    dot: 'bg-emerald-500',
    text: 'text-gray-500 dark:text-gray-400',
    label: 'Ready',
  },
  incomplete: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Incomplete',
  },
  blocked: {
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    label: 'Blocked',
  },
};

export function PlasmidReadinessCell({
  readiness,
  plasmidName,
}: {
  /** Undefined while the readiness request is still in flight */
  readiness: PlasmidReadiness | undefined;
  plasmidName: string;
}): JSX.Element {
  if (!readiness) {
    return <span className="text-xs text-gray-500 dark:text-gray-500">—</span>;
  }

  const styles = LEVEL_STYLES[readiness.level];
  const detail = readiness.reasons.length > 0 ? `: ${readiness.reasons.join('; ')}` : '';

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={readiness.reasons.join('\n') || 'Contributes complete Formblatt-Z rows'}
      aria-label={`Formblatt-Z readiness of ${plasmidName}: ${styles.label}${detail}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
      <span className={`text-xs ${styles.text}`}>{styles.label}</span>
    </span>
  );
}
