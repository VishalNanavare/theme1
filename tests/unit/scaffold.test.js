import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));

describe('package scaffold', () => {
  it('declares the required npm scripts', async () => {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    for (const script of ['dev', 'build', 'preview', 'test', 'lint', 'audit:licenses', 'check:budgets']) {
      expect(pkg.scripts, `missing script: ${script}`).toHaveProperty(script);
    }
  });

  it('requires Node 20.11 or newer', async () => {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    expect(pkg.engines.node).toBe('>=20.11.0');
  });

  it('is MIT licensed and not private', async () => {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    expect(pkg.license).toBe('MIT');
    expect(pkg.private).toBeUndefined();
  });

  it('does not depend on jQuery anywhere', async () => {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    expect(Object.keys(all).filter((n) => /^jquery/i.test(n))).toEqual([]);
  });
});
