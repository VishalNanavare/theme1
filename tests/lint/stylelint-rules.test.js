import { describe, it, expect } from 'vitest';
import stylelint from 'stylelint';
import { fileURLToPath } from 'node:url';

const configFile = fileURLToPath(new URL('../../.stylelintrc.json', import.meta.url));

async function lint(code) {
  const result = await stylelint.lint({ code, codeFilename: 'test.scss', configFile });
  return result.results[0].warnings;
}

/**
 * Test CSS must be formatted the way real source is — one declaration per
 * line, each terminated — or stylelint-config-standard's unrelated formatting
 * rules fire too and mask which rule actually caught the physical property.
 */
function rule(...declarations) {
  return `.t-a {\n${declarations.map((d) => `  ${d};`).join('\n')}\n}\n`;
}

describe('stylelint config', () => {
  it('rejects physical margin-left, naming the logical replacement', async () => {
    const warnings = await lint(rule('margin-left: 4px'));
    expect(warnings.map((w) => w.rule)).toContain('property-disallowed-list');
    expect(warnings.map((w) => w.text).join(' ')).toMatch(/margin-inline-start/);
  });

  it('rejects physical padding-right, naming the logical replacement', async () => {
    const warnings = await lint(rule('padding-right: 4px'));
    expect(warnings.map((w) => w.rule)).toContain('property-disallowed-list');
    expect(warnings.map((w) => w.text).join(' ')).toMatch(/padding-inline-end/);
  });

  it.each(['left', 'right'])('rejects the bare %s offset', async (property) => {
    const warnings = await lint(rule('position: absolute', `${property}: 0`));
    expect(warnings.map((w) => w.rule)).toContain('property-disallowed-list');
    expect(warnings.map((w) => w.text).join(' ')).toMatch(/inset-inline-start/);
  });

  it('accepts the logical equivalents with no warning from any rule', async () => {
    const warnings = await lint(
      rule('margin-inline-start: 4px', 'padding-inline-end: 4px', 'position: absolute', 'inset-inline-start: 0'),
    );
    expect(warnings.map((w) => `${w.rule}: ${w.text}`)).toEqual([]);
  });

  it('accepts custom properties on the --t- prefix', async () => {
    const warnings = await lint(':root {\n  --t-space-3: 0.75rem;\n}\n');
    expect(warnings.map((w) => `${w.rule}: ${w.text}`)).toEqual([]);
  });
});
