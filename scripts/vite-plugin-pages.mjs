import path from 'node:path';
// Vite bundles this file into vite.config.js's dependency graph with esbuild at
// config-load time, and esbuild's bundler prepends injected __dirname/__filename
// consts onto each bundled module's raw source. render-pages.mjs opens with a
// `#!/usr/bin/env node` shebang (needed for its `node scripts/render-pages.mjs`
// CLI use in Task 2), and a shebang is only valid as the literal first line of a
// file - prefixing text before it is a hard esbuild syntax error. A computed
// (non-literal) import specifier is invisible to esbuild's static bundler, so
// this loads natively at runtime instead, where Node strips the shebang as usual.
const { renderAll, OUT_DIR, PAGES_DIR, DATA_DIR } = await import(new URL('./render-pages.mjs', import.meta.url).href);

/**
 * Renders src/pages/*.njk into src/.gen/*.html before Vite reads its inputs,
 * and re-renders + full-reloads when a template or data file changes in dev.
 */
export default function pagesPlugin({ root = process.cwd() } = {}) {
  const watched = [path.join(root, PAGES_DIR), path.join(root, DATA_DIR), path.join(root, 'src/layouts'), path.join(root, 'src/partials')];
  const isWatched = (file) => watched.some((dir) => file.startsWith(dir + path.sep) || file.startsWith(dir + '/'));

  return {
    name: 'theme1:pages',

    async buildStart() {
      await renderAll({ root });
    },

    configureServer(server) {
      for (const dir of watched) server.watcher.add(dir);

      server.watcher.on('all', async (_event, file) => {
        if (!isWatched(file)) return;
        try {
          await renderAll({ root });
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          server.config.logger.error(`[theme1:pages] ${error.message}`);
        }
      });
    },

    outDirName: OUT_DIR,
  };
}
