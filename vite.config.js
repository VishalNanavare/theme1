import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import fg from 'fast-glob';
import pagesPlugin from './scripts/vite-plugin-pages.mjs';
// See scripts/vite-plugin-pages.mjs for why this is a computed dynamic import
// rather than a static one: render-pages.mjs's CLI shebang is incompatible with
// how Vite's config-loader bundles static relative imports via esbuild.
const { renderAll, OUT_DIR } = await import(new URL('./scripts/render-pages.mjs', import.meta.url).href);

const root = fileURLToPath(new URL('.', import.meta.url));
const genDir = path.join(root, OUT_DIR);

export default defineConfig(async () => {
  // Render once up front so the input glob below sees every page.
  await renderAll({ root });

  const inputs = await fg('*.html', { cwd: genDir, absolute: true });

  return {
    root: genDir,
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
