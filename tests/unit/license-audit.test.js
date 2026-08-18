import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  normalizeLicense,
  classify,
  renderNotices,
  collectPackages,
  RUNTIME_ALLOWED,
  DEV_ALLOWED,
} from '../../scripts/license-audit.mjs';

describe('normalizeLicense', () => {
  it('passes SPDX identifiers through unchanged', () => {
    expect(normalizeLicense('MIT')).toBe('MIT');
  });

  it('unwraps the legacy object form', () => {
    expect(normalizeLicense({ type: 'BSD-2-Clause' })).toBe('BSD-2-Clause');
  });

  it('reports UNKNOWN for missing licences', () => {
    expect(normalizeLicense(undefined)).toBe('UNKNOWN');
    expect(normalizeLicense('')).toBe('UNKNOWN');
  });

  it('keeps SPDX expressions intact so they can be judged as a whole', () => {
    expect(normalizeLicense('(MIT OR GPL-2.0)')).toBe('(MIT OR GPL-2.0)');
  });
});

describe('classify', () => {
  it('accepts every allowed runtime licence', () => {
    const pkgs = [...RUNTIME_ALLOWED].map((license, i) => ({
      name: `p${i}`,
      version: '1.0.0',
      license,
      scope: 'runtime',
    }));
    expect(classify(pkgs).ok).toBe(true);
  });

  it('rejects a GPL runtime dependency', () => {
    const { ok, violations } = classify([{ name: 'bad', version: '1.0.0', license: 'GPL-3.0', scope: 'runtime' }]);
    expect(ok).toBe(false);
    expect(violations).toHaveLength(1);
    expect(violations[0].name).toBe('bad');
  });

  it('rejects a dual MIT/GPL runtime dependency because the expression is ambiguous', () => {
    const { ok } = classify([{ name: 'blockui', version: '2.70.0', license: '(MIT OR GPL-2.0)', scope: 'runtime' }]);
    expect(ok).toBe(false);
  });

  it('allows MPL-2.0 for dev dependencies but not runtime', () => {
    expect(classify([{ name: 'axe-core', version: '4.9.0', license: 'MPL-2.0', scope: 'dev' }]).ok).toBe(true);
    expect(classify([{ name: 'axe-core', version: '4.9.0', license: 'MPL-2.0', scope: 'runtime' }]).ok).toBe(false);
    expect(DEV_ALLOWED.has('MPL-2.0')).toBe(true);
    expect(RUNTIME_ALLOWED.has('MPL-2.0')).toBe(false);
  });

  it('rejects an unknown licence in either scope', () => {
    expect(classify([{ name: 'mystery', version: '0.0.1', license: 'UNKNOWN', scope: 'dev' }]).ok).toBe(false);
  });

  it('explains why each violation failed', () => {
    const { violations } = classify([{ name: 'bad', version: '1.0.0', license: 'GPL-3.0', scope: 'runtime' }]);
    expect(violations[0].reason).toContain('GPL-3.0');
    expect(violations[0].reason).toContain('runtime');
  });
});

describe('renderNotices', () => {
  it('lists runtime packages with name, version and licence', () => {
    const md = renderNotices([
      { name: 'bootstrap', version: '5.3.3', license: 'MIT', scope: 'runtime' },
      { name: 'vite', version: '5.4.0', license: 'MIT', scope: 'dev' },
    ]);
    expect(md).toContain('bootstrap');
    expect(md).toContain('5.3.3');
    expect(md).toContain('MIT');
  });

  it('separates runtime from development sections', () => {
    const md = renderNotices([
      { name: 'bootstrap', version: '5.3.3', license: 'MIT', scope: 'runtime' },
      { name: 'vite', version: '5.4.0', license: 'MIT', scope: 'dev' },
    ]);
    expect(md.indexOf('## Runtime dependencies')).toBeLessThan(md.indexOf('## Development dependencies'));
  });
});

describe('collectPackages traversal', () => {
  let dir;

  const writePkg = async (relative, manifest) => {
    const target = path.join(dir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(manifest), 'utf8');
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'theme1-audit-'));
    await writePkg('package.json', {
      name: 'root',
      dependencies: { alpha: '^1.0.0' },
      devDependencies: { tooling: '^1.0.0' },
    });
    await writePkg('node_modules/alpha/package.json', {
      name: 'alpha',
      version: '1.0.0',
      license: 'MIT',
      dependencies: { beta: '^1.0.0' },
    });
    await writePkg('node_modules/beta/package.json', { name: 'beta', version: '1.0.0', license: 'GPL-3.0' });
    await writePkg('node_modules/tooling/package.json', {
      name: 'tooling',
      version: '1.0.0',
      license: 'MIT',
      dependencies: { grubby: '^1.0.0' },
    });
    await writePkg('node_modules/grubby/package.json', { name: 'grubby', version: '1.0.0', license: 'CC-BY-4.0' });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('follows runtime dependencies transitively, because they ship', async () => {
    const names = (await collectPackages(dir)).filter((p) => p.scope === 'runtime').map((p) => p.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('fails the audit on a transitive runtime licence violation', async () => {
    expect(classify(await collectPackages(dir)).ok).toBe(false);
  });

  it('audits declared dev dependencies but not their transitive tree, which never ships', async () => {
    const names = (await collectPackages(dir)).map((p) => p.name);
    expect(names).toContain('tooling');
    expect(names, 'a transitive dev dependency must not be audited').not.toContain('grubby');
  });

  it('records a declared package that is not installed rather than skipping it', async () => {
    await writePkg('package.json', { name: 'root', dependencies: { ghost: '^1.0.0' } });
    const [entry] = await collectPackages(dir);
    expect(entry).toMatchObject({ name: 'ghost', version: 'not-installed', license: 'UNKNOWN' });
  });

  it('terminates on a dependency cycle', async () => {
    await writePkg('node_modules/beta/package.json', {
      name: 'beta',
      version: '1.0.0',
      license: 'MIT',
      dependencies: { alpha: '^1.0.0' },
    });
    await expect(collectPackages(dir)).resolves.toHaveLength(3);
  });

  it('audits a nested copy rather than the hoisted one that does not ship', async () => {
    // alpha depends on beta, but carries its own conflicting copy. npm nests it,
    // and the nested copy is what gets bundled — so it is the one to audit.
    await writePkg('node_modules/beta/package.json', { name: 'beta', version: '2.0.0', license: 'MIT' });
    await writePkg('node_modules/alpha/node_modules/beta/package.json', {
      name: 'beta',
      version: '1.0.0',
      license: 'GPL-3.0',
    });

    const packages = await collectPackages(dir);
    const beta = packages.filter((p) => p.name === 'beta');
    expect(beta.map((p) => `${p.version}:${p.license}`)).toContain('1.0.0:GPL-3.0');
    expect(classify(packages).ok, 'a nested GPL copy must fail the audit').toBe(false);
  });

  it('walks up to the root when a package has no nested copy', async () => {
    const names = (await collectPackages(dir)).map((p) => p.name);
    expect(names, 'beta resolves from the hoisted location').toContain('beta');
  });

  it('records both versions when two dependents resolve to different copies', async () => {
    // Two requesters are essential here. With only one, nothing ever resolves to
    // the hoisted copy, a single entry comes back, and a "no duplicate versions"
    // assertion passes trivially — including under the name-only keying this
    // test exists to catch. alpha carries a nested beta@1.0.0; gamma has no
    // nested copy so it resolves to the hoisted beta@2.0.0. Both ship.
    await writePkg('package.json', {
      name: 'root',
      dependencies: { alpha: '^1.0.0', gamma: '^1.0.0' },
      devDependencies: { tooling: '^1.0.0' },
    });
    await writePkg('node_modules/gamma/package.json', {
      name: 'gamma',
      version: '1.0.0',
      license: 'MIT',
      dependencies: { beta: '^2.0.0' },
    });
    await writePkg('node_modules/beta/package.json', { name: 'beta', version: '2.0.0', license: 'MIT' });
    await writePkg('node_modules/alpha/node_modules/beta/package.json', {
      name: 'beta',
      version: '1.0.0',
      license: 'GPL-3.0',
    });

    const packages = await collectPackages(dir);
    expect(
      packages
        .filter((p) => p.name === 'beta')
        .map((p) => p.version)
        .sort(),
    ).toEqual(['1.0.0', '2.0.0']);

    const { ok, violations } = classify(packages);
    expect(ok, 'the nested GPL copy must fail the audit').toBe(false);
    expect(violations.map((v) => `${v.name}@${v.version}`)).toEqual(['beta@1.0.0']);
  });
});
