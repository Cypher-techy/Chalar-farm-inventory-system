/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'bcryptjs'],
  // Migrations are read from disk at runtime (src/db/index.ts); make sure the SQL
  // files ship inside every serverless function bundle on Vercel.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/migrations/**/*'],
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'chalarfarms.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
