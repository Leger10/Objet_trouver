import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  resolve: {
    extensions: ['.jsx', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
        },
      },
    },
  },
  preview: {
    port: 4173,
    headers: {
      'Content-Security-Policy': "default-src 'self' https: http: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: http: data: blob:; font-src 'self' https: data:; connect-src 'self' https: http: wss: ws:;",
    },
  },
});