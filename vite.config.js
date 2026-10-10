import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'site',
  base: './',
  resolve: {
    alias: {
      'node-seal-wasm?url': `${fileURLToPath(new URL('./node_modules/node-seal/dist/seal_throws.wasm', import.meta.url))}?url`,
      'node-seal-wasm': fileURLToPath(new URL('./node_modules/node-seal/dist/seal_throws.wasm', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
