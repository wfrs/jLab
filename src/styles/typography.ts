/**
 * Typography scale for jlab
 * Follows HIG guidelines:
 * - Desktop minimum: 10pt
 * - Mobile minimum: 11pt
 * - All scales use 4px increments for consistency
 */

export const typographyScale = {
  // Page titles
  pageTitle: {
    className: 'text-4xl font-bold leading-tight tracking-tight',
    size: '36px',
    weight: 'bold',
    lineHeight: '1.2',
    letterSpacing: 'tight',
  },

  // Section headings (in panels, tables, forms)
  sectionHeading: {
    className: 'text-2xl font-semibold leading-snug tracking-tight',
    size: '24px',
    weight: 'semibold',
    lineHeight: '1.333',
    letterSpacing: 'tight',
  },

  // Subsection headings
  subheading: {
    className: 'text-xl font-semibold leading-snug',
    size: '20px',
    weight: 'semibold',
    lineHeight: '1.4',
  },

  // Table headers, important labels
  tableHeader: {
    className: 'text-sm font-medium leading-normal tracking-wide',
    size: '14px',
    weight: 'medium',
    lineHeight: '1.5',
    letterSpacing: 'wide',
  },

  // Table cell content
  tableCell: {
    className: 'text-sm font-normal leading-normal',
    size: '14px',
    weight: 'normal',
    lineHeight: '1.5',
  },

  // Body text (descriptions, explanations)
  body: {
    className: 'text-base font-normal leading-relaxed',
    size: '16px',
    weight: 'normal',
    lineHeight: '1.625',
  },

  // Form labels
  label: {
    className: 'text-sm font-medium leading-normal uppercase tracking-wide',
    size: '14px',
    weight: 'medium',
    lineHeight: '1.5',
    letterSpacing: 'wide',
  },

  // Captions, helper text, error messages
  caption: {
    className: 'text-xs font-normal leading-relaxed text-gray-600 dark:text-gray-400',
    size: '12px',
    weight: 'normal',
    lineHeight: '1.667',
  },

  // Status badges, small labels
  badge: {
    className: 'text-xs font-medium px-2 py-1 rounded-full',
    size: '12px',
    weight: 'medium',
    lineHeight: '1.5',
  },

  // Button text
  button: {
    className: 'text-sm font-medium leading-normal',
    size: '14px',
    weight: 'medium',
    lineHeight: '1.5',
  },

  // Small button text
  buttonSmall: {
    className: 'text-xs font-medium leading-normal',
    size: '12px',
    weight: 'medium',
    lineHeight: '1.5',
  },

  // Code or monospace text
  code: {
    className: 'font-mono text-sm leading-normal bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded',
    size: '14px',
    weight: 'normal',
    lineHeight: '1.5',
    fontFamily: 'monospace',
  },

  // Very small UI text (timestamps, versions)
  micro: {
    className: 'text-xs font-normal leading-normal text-gray-500 dark:text-gray-500',
    size: '11px',
    weight: 'normal',
    lineHeight: '1.5',
  },
};

/**
 * Text style combinations for common use cases
 */
export const textStyles = {
  // Page structure
  pageTitle: typographyScale.pageTitle.className,
  sectionHeading: typographyScale.sectionHeading.className,
  subheading: typographyScale.subheading.className,

  // Data presentation
  tableHeader: typographyScale.tableHeader.className,
  tableCell: typographyScale.tableCell.className,

  // Forms
  label: typographyScale.label.className,
  caption: typographyScale.caption.className,

  // Interaction
  button: typographyScale.button.className,
  buttonSmall: typographyScale.buttonSmall.className,
  badge: typographyScale.badge.className,

  // Content
  body: typographyScale.body.className,
  code: typographyScale.code.className,
  micro: typographyScale.micro.className,
};

/**
 * Helper to get all attributes for a text style
 */
export function getTextStyle(style: keyof typeof typographyScale) {
  return typographyScale[style];
}
