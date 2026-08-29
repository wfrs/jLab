/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic colors
        primary: 'var(--color-primary, #5e6ad2)',
        secondary: 'var(--color-secondary, rgb(107, 114, 128))',
        success: 'var(--color-success, #27a644)',
        error: 'var(--color-error, rgb(239, 68, 68))',
        warning: 'var(--color-warning, rgb(245, 158, 11))',
        info: 'var(--color-info, #5e6ad2)',

        // Linear design language (references/linear-design-system.md in the
        // design-taste-frontend skill). The dark-relevant steps of the stock
        // gray/blue scales are remapped so every existing dark: class lands
        // on Linear's surface ladder and single lavender accent.
        gray: {
          50: '#f5f6f6', // inverse-surface-1 (light contexts only)
          100: '#f7f8f8', // ink — primary text on dark
          200: '#e6e9ef',
          300: '#d0d6e0', // ink-muted — secondary text
          400: '#8a8f98', // ink-subtle — tertiary text
          500: '#62666d', // ink-tertiary — disabled/footnotes
          600: '#34343a', // hairline-strong
          700: '#23252a', // hairline — default borders
          800: '#0f1011', // surface-1 — cards, panels
          900: '#010102', // canvas — page background
          950: '#010102', // canvas
        },
        blue: {
          50: '#eef0fd',
          100: '#dfe3fb',
          200: '#c3c9f6',
          300: '#a5aef7',
          400: '#828fff', // accent hover (Linear primary-hover)
          500: '#6f7ce7', // focus rings
          600: '#5e6ad2', // accent (Linear primary)
          700: '#5e6ad2', // accent — dark resting state
          800: '#4a54ad', // accent pressed
          900: '#333a6e', // lavender-tinted selection surfaces
          950: '#22264a',
        },
        emerald: {
          400: '#3fbf5f', // success text on dark
          500: '#2fb350',
          600: '#27a644', // Linear semantic-success
          700: '#1f8737',
        },

        // Linear surface ladder — explicit elevation steps (levels 1–4)
        canvas: '#010102',
        surface: {
          1: '#0f1011',
          2: '#141516',
          3: '#18191a',
          4: '#191a1b',
        },
        hairline: {
          DEFAULT: '#23252a',
          strong: '#34343a',
          tertiary: '#3e3e44',
        },
        accent: {
          DEFAULT: '#5e6ad2',
          hover: '#828fff',
          focus: '#5e69d1',
        },
      },
      fontSize: {
        // Type scale
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      spacing: {
        // 8px base unit
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        base: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

module.exports = config;
