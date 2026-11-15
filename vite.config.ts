import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Única fuente de verdad de la versión: package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: { target: 'es2020', outDir: 'dist' },
});
