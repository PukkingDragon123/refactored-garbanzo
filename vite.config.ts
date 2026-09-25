import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces a normal multi-file build in dist/.
// `npm run build:single` inlines everything into one self-contained dist-single/index.html.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
  server: { host: true },
}));
