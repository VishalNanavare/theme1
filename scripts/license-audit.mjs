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

/**
 * Normalise npm's several licence shapes into one string.
 *
 * A legacy `licenses: [{type:"MIT"},{type:"GPL-3.0"}]` array is the same
 * dual-licence ambiguity as the modern `(MIT OR GPL-2.0)` SPDX expression —
 * the package grants a choice, and choosing on the vendor's behalf is not
 * something the audit should do. Rather than silently taking the first
 * entry, an array of more than one distinct licence is synthesised into an
 * `(A OR B)`-shaped expression so `classify`'s existing compound-expression
 * check rejects it with the same, already-clear reason.
 */
export function normalizeLicense(raw) {
  if (!raw) return 'UNKNOWN';
  if (typeof raw === 'string') return raw.trim() || 'UNKNOWN';
  if (Array.isArray(raw)) {
    const types = raw
      .map((entry) => (typeof entry === 'object' && typeof entry?.type === 'string' ? entry.type.trim() : ''))
      .filter(Boolean);
    if (types.length === 0) return 'UNKNOWN';
    if (types.length === 1) return types[0];
    return `(${types.join(' OR ')})`;
  }
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
 * from `dependencies` can end up in the shipped bundle. Non-optional
 * `peerDependencies` are walked the same way and for the same reason: npm
 * auto-installs a required peer, and it ships alongside whatever declared it
 * (e.g. bootstrap's peer on @popperjs/core) just as surely as a regular
 * dependency does. A peer marked optional in `peerDependenciesMeta` is
 * skipped — nothing guarantees it is even installed. Dev dependencies are
 * audited at the top level only — they never reach dist/, so their transitive
 * tree (including their own peers) is deliberately out of scope.
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
      license: manifest ? normalizeLicense(manifest.license ?? manifest.licenses) : 'UNKNOWN',
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

    // Required peers ship with whatever declared them, so they are runtime
    // too. Optional peers are not guaranteed to be installed at all.
    const peerMeta = found.manifest.peerDependenciesMeta ?? {};
    for (const peer of Object.keys(found.manifest.peerDependencies ?? {})) {
      if (peerMeta[peer]?.optional) continue;
      queue.push({ name: peer, fromDir: found.dir });
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
    'Scope: runtime dependencies are listed transitively (including required peer dependencies); ' +
      'development dependencies are listed as directly declared only. This is not a full inventory ' +
      'of the installed node_modules tree.',
    '',
    section('Runtime dependencies', 'runtime'),
    '',
    section('Development dependencies', 'dev'),
  ].join('\n');
}

/**
 * Returns a process exit code, mirroring check-budgets.mjs's `run` shape so
 * both gates are testable and invokable the same way.
 *
 * The notices file is written BEFORE the verdict is known, deliberately —
 * see the comment on the write below.
 */
export async function run(root = process.cwd(), { log = console.log, error = console.error } = {}) {
  const packages = await collectPackages(root);
  const { ok, violations } = classify(packages);

  // Written unconditionally, even on a failing audit: the notices file's job
  // is to reflect what is actually installed, and that is true whether or
  // not it passes the licence gate. Gating the write on `ok` would let a
  // violation ship silently alongside a notices file that still claimed
  // everything was fine.
  await writeFile(path.join(root, 'THIRD-PARTY-NOTICES.md'), renderNotices(packages), 'utf8');

  if (!ok) {
    error('Licence audit FAILED:\n');
    for (const v of violations) error(`  ${v.name}@${v.version} — ${v.reason}`);
    return 1;
  }
  log(`Licence audit passed: ${packages.length} packages, all permitted.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await run());
}
