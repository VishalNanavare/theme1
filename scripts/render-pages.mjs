import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import nunjucks from 'nunjucks';
import fg from 'fast-glob';

export const SRC = 'src';
export const PAGES_DIR = 'src/pages';
export const OUT_DIR = 'src';
export const DATA_DIR = 'src/data';

/**
 * Build a Nunjucks environment rooted at the given search paths.
 *
 * Deliberately `new nunjucks.Environment(...)`, not `nunjucks.configure(...)`.
 * `configure()` sets Nunjucks' module-level *default* environment as a side
 * effect — global, shared, and easy to collide with anything else in the
 * process that touches Nunjucks (including a future test file that imports
 * this module alongside its own template rendering). A private instance has
 * no such effect.
 */
export function createEnv(searchPaths) {
  const options = { autoescape: true, noCache: true, throwOnUndefined: false };
  const loader = new nunjucks.FileSystemLoader(searchPaths, { noCache: options.noCache });
  return new nunjucks.Environment(loader, options);
}

/** Load every *.json in `dataDir`, keyed by file basename. */
export async function loadData(dataDir) {
  const files = await fg('*.json', { cwd: dataDir, onlyFiles: true });
  const data = {};
  for (const file of files) {
    const key = path.basename(file, '.json');
    data[key] = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
  }
  return data;
}

/** Render every page template to flat HTML. Returns the absolute paths written. */
export async function renderAll({
  root = process.cwd(),
  pagesDir = PAGES_DIR,
  outDir = OUT_DIR,
  dataDir = DATA_DIR,
} = {}) {
  const absPages = path.join(root, pagesDir);
  const absOut = path.join(root, outDir);
  const env = createEnv([path.join(root, SRC)]);
  const data = await loadData(path.join(root, dataDir));

  // src/pages/ is flat by design: every page becomes a top-level file at the
  // output root, and page identity (and its URL) is just the basename. A
  // template placed in a subdirectory — e.g. src/pages/apps/email.njk — has
  // no defined output path under that model. Globbing '*.njk' would silently
  // skip such a file with no page, no warning, no error: the worst failure
  // mode. Globbing '**/*.njk' and rejecting any nested match instead fails
  // loudly, at the point the mistake is made.
  const templates = await fg('**/*.njk', { cwd: absPages, onlyFiles: true });
  const nested = templates.filter((file) => file.includes('/'));
  if (nested.length > 0) {
    throw new Error(
      `src/pages/ is flat by design — found template(s) in a subdirectory: ${nested.join(', ')}. ` +
        'Move them to the top level of src/pages/; nested pages are not supported.',
    );
  }
  templates.sort();

  await mkdir(absOut, { recursive: true });

  const written = [];
  for (const file of templates) {
    const name = path.basename(file, '.njk');
    let html;
    try {
      html = env.render(`pages/${file}`, { ...data, page: { name, file } });
    } catch (cause) {
      throw new Error(`Failed to render ${file}: ${cause.message}`, { cause });
    }
    const outPath = path.join(absOut, `${name}.html`);
    // Skip the write when nothing changed. At 121 pages, one save currently
    // means 121 rewrites inside Vite's own watched root — each one a
    // filesystem event the dev server's watcher has to react to.
    let previous;
    try {
      previous = await readFile(outPath, 'utf8');
    } catch {
      previous = null;
    }
    if (previous !== html) {
      await writeFile(outPath, html, 'utf8');
    }
    written.push(outPath);
  }
  return written;
}

/**
 * Renders every page and reports the count, mirroring the injectable-logger
 * shape used by the other scripts (check-budgets.mjs, license-audit.mjs).
 * Unlike those, this has no pass/fail verdict of its own to report as an
 * exit code — a render either produces pages or throws, and its callers
 * (the Vite plugin, vite.config.js) already catch and handle that
 * themselves — so it stays a plain async function rather than returning 0/1.
 */
export async function run(root = process.cwd(), { log = console.log } = {}) {
  const written = await renderAll({ root });
  log(`rendered ${written.length} pages`);
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
