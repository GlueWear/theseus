import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {strictPort: true, proxy: {'/~/': {target: process.env.THESEUS_HOST || 'http://127.0.0.1:8083', changeOrigin: true}}},
  build: {target: 'es2022', sourcemap: false},
});
