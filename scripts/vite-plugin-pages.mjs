import path from 'node:path';
import { renderAll, PAGES_DIR, DATA_DIR } from './render-pages.mjs';

/**
 * Re-renders src/pages/*.njk into src/*.html and full-reloads when a
 * template or data file changes in dev.
 *
 * The initial render (for both `build` and `dev`) happens once in
 * vite.config.js, at config-resolution time, before this plugin's hooks run
 * — a `buildStart` render here would be a second, fully redundant pass over
 * the same templates.
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
  };
}
