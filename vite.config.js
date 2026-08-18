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
        scss: { loadPaths: [path.join(root, 'src/styles'), path.join(root, 'node_modules')] },
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
