// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '#types': path.resolve(__dirname, '../types'),
    },
  },
  server: {
    port: 4005,
    proxy: {
      '/api': {
        target: 'http://localhost:4006',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4006',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
