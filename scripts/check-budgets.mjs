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
  const failures = entries
    .filter((e) => {
      // A type absent from `budgets` makes `e.gzip > undefined` false —
      // silently waving the asset through with no budget at all. That is a
      // hole in the gate, not a pass, so it must fail loudly instead.
      if (!(e.type in budgets)) {
        throw new Error(`No budget configured for asset type "${e.type}" (${e.file}).`);
      }
      return e.gzip > budgets[e.type];
    })
    .map((e) => ({ ...e, budget: budgets[e.type] }));
  return { ok: failures.length === 0, failures };
}

/**
 * Every script-like extension Rollup can emit. A glob of just {css,js} would
 * silently drop a `.mjs` chunk — and an asset the gate cannot see is an asset
 * with no budget at all.
 */
export const ASSET_GLOB = 'assets/**/*.{css,js,mjs,cjs}';

export async function collectEntries(distDir) {
  const files = await fg(ASSET_GLOB, { cwd: distDir });
  const entries = [];
  for (const file of files) {
    const buf = await readFile(path.join(distDir, file));
    entries.push({ file, type: file.endsWith('.css') ? 'css' : 'js', gzip: await gzipSize(buf) });
  }
  return entries.sort((a, b) => b.gzip - a.gzip);
}

/**
 * Returns a process exit code. Separated from the CLI block so the failure
 * paths — including the empty-build one — are directly testable.
 *
 * Finding no assets is a FAILURE, not a pass. CI reads only this exit code, so
 * a skipped or misconfigured build must not be able to report green.
 */
export async function run(root = process.cwd(), { log = console.log, error = console.error } = {}) {
  const distDir = path.join(root, 'dist');
  const entries = await collectEntries(distDir);

  if (entries.length === 0) {
    error(`Budget check FAILED: no assets matched ${ASSET_GLOB} under ${distDir}.`);
    error('Either the build did not run, or its output path changed.');
    return 1;
  }

  for (const e of entries) {
    log(`${(e.gzip / 1024).toFixed(1).padStart(8)} KB  ${e.file}`);
  }

  const { ok, failures } = evaluate(entries);
  if (!ok) {
    error('\nBudget check FAILED:');
    for (const f of failures) {
      error(`  ${f.file}: ${(f.gzip / 1024).toFixed(1)} KB gzipped exceeds ${(f.budget / 1024).toFixed(0)} KB`);
    }
    return 1;
  }

  log(`\nBudget check passed: ${entries.length} assets within budget.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await run());
}
