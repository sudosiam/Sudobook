import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'Sudo Books',
        short_name: 'SudoBooks',
        description: 'Business Finance & Accounting for Biswajit Power Hub',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          const has = (pkg: string) =>
            id.includes(`node_modules/${pkg}/`) || id.includes(`node_modules\\${pkg}\\`);

          if (has('recharts')) return 'vendor-charts';
          if (has('motion')) return 'vendor-motion';
          if (has('dexie') || has('dexie-react-hooks')) return 'vendor-db';
          if (has('@supabase')) return 'vendor-supabase';
          if (has('react-hook-form') || has('@hookform') || has('zod')) return 'vendor-forms';
          if (has('react-router') || has('react-router-dom')) return 'vendor-router';
          if (has('react') || has('react-dom') || has('scheduler')) return 'vendor-react';

          return 'vendor-misc';
        },
      },
    },
  },
});
