import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const inputVariants = cva(
  // Base styles
  'w-full px-3 py-2 border rounded-md font-normal transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      state: {
        default:
          'border-gray-300 text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:bg-gray-900 dark:hover:border-gray-600 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-gray-950',
        error:
          'border-red-300 text-gray-900 placeholder-gray-400 bg-white hover:border-red-400 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-700 dark:text-gray-100 dark:placeholder-gray-500 dark:bg-gray-900 dark:hover:border-red-600 dark:focus-visible:ring-red-400 dark:focus-visible:ring-offset-gray-950',
        success:
          'border-emerald-300 text-gray-900 placeholder-gray-400 bg-white hover:border-emerald-400 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-700 dark:text-gray-100 dark:placeholder-gray-500 dark:bg-gray-900 dark:hover:border-emerald-600 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-gray-950',
      },
      inputSize: {
        sm: 'text-xs h-7',
        md: 'text-sm h-9',
        lg: 'text-base h-11',
      },
    },
    defaultVariants: {
      state: 'default',
      inputSize: 'md',
    },
  }
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  caption?: string;
  error?: string;
  icon?: React.ReactNode;
  inputSize?: VariantProps<typeof inputVariants>['inputSize'];
}

/**
 * Input component
 * Text input with validation states, labels, and captions
 *
 * @example
 * <Input label="Plasmid name" placeholder="e.g., pGMO-001" />
 * <Input state="error" error="Name is required" />
 * <Input caption="Must be unique across project" />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { state, inputSize, className, label, caption, error, icon, disabled, required, id, ...props },
    ref
  ) => {
    // Determine state based on error presence
    const displayState = error ? 'error' : state;

    // Associate the label with the input (WCAG 1.3.1)
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-600">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={clsx(
              inputVariants({
                state: displayState,
                inputSize,
              }),
              icon && 'pl-9',
              className
            )}
            {...props}
          />
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}

        {caption && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{caption}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
