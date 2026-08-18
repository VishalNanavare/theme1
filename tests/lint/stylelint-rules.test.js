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

/**
 * A property-level ban cannot see inside a shorthand, so `padding: 0 20px 0 4px`
 * would slip through with exactly the RTL breakage `padding-left` was banned for.
 * These value-level rules reject only the forms that actually encode left/right
 * asymmetry: the 4-value box shorthands, multi-value border-radius, and the
 * directional keywords. 1-, 2- and 3-value box shorthands are symmetric on the
 * inline axis and stay legal, so the rule adds no friction to ordinary CSS.
 */
describe('asymmetric shorthand values', () => {
  const offenders = [
    ['4-value padding', 'padding: 0 20px 0 4px'],
    ['4-value margin', 'margin: 0 auto 0 8px'],
    ['4-value inset', 'inset: 0 20px 0 4px'],
    ['4-value border-width', 'border-width: 1px 2px 1px 4px'],
    ['multi-value border-radius', 'border-radius: 8px 0 0 8px'],
    ['float: left', 'float: left'],
    ['float: right', 'float: right'],
    ['clear: right', 'clear: right'],
    ['text-align: left', 'text-align: left'],
    ['text-align: right', 'text-align: right'],
    ['background-position with a left keyword', 'background-position: left 10px'],
  ];

  it.each(offenders)('rejects %s', async (_label, declaration) => {
    const warnings = await lint(rule(declaration));
    expect(warnings.map((w) => w.rule)).toContain('declaration-property-value-disallowed-list');
  });

  const allowed = [
    ['1-value padding', 'padding: 1rem'],
    ['2-value padding — block then inline, already symmetric', 'padding: 1rem 2rem'],
    ['3-value padding — inline value is shared', 'padding: 1rem 2rem 3rem'],
    ['2-value margin with auto', 'margin: 0 auto'],
    ['single-value inset', 'inset: 0'],
    ['uniform border-radius', 'border-radius: 8px'],
    ['logical float', 'float: inline-start'],
    ['logical text-align', 'text-align: end'],
  ];

  it.each(allowed)('accepts %s', async (_label, declaration) => {
    const warnings = await lint(rule(declaration));
    expect(warnings.map((w) => `${w.rule}: ${w.text}`)).toEqual([]);
  });

  it('names the logical replacement in the message', async () => {
    const warnings = await lint(rule('padding: 0 20px 0 4px'));
    expect(warnings.map((w) => w.text).join(' ')).toMatch(/padding-inline/);
  });
});
