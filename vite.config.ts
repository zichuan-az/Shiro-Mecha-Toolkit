import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron 打包后通过 file:// 载入，必须使用相对路径
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          icons: ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  }
})
