import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ciPath = fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url));

describe('CI workflow', () => {
  it('runs every gate in order', async () => {
    const yml = await readFile(ciPath, 'utf8');
    // Build runs before the tests: from Phase 02 onward, suites such as the
    // option-matrix and a11y gates read files out of dist/.
    const gates = ['npm run lint', 'npm run build', 'npm run test', 'npm run audit:licenses', 'npm run check:budgets'];
    let cursor = -1;
    for (const gate of gates) {
      const at = yml.indexOf(gate);
      expect(at, `missing or out-of-order gate: ${gate}`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it('pins the Node version to the engines floor', async () => {
    const yml = await readFile(ciPath, 'utf8');
    expect(yml).toContain('20.11');
  });
});
