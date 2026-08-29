/**
 * Next.js configuration
 * Configures build, dev server, and module resolution
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for local development
  images: {
    unoptimized: true,
  },

  // webpack configuration for better development experience
  webpack: (config, { isServer }) => {
    config.cache = false;

    // Ignore optional knex database drivers
    if (!isServer) {
      config.externals = {
        ...config.externals,
        oracledb: 'commonjs oracledb',
        'pg-native': 'commonjs pg-native',
        mysql: 'commonjs mysql',
        mysql2: 'commonjs mysql2',
        'better-sqlite3': 'commonjs better-sqlite3',
        tedious: 'commonjs tedious',
      };
    }

    return config;
  },

  // Rewrites and redirects (when needed for integrations)
  async rewrites() {
    return {
      beforeFiles: [
        // Placeholder for integration rewrites (Google Drive, Sheets, etc.)
      ],
    };
  },

  // Environment variables (public + server-side)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },

  // Experimental features
  experimental: {
    // Enable server components by default
    serverComponentsExternalPackages: ['sqlite3', 'pino', 'knex'],
  },
};

export default nextConfig;
