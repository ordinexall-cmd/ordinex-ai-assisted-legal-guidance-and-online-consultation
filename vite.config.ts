import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function ordinexApiHealthCheck(): Plugin {
  return {
    name: 'ordinex-api-health-check',
    configureServer() {
      const warn = () => {
        // eslint-disable-next-line no-console
        console.warn(
          '\n\u26a0\ufe0f  Ordinex API is not reachable at http://localhost:5000\n' +
            '   Seeded logins and /api routes will fail until the API is running.\n' +
            '   Start API:  npm run server:dev\n' +
            '   Both apps:  npm run dev:all\n',
        );
      };
      fetch('http://localhost:5000/api/health')
        .then((res) => { if (!res.ok) warn(); })
        .catch(() => warn());
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ordinexApiHealthCheck(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/pwa-192.png',
        'icons/pwa-512.png',
        'icons/pwa-512-maskable.png',
        'icons/apple-touch-icon.png',
        'brand/favicon-32.svg',
      ],
      manifest: false,
      // Use public/manifest.webmanifest; plugin still injects SW.
      strategies: 'generateSW',
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/socket.io'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ordinex-uploads',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    // Allow phones on same WiFi / laptop hotspot: http://LAPTOP_IP:5173
    host: true,
    port: 5173,
    // Cloudflare quick tunnel hostnames change every run (*.trycloudflare.com)
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
})
