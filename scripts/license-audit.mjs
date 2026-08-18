import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export const RUNTIME_ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  '0BSD',
  'Unlicense',
]);
export const DEV_ALLOWED = new Set([...RUNTIME_ALLOWED, 'MPL-2.0']);

/** Normalise npm's several licence shapes into one string. */
export function normalizeLicense(raw) {
  if (!raw) return 'UNKNOWN';
  if (typeof raw === 'string') return raw.trim() || 'UNKNOWN';
  if (typeof raw === 'object' && typeof raw.type === 'string') return raw.type.trim() || 'UNKNOWN';
  return 'UNKNOWN';
}

/**
 * Judge each package against its scope's allow-list.
 * SPDX expressions (anything containing OR/AND/WITH or parentheses) are rejected
 * outright: an ambiguous grant is not something we ship without a human decision.
 */
export function classify(packages) {
  const violations = [];
  for (const pkg of packages) {
    const allowed = pkg.scope === 'runtime' ? RUNTIME_ALLOWED : DEV_ALLOWED;
    const isExpression = /[()]|\s(OR|AND|WITH)\s/.test(pkg.license);

    if (isExpression) {
      violations.push({
        ...pkg,
        reason: `${pkg.license} is a compound SPDX expression; resolve it to a single licence before shipping (${pkg.scope})`,
      });
    } else if (!allowed.has(pkg.license)) {
      violations.push({ ...pkg, reason: `${pkg.license} is not permitted for ${pkg.scope} dependencies` });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Resolve a package the way Node does: look in the requiring package's own
 * node_modules first, then walk up to the project root.
 *
 * A flat `<root>/node_modules/<name>` lookup is wrong. npm nests a copy
 * whenever a transitive dependency needs a version that conflicts with the
 * hoisted one, and that nested copy is what actually gets bundled. Auditing
 * only the hoisted version would examine a package that never ships while
 * ignoring the one that does.
 *
 * Returns `{ manifest, dir }` so the caller can resolve this package's own
 * children relative to where it was found, or null if nothing resolves.
 */
async function readManifest(root, name, fromDir = root) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    try {
      const manifest = JSON.parse(await readFile(path.join(candidate, 'package.json'), 'utf8'));
      return { manifest, dir: candidate };
    } catch {
      // Not here — continue up toward the root.
    }
    if (path.resolve(dir) === path.resolve(root)) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Read licence metadata from node_modules.
 *
 * Runtime dependencies are walked TRANSITIVELY, because everything reachable
 * from `dependencies` can end up in the shipped bundle. Dev dependencies are
 * audited at the top level only — they never reach dist/, so their transitive
 * tree is deliberately out of scope.
 */
export async function collectPackages(root = process.cwd()) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

  // Keyed by name@version, not name: two versions of one package can both ship
  // when npm nests a conflicting copy, and both need auditing.
  const seen = new Map();
  const visited = new Set();

  const record = (name, found, scope) => {
    const manifest = found?.manifest;
    const version = manifest?.version ?? 'not-installed';
    const key = `${name}@${version}`;
    if (seen.has(key)) return key;
    seen.set(key, {
      name,
      version,
      license: manifest
        ? normalizeLicense(manifest.license ?? manifest.licenses?.[0]?.type ?? manifest.licenses?.[0])
        : 'UNKNOWN',
      scope,
    });
    return key;
  };

  // Runtime: breadth-first over the whole reachable graph, resolving each
  // package's children from where that package itself was found.
  const queue = Object.keys(pkg.dependencies ?? {}).map((name) => ({ name, fromDir: root }));
  while (queue.length > 0) {
    const { name, fromDir } = queue.shift();
    // The resolution target is itself the natural identity for a visit.
    const visitKey = path.join(fromDir, 'node_modules', name);
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const found = await readManifest(root, name, fromDir);
    record(name, found, 'runtime');
    if (!found) continue;

    for (const child of Object.keys(found.manifest.dependencies ?? {})) {
      queue.push({ name: child, fromDir: found.dir });
    }
  }

  // Dev: declared packages only, resolved from the root. Their transitive tree
  // never reaches dist/, so it is deliberately not walked.
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    const found = await readManifest(root, name, root);
    const key = `${name}@${found?.manifest?.version ?? 'not-installed'}`;
    if (seen.has(key)) continue;
    record(name, found, 'dev');
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** Build the THIRD-PARTY-NOTICES.md body. */
export function renderNotices(packages) {
  const section = (title, scope) => {
    const rows = packages
      .filter((p) => p.scope === scope)
      .map((p) => `| ${p.name} | ${p.version} | ${p.license} |`)
      .join('\n');
    return `## ${title}\n\n| Package | Version | Licence |\n|---|---|---|\n${rows}\n`;
  };

  return [
    '# Third-party notices',
    '',
    'theme1 is MIT licensed. It builds on the following packages, each under its own licence.',
    'This file is generated by `scripts/license-audit.mjs` — do not edit by hand.',
    '',
    section('Runtime dependencies', 'runtime'),
    '',
    section('Development dependencies', 'dev'),
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const packages = await collectPackages(root);
  const { ok, violations } = classify(packages);

  await writeFile(path.join(root, 'THIRD-PARTY-NOTICES.md'), renderNotices(packages), 'utf8');

  if (!ok) {
    console.error('Licence audit FAILED:\n');
    for (const v of violations) console.error(`  ${v.name}@${v.version} — ${v.reason}`);
    process.exit(1);
  }
  console.log(`Licence audit passed: ${packages.length} packages, all permitted.`);
}
