import path from 'node:path';
import { renderAll, OUT_DIR, PAGES_DIR, DATA_DIR } from './render-pages.mjs';

/**
 * Renders src/pages/*.njk into src/*.html before Vite reads its inputs,
 * and re-renders + full-reloads when a template or data file changes in dev.
 */
export default function pagesPlugin({ root = process.cwd() } = {}) {
  const watched = [
    path.join(root, PAGES_DIR),
    path.join(root, DATA_DIR),
    path.join(root, 'src/layouts'),
    path.join(root, 'src/partials'),
  ];
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
