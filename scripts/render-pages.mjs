#!/usr/bin/env node
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import nunjucks from 'nunjucks';
import fg from 'fast-glob';

export const SRC = 'src';
export const PAGES_DIR = 'src/pages';
export const OUT_DIR = 'src/.gen';
export const DATA_DIR = 'src/data';

/** Build a Nunjucks environment rooted at the given search paths. */
export function createEnv(searchPaths) {
  return nunjucks.configure(searchPaths, {
    autoescape: true,
    noCache: true,
    throwOnUndefined: false,
  });
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

  const templates = await fg('*.njk', { cwd: absPages, onlyFiles: true });
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
    await writeFile(outPath, html, 'utf8');
    written.push(outPath);
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const written = await renderAll();
  console.log(`rendered ${written.length} pages`);
}
