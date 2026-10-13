import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same defaults as src/lib/config.ts (the one production backend on Render).
const DEFAULT_API_URL = 'https://hostelbites-backend-jwmt.onrender.com';
const isDev = process.env.NODE_ENV !== 'production';

/** http(s) origin plus its ws(s) twin, so fetch and socket.io (polling + websocket) are both allowed. */
const originsFor = (raw) => {
  try {
    const u = new URL(raw);
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return [u.origin, `${ws}//${u.host}`];
  } catch {
    return [];
  }
};

const connectSrc = Array.from(new Set([
  "'self'",
  ...originsFor(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL),
  ...originsFor(process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL),
  // Local backend / HMR while developing only.
  ...(isDev ? ['http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*'] : []),
]));

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-eval' is only needed by the dev overlay / HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Store / product / proof photos come from the backend media links or https photo hosts; map tiles from CARTO.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  `connect-src ${connectSrc.join(' ')}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
