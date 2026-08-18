import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSize, evaluate, run, BUDGETS } from '../../scripts/check-budgets.mjs';

describe('BUDGETS', () => {
  it('matches the spec: 120 KB css, 400 KB js', () => {
    expect(BUDGETS.css).toBe(120 * 1024);
    expect(BUDGETS.js).toBe(400 * 1024);
  });
});

describe('gzipSize', () => {
  it('is smaller than the raw input for compressible data', async () => {
    const raw = Buffer.from('a'.repeat(10_000));
    expect(await gzipSize(raw)).toBeLessThan(raw.length);
  });
});

describe('evaluate', () => {
  it('passes when every entry is inside its budget', () => {
    const result = evaluate([
      { file: 'assets/a.css', type: 'css', gzip: 1000 },
      { file: 'assets/a.js', type: 'js', gzip: 1000 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails the css entry that exceeds its budget', () => {
    const result = evaluate([{ file: 'assets/big.css', type: 'css', gzip: BUDGETS.css + 1 }]);
    expect(result.ok).toBe(false);
    expect(result.failures[0].file).toBe('assets/big.css');
    expect(result.failures[0].budget).toBe(BUDGETS.css);
  });

  it('treats a value exactly on the budget as passing', () => {
    expect(evaluate([{ file: 'a.js', type: 'js', gzip: BUDGETS.js }]).ok).toBe(true);
  });

  it('accepts overridden budgets', () => {
    expect(evaluate([{ file: 'a.js', type: 'js', gzip: 500 }], { js: 100, css: 100 }).ok).toBe(false);
  });

  it('throws on an asset type missing from the budgets map, instead of waving it through', () => {
    // `e.gzip > budgets[e.type]` is `e.gzip > undefined`, which is always
    // false — a type absent from an override would otherwise pass silently
    // no matter how large the asset is.
    expect(() => evaluate([{ file: 'a.wasm', type: 'wasm', gzip: 1 }], { css: 100, js: 100 })).toThrow(/wasm/);
  });
});

/**
 * CI reads only this script's exit code, so the exit paths need their own
 * coverage — testing `evaluate` alone leaves the part CI actually depends on
 * unverified.
 */
describe('run', () => {
  let dir;
  const silent = { log() {}, error() {} };

  const writeAsset = async (name, contents) => {
    const target = path.join(dir, 'dist/assets', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'theme1-budget-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when dist does not exist, so a skipped build cannot read as green', async () => {
    expect(await run(dir, silent)).toBe(1);
  });

  it('fails when dist/assets is empty', async () => {
    await mkdir(path.join(dir, 'dist/assets'), { recursive: true });
    expect(await run(dir, silent)).toBe(1);
  });

  it('says why it failed when nothing matched', async () => {
    const errors = [];
    await run(dir, { log() {}, error: (m) => errors.push(m) });
    expect(errors.join(' ')).toMatch(/no assets matched/i);
  });

  it('passes for assets within budget', async () => {
    await writeAsset('index-abc123.css', 'body{color:red}');
    await writeAsset('index-def456.js', 'export const a = 1;');
    expect(await run(dir, silent)).toBe(0);
  });

  it('fails for an oversized asset', async () => {
    // Random bytes do not compress, so this really does exceed the budget.
    await writeAsset('big-abc123.css', randomBytes(200 * 1024));
    expect(await run(dir, silent)).toBe(1);
  });

  it('counts a .mjs chunk, which a {css,js} glob would silently drop', async () => {
    await writeAsset('worker-abc123.mjs', randomBytes(500 * 1024));
    expect(await run(dir, silent)).toBe(1);
  });

  it('ignores source maps, which are not shipped to users', async () => {
    await writeAsset('index-abc123.js', 'export const a = 1;');
    await writeAsset('index-abc123.js.map', randomBytes(600 * 1024));
    expect(await run(dir, silent)).toBe(0);
  });
});
