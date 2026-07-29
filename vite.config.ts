import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/KGA/',
  
  // LA SOLUZIONE ALLA SCHERMATA BIANCA:
  resolve: {
    dedupe: ['three']
  },

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'KGA — Personal Knowledge Graph',
        short_name: 'KGA',
        description: 'Il tuo Secondo Cervello 3D e locale',
        theme_color: '#050510',
        background_color: '#050510',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
      }
    })
  ]
});