import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// base: '/rummy-pwa/' assumes deploying to GitHub Pages at
// https://<username>.github.io/rummy-pwa/ — change to '/' if using a
// custom domain, or to '/<your-repo-name>/' if you name the repo differently.
export default defineConfig({
  base: '/rummy/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Family Rummy',
        short_name: 'Rummy',
        description: '13-card Rummy for the family, play for points across a round',
        theme_color: '#1F4B3F',
        background_color: '#1F4B3F',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})


