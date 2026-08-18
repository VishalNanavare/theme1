import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const stylesDir = fileURLToPath(new URL('../../src/styles', import.meta.url));
let css;

beforeAll(async () => {
  const result = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir] });
  css = result.css;
}, 60_000);

/** Read a custom property's value out of the compiled :root block. */
function tokenValue(name) {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : undefined;
}

describe('primitive colour ramps', () => {
  const ramps = ['indigo', 'slate', 'ink', 'emerald', 'amber', 'red', 'cyan'];
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  // `ink` belongs in this list, not in a weaker separate check: it is the ramp
  // Tasks 3 and 4 build every dark surface on, so it needs the same ordering
  // guarantee as the rest. A partial existence-only check would let a future
  // edit break dark mode's contrast with the suite still green.

  it.each(ramps)('emits all 11 steps of %s', (ramp) => {
    for (const step of steps) {
      expect(tokenValue(`--t-${ramp}-${step}`), `--t-${ramp}-${step}`).toBeDefined();
    }
  });

  it('pins the brand primary at indigo-500', () => {
    expect(tokenValue('--t-indigo-500').toUpperCase()).toBe('#3D5AFE');
  });

  it.each(ramps)('makes every step of %s a valid six-digit hex colour', (ramp) => {
    for (const step of steps) {
      expect(tokenValue(`--t-${ramp}-${step}`), `--t-${ramp}-${step}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('orders each ramp from lightest to darkest', async () => {
    const { relativeLuminance, parseHex } = await import('../../scripts/contrast.mjs');
    for (const ramp of ramps) {
      const lums = steps.map((s) => relativeLuminance(parseHex(tokenValue(`--t-${ramp}-${s}`))));
      for (let i = 1; i < lums.length; i += 1) {
        expect(lums[i], `${ramp}-${steps[i]} must be darker than ${ramp}-${steps[i - 1]}`).toBeLessThan(lums[i - 1]);
      }
    }
  });
});

describe('primitive scales', () => {
  it('emits a 4px-based spacing scale', () => {
    expect(tokenValue('--t-space-1')).toBe('0.25rem');
    expect(tokenValue('--t-space-2')).toBe('0.5rem');
    expect(tokenValue('--t-space-4')).toBe('1rem');
    expect(tokenValue('--t-space-24')).toBe('6rem');
  });

  it('emits the minor-third type scale', () => {
    expect(tokenValue('--t-size-base')).toBe('0.875rem');
    expect(tokenValue('--t-size-xs')).toBeDefined();
    expect(tokenValue('--t-size-6xl')).toBeDefined();
  });

  it('emits radii with md at 8px', () => {
    expect(tokenValue('--t-radius-md')).toBe('0.5rem');
    expect(tokenValue('--t-radius-full')).toBe('9999px');
  });

  it('emits six elevation levels', () => {
    for (let i = 0; i <= 5; i += 1) expect(tokenValue(`--t-shadow-${i}`), `shadow-${i}`).toBeDefined();
  });

  it('emits the seven z-index layers in ascending order', () => {
    const layers = [10, 20, 30, 40, 50, 60, 70].map((n) => Number(tokenValue(`--t-z-${n}`)));
    expect(layers.every((n, i) => i === 0 || n > layers[i - 1])).toBe(true);
  });

  it('emits motion tokens', () => {
    expect(tokenValue('--t-duration-fast')).toBeDefined();
    expect(tokenValue('--t-ease-standard')).toBeDefined();
  });
});
