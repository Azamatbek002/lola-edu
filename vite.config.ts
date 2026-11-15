import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Ilova versiyasi: Toshkent vaqti bo'yicha qurilgan sana va commit (Vercel beradi)
const built = new Date(Date.now() + 5 * 3600_000).toISOString()
const APP_VERSION = `${built.slice(8, 10)}.${built.slice(5, 7)}.${built.slice(0, 4)} ${built.slice(11, 16)}` + (process.env.VERCEL_GIT_COMMIT_SHA ? ' · ' + process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : '')

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // src/lib/pwa.ts → initServiceWorker
      includeAssets: ['icon.svg', 'logo.svg', 'og-image.png', 'icons/apple-touch-icon.png', 'icons/favicon-48.png'],
      manifest: {
        id: '/',
        name: 'Lola Edu — Türk Dili Markazi',
        short_name: 'Lola Edu',
        description: "Lola Edu Türk Dili Markazi: o'quvchilar, guruhlar, davomat, to'lovlar va lidlar bitta ilovada",
        lang: 'uz',
        dir: 'ltr',
        theme_color: '#f6f3ee',
        background_color: '#f6f3ee',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        start_url: '/?source=pwa',
        scope: '/',
        categories: ['education', 'business', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Davomat', url: '/attendance', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: "To'lovlar", url: '/finance/payments', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Lidlar', url: '/leads', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: "O'quvchilar", url: '/students', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], globIgnores: ['**/*vietnamese*', '**/*-math-*', '**/*-symbols-*'], navigateFallback: '/index.html', cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any)
