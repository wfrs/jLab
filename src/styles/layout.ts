/**
 * Layout and spacing system for jlab
 * Based on 4px base unit (Tailwind default)
 * All measurements are in Tailwind units where 1 = 4px
 */

export const spacing = {
  // Base increments (in Tailwind units, 1 = 4px)
  xs: 'px-1 py-1', // 4px
  sm: 'px-2 py-2', // 8px
  md: 'px-3 py-3', // 12px
  lg: 'px-4 py-4', // 16px
  xl: 'px-6 py-6', // 24px
  '2xl': 'px-8 py-8', // 32px
  '3xl': 'px-12 py-12', // 48px
};

export const margins = {
  xs: 'm-1', // 4px
  sm: 'm-2', // 8px
  md: 'm-3', // 12px
  lg: 'm-4', // 16px
  xl: 'm-6', // 24px
  '2xl': 'm-8', // 32px
  '3xl': 'm-12', // 48px
};

export const gaps = {
  xs: 'gap-1', // 4px
  sm: 'gap-2', // 8px
  md: 'gap-3', // 12px
  lg: 'gap-4', // 16px
  xl: 'gap-6', // 24px
  '2xl': 'gap-8', // 32px
};

/**
 * Layout dimensions
 */
export const layout = {
  // Header height (fixed, always visible)
  headerHeight: 'h-12', // 48px

  // Sidebar/panel widths
  sidebarSmall: 'w-64', // 256px (filters, narrow sidebars)
  sidebarDefault: 'w-80', // 320px (detail panel)
  sidebarLarge: 'w-96', // 384px (wide panels)

  // Content widths for readability
  contentMaxWidth: 'max-w-7xl', // 1280px (comfortable for wide tables)
  narrowWidth: 'max-w-4xl', // 896px (for forms, dialogs)

  // Common container padding
  containerPaddingHorizontal: 'px-6', // 24px on sides
  containerPaddingVertical: 'py-6', // 24px top/bottom
  containerPadding: 'px-6 py-6', // Both

  // Table-specific spacing
  tableCellPadding: 'px-4 py-3', // 16px horizontal, 12px vertical
  tableRowGap: 'gap-0.5', // 2px between rows (minimal visual gap)

  // Control spacing
  controlGap: 'gap-2', // 8px between buttons/inputs
  controlGroupGap: 'gap-4', // 16px between groups
};

/**
 * Responsive breakpoint helpers
 */
export const breakpoints = {
  // Mobile-first approach (Tailwind default)
  sm: 'sm:', // 640px
  md: 'md:', // 768px
  lg: 'lg:', // 1024px
  xl: 'xl:', // 1280px
  '2xl': '2xl:', // 1536px
};

/**
 * Z-index scale (for stacking context)
 */
export const zIndex = {
  base: 'z-0', // Default
  raised: 'z-10', // Slightly raised (cards, hover states)
  floating: 'z-20', // Floating elements (tooltips, dropdowns)
  modal: 'z-40', // Modal dialogs
  tooltip: 'z-50', // Top layer (tooltips, popovers)
  sticky: 'z-30', // Sticky headers
};

/**
 * Shadow system
 */
export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm', // Subtle elevation
  md: 'shadow-md', // Standard elevation
  lg: 'shadow-lg', // Prominent elevation
  xl: 'shadow-xl', // High elevation
  inner: 'shadow-inner', // Inset shadow for depth
};

/**
 * Border radius system
 */
export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm', // 2px (minimal rounding)
  md: 'rounded-md', // 6px (default)
  lg: 'rounded-lg', // 8px (cards, panels)
  xl: 'rounded-xl', // 12px (large components)
  full: 'rounded-full', // 50% (circles, badges)
};

/**
 * Transition/animation timing
 */
export const transitions = {
  fast: 'transition-all duration-150 ease-in-out', // Snappy (150ms)
  normal: 'transition-all duration-200 ease-in-out', // Standard (200ms)
  slow: 'transition-all duration-300 ease-in-out', // Deliberate (300ms)
};

/**
 * Common layout patterns
 */
export const patterns = {
  // Flexbox column (vertical stack)
  flexCol: 'flex flex-col',
  flexColCenter: 'flex flex-col items-center justify-center',
  flexColBetween: 'flex flex-col justify-between',

  // Flexbox row (horizontal stack)
  flexRow: 'flex flex-row',
  flexRowCenter: 'flex flex-row items-center justify-center',
  flexRowBetween: 'flex flex-row justify-between items-center',

  // Grid layouts
  gridAuto: 'grid grid-cols-auto',
  gridTwoCol: 'grid grid-cols-2 gap-4',
  gridThreeCol: 'grid grid-cols-3 gap-4',

  // Full screen/window
  fullscreen: 'h-screen w-screen',
  fullHeight: 'h-full w-full',

  // Scrollable containers
  scrollableY: 'overflow-y-auto',
  scrollableX: 'overflow-x-auto',
  scrollableBoth: 'overflow-auto',

  // Centering
  absoluteCenter: 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
};

/**
 * Form layout
 */
export const forms = {
  container: 'flex flex-col gap-4',
  fieldGroup: 'flex flex-col gap-2',
  fieldLabel: 'text-sm font-medium text-gray-700 dark:text-gray-300',
  fieldInput:
    'px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
  fieldCaption: 'text-xs text-gray-500 dark:text-gray-400 mt-1',
  fieldError: 'text-xs text-red-600 dark:text-red-400 mt-1',
};

/**
 * Table layout
 */
export const tables = {
  container: 'w-full border-collapse',
  header: 'bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
  row: 'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50',
  cell: 'px-4 py-3 text-left text-sm text-gray-900 dark:text-gray-100',
  headerCell:
    'px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 tracking-wide',
};
