import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  darkMode: 'class', // Enable dark mode via class attribute

  theme: {
    extend: {
      // System font stack: matches platform-native fonts
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: ['"Fira Code"', '"SF Mono"', 'Monaco', 'Monaco', 'monospace'],
      },

      // Colors: semantic color system
      colors: {
        inherit: 'inherit',
        transparent: 'transparent',
        current: 'currentColor',

        // Grayscale (for neutrals, text, borders)
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#030712',
        },

        // Blue (primary action color)
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#082F49',
        },

        // Emerald (success, valid)
        emerald: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBFBDA',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#134E4A',
          950: '#051E16',
        },

        // Amber (warning, incomplete)
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },

        // Red (error, danger)
        red: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#500724',
        },
      },

      // Spacing: 4px base unit (already Tailwind default)
      spacing: {
        '0': '0',
        '1': '0.25rem', // 4px
        '2': '0.5rem', // 8px
        '3': '0.75rem', // 12px
        '4': '1rem', // 16px
        '6': '1.5rem', // 24px
        '8': '2rem', // 32px
        '12': '3rem', // 48px
        '16': '4rem', // 64px
      },

      // Font sizes with line heights
      fontSize: {
        xs: ['12px', { lineHeight: '1.5' }], // 11pt (minimum)
        sm: ['14px', { lineHeight: '1.5' }], // 13pt (table headers)
        base: ['16px', { lineHeight: '1.625' }], // Body text
        lg: ['20px', { lineHeight: '1.4' }], // Subsection heading
        xl: ['24px', { lineHeight: '1.333' }], // Section heading
        '2xl': ['28px', { lineHeight: '1.2' }], // Page title
        '3xl': ['32px', { lineHeight: '1.2' }],
        '4xl': ['36px', { lineHeight: '1.1' }],
      },

      // Shadow system
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
        none: 'none',
      },

      // Transitions
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },

      // Border radius
      borderRadius: {
        none: '0',
        sm: '0.125rem', // 2px
        md: '0.375rem', // 6px (default Tailwind)
        lg: '0.5rem', // 8px
        xl: '0.75rem', // 12px
        full: '9999px',
      },

      // Z-index
      zIndex: {
        auto: 'auto',
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
      },

      // Max widths
      maxWidth: {
        '7xl': '80rem', // 1280px (wide tables)
        '4xl': '56rem', // 896px (forms, dialogs)
      },

      // Width helpers
      width: {
        '80': '20rem', // 320px (sidebar default)
        '90': '22.5rem', // 360px (detail panel)
        '96': '24rem', // 384px (sidebar large)
      },

      // Screen
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },

  plugins: [
    // Add any Tailwind plugins here
  ],
};

export default config;
