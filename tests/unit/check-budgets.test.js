import { describe, it, expect } from 'vitest';
import { gzipSize, evaluate, BUDGETS } from '../../scripts/check-budgets.mjs';

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
});
