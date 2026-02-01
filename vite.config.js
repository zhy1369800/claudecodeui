import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')


  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'favicon.svg', 'logo-64.png', 'logo-128.png', 'logo-256.png', 'logo-512.png'],
        manifest: {
          name: 'Claude Code UI',
          short_name: 'Claude UI',
          description: 'A web-based UI for Claude Code CLI',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'logo-64.png',
              sizes: '64x64',
              type: 'image/png'
            },
            {
              src: 'logo-128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: 'logo-256.png',
              sizes: '256x256',
              type: 'image/png'
            },
            {
              src: 'logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-codemirror': [
              '@uiw/react-codemirror',
              '@codemirror/lang-css',
              '@codemirror/lang-html',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/lang-markdown',
              '@codemirror/lang-python',
              '@codemirror/theme-one-dark'
            ],
            'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-clipboard', '@xterm/addon-webgl']
          }
        }
      }
    }
  }
})
