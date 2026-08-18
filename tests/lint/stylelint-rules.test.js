import { describe, it, expect } from 'vitest';
import stylelint from 'stylelint';
import { fileURLToPath } from 'node:url';

const configFile = fileURLToPath(new URL('../../.stylelintrc.json', import.meta.url));

async function lint(code) {
  const result = await stylelint.lint({ code, codeFilename: 'test.scss', configFile });
  return result.results[0].warnings;
}

describe('stylelint config', () => {
  it('rejects physical margin-left', async () => {
    const warnings = await lint('.t-a { margin-left: 4px; }');
    expect(warnings.map((w) => w.text).join(' ')).toMatch(/margin-inline-start/);
  });

  it('rejects physical padding-right', async () => {
    const warnings = await lint('.t-a { padding-right: 4px; }');
    expect(warnings).not.toHaveLength(0);
  });

  it('rejects bare left/right offsets', async () => {
    expect(await lint('.t-a { position: absolute; left: 0; }')).not.toHaveLength(0);
    expect(await lint('.t-a { position: absolute; right: 0; }')).not.toHaveLength(0);
  });

  it('accepts the logical equivalents', async () => {
    const warnings = await lint(
      '.t-a { margin-inline-start: 4px; padding-inline-end: 4px; position: absolute; inset-inline-start: 0; }',
    );
    expect(warnings).toEqual([]);
  });

  it('accepts custom properties on the --t- prefix', async () => {
    expect(await lint(':root { --t-space-3: 0.75rem; }')).toEqual([]);
  });
});
