import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import fg from 'fast-glob';

const gzipAsync = promisify(gzip);

export const BUDGETS = { css: 120 * 1024, js: 400 * 1024 };

export async function gzipSize(buffer) {
  const out = await gzipAsync(buffer, { level: 9 });
  return out.length;
}

export function evaluate(entries, budgets = BUDGETS) {
  const failures = entries.filter((e) => e.gzip > budgets[e.type]).map((e) => ({ ...e, budget: budgets[e.type] }));
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const files = await fg('assets/**/*.{css,js}', { cwd: path.join(root, 'dist') });

  const entries = [];
  for (const file of files) {
    const buf = await readFile(path.join(root, 'dist', file));
    entries.push({ file, type: file.endsWith('.css') ? 'css' : 'js', gzip: await gzipSize(buf) });
  }

  const { ok, failures } = evaluate(entries);

  for (const e of entries.sort((a, b) => b.gzip - a.gzip)) {
    console.log(`${(e.gzip / 1024).toFixed(1).padStart(8)} KB  ${e.file}`);
  }

  if (!ok) {
    console.error('\nBudget check FAILED:');
    for (const f of failures) {
      console.error(`  ${f.file}: ${(f.gzip / 1024).toFixed(1)} KB gzipped exceeds ${(f.budget / 1024).toFixed(0)} KB`);
    }
    process.exit(1);
  }
  console.log(`\nBudget check passed: ${entries.length} assets within budget.`);
}
