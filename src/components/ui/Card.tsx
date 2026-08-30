import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

// Linear elevation: cards lift one surface step above canvas with a hairline
// border and top-edge highlight — never a drop shadow on dark
const cardVariants = cva('rounded-lg border', {
  variants: {
    variant: {
      default:
        'bg-white border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:shadow-none dark:panel-lift',
      elevated:
        'bg-white border-gray-200 shadow-md dark:bg-surface-2 dark:border-gray-600 dark:shadow-none dark:panel-lift',
      outlined: 'bg-transparent border-gray-300 dark:border-gray-700',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  children: React.ReactNode;
}

/**
 * Card component
 * Container for grouping related content
 *
 * @example
 * <Card variant="default" padding="md">
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant, padding, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          cardVariants({
            variant,
            padding,
          }),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * CardHeader: Title section at top of card
 */
export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 pb-3 border-b border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * CardTitle: Main heading in card header
 *
 * `as` exists because a card is not always the same depth: on a page whose
 * cards sit directly under the <h1> an <h2> is right, but where they sit inside
 * a titled section the section owns the <h2> and the card is an <h3>. Defaults
 * to h2, so existing pages are unaffected.
 */
export function CardTitle({
  className,
  children,
  as: Heading = 'h2',
}: {
  className?: string;
  children: React.ReactNode;
  as?: 'h2' | 'h3';
}): JSX.Element {
  return (
    <Heading className={clsx('text-lg font-semibold text-gray-900 dark:text-gray-100', className)}>
      {children}
    </Heading>
  );
}

/**
 * CardDescription: Subtitle or description text
 */
export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return <p className={clsx('text-sm text-gray-600 dark:text-gray-400', className)}>{children}</p>;
}

/**
 * CardContent: Main content area
 */
export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return <div className={clsx('pt-4', className)}>{children}</div>;
}

/**
 * CardFooter: Action area at bottom
 */
export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={clsx(
        'flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {children}
    </div>
  );
}
