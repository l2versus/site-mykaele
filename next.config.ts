import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'instagram.com' },
      { protocol: 'https', hostname: '*.cdninstagram.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // === HTTPS / TLS ===
          // HSTS — force HTTPS for 2 years, include subdomains, allow preload list
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

          // === Clickjacking Protection ===
          { key: 'X-Frame-Options', value: 'DENY' },

          // === MIME Sniffing Protection ===
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // === XSS Protection ===
          { key: 'X-XSS-Protection', value: '1; mode=block' },

          // === Referrer Policy ===
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // === Permissions / Feature Policy ===
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },

          // === Content Security Policy ===
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com data:",
              `connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://api.mercadopago.com https://connect.facebook.net https://wa.me ${SITE_URL}`,
              "frame-src 'self' https://www.google.com https://www.mercadopago.com.br",
              "media-src 'self' blob: data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              isProd ? "upgrade-insecure-requests" : '',
            ].filter(Boolean).join('; '),
          },

          // === Cross-Origin Policies ===
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },

          // === DNS Prefetch Control ===
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // CORS para webhook do Mercado Pago
        source: '/api/payments/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' },
          // Relax CSP for webhook
          { key: 'Content-Security-Policy', value: "default-src 'self'" },
        ],
      },
      {
        // Cache busting for favicon/icons
        source: '/icon',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
      {
        // Cache estático imutável para assets do Next.js
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache longo para mídia (imagens, vídeos, fontes)
        source: '/media/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        // Cache para uploads
        source: '/uploads/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
    ]
  },
  // Otimizações de produção
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Security: disable x-powered-by
  compress: true,
};

export default nextConfig;
