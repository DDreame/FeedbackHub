import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const apiUrl = process.env.VITE_API_URL || 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3010,
    proxy: {
      '/v1': {
        target: apiUrl,
        changeOrigin: true,
      },
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
})
