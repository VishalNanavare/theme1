import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import fg from 'fast-glob';
import pagesPlugin from './scripts/vite-plugin-pages.mjs';
import { renderAll, OUT_DIR } from './scripts/render-pages.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const srcDir = path.join(root, OUT_DIR);

export default defineConfig(async () => {
  // Render once up front so the input glob below sees every page.
  await renderAll({ root });

  const inputs = await fg('*.html', { cwd: srcDir, absolute: true });

  return {
    root: srcDir,
    base: '/',
    publicDir: path.join(root, 'src/public'),
    appType: 'mpa',
    plugins: [pagesPlugin({ root })],
    resolve: {
      alias: { '~bootstrap': path.join(root, 'node_modules/bootstrap') },
    },
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        scss: {
          loadPaths: [path.join(root, 'src/styles'), path.join(root, 'node_modules')],
          // Vite 5 defaults to Dart Sass's legacy JS API, under which
          // `loadPaths` is not honoured for nested `@use`/`@import` resolution
          // (verified: a bare `@use` from a non-entry stylesheet fails with
          // "Can't find stylesheet to import" even with its directory on
          // loadPaths). The modern compiler API honours loadPaths correctly.
          api: 'modern-compiler',
          // Bootstrap's own Sass emits deprecation warnings (e.g. legacy
          // color functions) that we do not own and cannot fix; quietDeps
          // suppresses warnings from dependencies while still surfacing ours.
          quietDeps: true,
        },
      },
    },
    server: {
      fs: { allow: [root] },
    },
    build: {
      outDir: path.join(root, 'dist'),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: { input: inputs },
    },
  };
});
