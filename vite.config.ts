import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative paths so that Electron's loadFile() works in production
  base: './',
  build: {
    outDir: 'dist',
  },
});
