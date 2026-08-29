/**
 * PlasmidStatusBadge
 * Shows the plasmid lifecycle status with its real label.
 * (The generic StatusBadge hardcodes labels like "Incomplete"/"Valid",
 * which belong to Formblatt-Z readiness, not lifecycle status.)
 */

import { Badge, BadgeProps } from '@/components/ui/Badge';
import { Plasmid } from '@/domain/types';

const STATUS_CONFIG: Record<Plasmid['status'], { variant: BadgeProps['variant']; label: string }> =
  {
    draft: { variant: 'default', label: 'Draft' },
    validated: { variant: 'success', label: 'Validated' },
    archived: { variant: 'warning', label: 'Archived' },
  };

export function PlasmidStatusBadge({
  status,
  className,
}: {
  status: Plasmid['status'];
  className?: string;
}): JSX.Element {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
