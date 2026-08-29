/**
 * Semantic color tokens for jlab
 * These colors have consistent meanings across the app and support both light and dark modes
 */

export const semanticColors = {
  // Status indicators - functional meanings
  status: {
    success: {
      light: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      dark: 'dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
    },
    warning: {
      light: 'bg-amber-50 text-amber-900 border-amber-200',
      dark: 'dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
    },
    error: {
      light: 'bg-red-50 text-red-900 border-red-200',
      dark: 'dark:bg-red-950 dark:text-red-100 dark:border-red-800',
    },
    info: {
      light: 'bg-blue-50 text-blue-900 border-blue-200',
      dark: 'dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
    },
  },

  // Plasmid-specific domain states
  plasmid: {
    new: {
      light: 'bg-slate-50 text-slate-900 border-slate-200',
      dark: 'dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700',
    },
    valid: {
      light: 'bg-green-50 text-green-900 border-green-200',
      dark: 'dark:bg-green-950 dark:text-green-100 dark:border-green-800',
    },
    incomplete: {
      light: 'bg-yellow-50 text-yellow-900 border-yellow-200',
      dark: 'dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800',
    },
    synced: {
      light: 'bg-blue-50 text-blue-900 border-blue-200',
      dark: 'dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
    },
  },

  // Interactive element states
  interactive: {
    default: {
      light: 'bg-white border-gray-300 text-gray-900',
      dark: 'dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100',
    },
    hover: {
      light: 'bg-gray-50 border-gray-400 text-gray-900',
      dark: 'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100',
    },
    active: {
      light: 'bg-blue-50 border-blue-500 text-blue-900',
      dark: 'dark:bg-blue-900 dark:border-blue-600 dark:text-blue-100',
    },
    disabled: {
      light: 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed',
      dark: 'dark:bg-gray-800 dark:border-gray-700 dark:text-gray-600 dark:cursor-not-allowed',
    },
  },

  // Text colors with semantic meaning
  text: {
    primary: {
      light: 'text-gray-900',
      dark: 'dark:text-gray-100',
    },
    secondary: {
      light: 'text-gray-600',
      dark: 'dark:text-gray-400',
    },
    tertiary: {
      light: 'text-gray-500',
      dark: 'dark:text-gray-500',
    },
    disabled: {
      light: 'text-gray-400',
      dark: 'dark:text-gray-600',
    },
  },

  // Background surfaces
  surface: {
    primary: {
      light: 'bg-white',
      dark: 'dark:bg-gray-950',
    },
    secondary: {
      light: 'bg-gray-50',
      dark: 'dark:bg-gray-900',
    },
    tertiary: {
      light: 'bg-gray-100',
      dark: 'dark:bg-gray-800',
    },
  },

  // Border colors
  border: {
    light: {
      light: 'border-gray-200',
      dark: 'dark:border-gray-800',
    },
    default: {
      light: 'border-gray-300',
      dark: 'dark:border-gray-700',
    },
    emphasis: {
      light: 'border-gray-400',
      dark: 'dark:border-gray-600',
    },
  },

  // Action colors (buttons, links)
  action: {
    primary: {
      light: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
      dark: 'dark:bg-blue-700 dark:text-white dark:hover:bg-blue-600 dark:active:bg-blue-800',
    },
    secondary: {
      light: 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400',
      dark: 'dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:active:bg-gray-500',
    },
    danger: {
      light: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      dark: 'dark:bg-red-700 dark:text-white dark:hover:bg-red-600 dark:active:bg-red-800',
    },
    success: {
      light: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
      dark: 'dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600 dark:active:bg-emerald-800',
    },
  },

  // Focus states for keyboard navigation
  focus: {
    light: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    dark: 'dark:focus:ring-blue-400 dark:focus:ring-offset-gray-950',
  },
};

/**
 * Helper function to combine semantic color classes
 * Example: getColorClasses('status', 'success')
 */
export function getColorClasses(category: keyof typeof semanticColors, variant: string): string {
  const category_obj = semanticColors[category] as Record<string, any>;
  const variant_obj = category_obj?.[variant];

  if (!variant_obj) {
    return '';
  }

  if (typeof variant_obj === 'string') {
    return variant_obj;
  }

  if (variant_obj.light && variant_obj.dark) {
    return `${variant_obj.light} ${variant_obj.dark}`;
  }

  return '';
}
