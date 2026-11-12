import { defineConfig } from 'vite';
export default defineConfig({ root: 'web', build: { target: 'es2022', outDir: '../dist', emptyOutDir: true } });
