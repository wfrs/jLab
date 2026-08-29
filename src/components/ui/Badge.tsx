import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const badgeVariants = cva(
  // Base styles
  'inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded-full text-xs',
  {
    variants: {
      // Dark mode follows the Linear status-badge grammar: quiet translucent
      // tint + tinted text + hairline ring, never a solid saturated fill
      variant: {
        success:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600/30',
        warning:
          'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30',
        error:
          'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border border-red-300 dark:border-red-500/30',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-600/20 dark:text-blue-300 border border-blue-300 dark:border-blue-600/40',
        default:
          'bg-gray-100 text-gray-800 dark:bg-surface-2 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Badge component
 * Small indicator for status, tags, or labels
 *
 * @example
 * <Badge variant="success">Valid</Badge>
 * <Badge variant="warning" icon={<AlertIcon />}>Incomplete</Badge>
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant, size, className, icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          badgeVariants({
            variant,
            size,
          }),
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * StatusBadge: Convenient wrapper for common status values
 */
export function StatusBadge({
  status,
  className,
}: {
  status: 'success' | 'warning' | 'error' | 'info' | 'draft';
  className?: string;
}): JSX.Element {
  const statusConfig: Record<
    string,
    { variant: VariantProps<typeof badgeVariants>['variant']; label: string }
  > = {
    success: { variant: 'success', label: 'Valid' },
    warning: { variant: 'warning', label: 'Incomplete' },
    error: { variant: 'error', label: 'Error' },
    info: { variant: 'info', label: 'Info' },
    draft: { variant: 'default', label: 'Draft' },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
