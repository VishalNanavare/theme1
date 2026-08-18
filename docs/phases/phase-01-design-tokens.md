# Phase 01 — Design Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-tier token system — primitive ramps, semantic roles, component knobs — with light and dark palettes, density and font-scaling, self-hosted Inter, a Bootstrap variable bridge, and a machine-verified contrast gate.

**Architecture:** Tokens are authored once as SCSS maps in `src/styles/tokens/`, emitted as CSS custom properties on `:root`. Tier 1 (primitive) is raw values. Tier 2 (semantic) names roles and is the **only** tier that dark mode, density, and presets redefine. Tier 3 (component) gives each component its own knobs defaulting to tier 2. A contrast auditor reads the emitted values and fails CI if any documented foreground/background pair drops below WCAG AA in either theme.

**Tech Stack:** Dart Sass · CSS custom properties · Vitest · Inter variable font (SIL OFL)

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Never `@import "bootstrap/scss/bootstrap"` wholesale — selective imports only, via `src/styles/bootstrap/_config.scss`.
- **No jQuery.** Not as a dependency, not as a peer, not in a vendored file.
- **Runtime dependencies** (`dependencies` in `package.json`) must be licensed MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only dependencies additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.** That tree is a requirements reference only.
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.** Physical `left`/`right` properties are a lint error.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries and large text, in **both** light and dark.
- **Fonts self-hosted.** Inter (SIL OFL) only. No runtime requests to Google Fonts or any CDN.
- **Icons: Feather (MIT) only.** No icon fonts.
- **No photographic assets.** All imagery is generated SVG.
- **Licence:** the theme ships MIT, with generated `THIRD-PARTY-NOTICES.md`.

## File Structure

| File | Responsibility |
|---|---|
| `src/styles/tokens/_primitive.scss` | Tier 1 — colour ramps, spacing, type scale, radii, shadows, z-index, motion |
| `src/styles/tokens/_semantic.scss` | Tier 2 — light-theme role tokens |
| `src/styles/tokens/_dark.scss` | Tier 2 — dark-theme overrides only |
| `src/styles/tokens/_component.scss` | Tier 3 — per-component knobs |
| `src/styles/tokens/_density.scss` | Comfortable / compact multipliers |
| `src/styles/tokens/_index.scss` | Forwards all token partials in the correct order |
| `src/styles/base/_typography.scss` | `@font-face`, base type rules, heading scale |
| `src/styles/bootstrap/_config.scss` | Maps our tokens onto Bootstrap 5.3 SCSS variables |
| `src/styles/bootstrap/_bridge.scss` | Maps our tokens onto Bootstrap's runtime `--bs-*` variables |
| `scripts/contrast.mjs` | Pure colour maths: parsing, relative luminance, contrast ratio |
| `scripts/token-export.mjs` | Emits `tokens.json`, `tokens.css`, `tokens.scss` from the SCSS source of truth |
| `src/fonts/` | Inter variable woff2 + `OFL.txt` |
| `tests/tokens/contrast.test.js` | The AA gate over every documented pair |

---

### Task 1: Colour maths utility

**Files:**
- Create: `theme1/scripts/contrast.mjs`
- Test: `theme1/tests/unit/contrast.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseHex(hex: string) => { r: number, g: number, b: number }` — 0–255 channels; accepts `#rgb` and `#rrggbb`, case-insensitive
  - `relativeLuminance({ r, g, b }) => number` — WCAG 2.x formula, 0–1
  - `contrastRatio(hexA: string, hexB: string) => number` — 1–21, order-independent
  - `meetsAA(ratio: number, kind: 'text' | 'large' | 'ui') => boolean` — thresholds 4.5 / 3 / 3

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/contrast.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseHex, relativeLuminance, contrastRatio, meetsAA } from '../../scripts/contrast.mjs';

describe('parseHex', () => {
  it('parses six-digit hex', () => {
    expect(parseHex('#3D5AFE')).toEqual({ r: 61, g: 90, b: 254 });
  });

  it('parses three-digit shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('is case-insensitive and tolerates a missing hash', () => {
    expect(parseHex('3d5afe')).toEqual({ r: 61, g: 90, b: 254 });
  });

  it('throws on malformed input', () => {
    expect(() => parseHex('#12345')).toThrow(/hex/i);
    expect(() => parseHex('rebeccapurple')).toThrow(/hex/i);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBeCloseTo(0, 5);
    expect(relativeLuminance(parseHex('#FFFFFF'))).toBeCloseTo(1, 5);
  });

  it('matches the WCAG reference value for mid grey', () => {
    expect(relativeLuminance(parseHex('#808080'))).toBeCloseTo(0.2159, 3);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#3D5AFE', '#3D5AFE')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#3D5AFE', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#3D5AFE'), 5);
  });

  it('gives the brand primary at least AA on white', () => {
    expect(contrastRatio('#3D5AFE', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('meetsAA', () => {
  it('requires 4.5 for body text', () => {
    expect(meetsAA(4.5, 'text')).toBe(true);
    expect(meetsAA(4.49, 'text')).toBe(false);
  });

  it('requires 3 for large text and UI boundaries', () => {
    expect(meetsAA(3, 'large')).toBe(true);
    expect(meetsAA(3, 'ui')).toBe(true);
    expect(meetsAA(2.99, 'ui')).toBe(false);
  });

  it('rejects an unknown kind rather than silently passing', () => {
    expect(() => meetsAA(21, 'decorative')).toThrow(/kind/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/contrast.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/contrast.mjs`**

```js
const AA_THRESHOLDS = { text: 4.5, large: 3, ui: 3 };

/** Parse #rgb / #rrggbb (hash optional, any case) into 0–255 channels. */
export function parseHex(hex) {
  const raw = String(hex).trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Does this ratio clear WCAG 2.2 AA for the given kind of content? */
export function meetsAA(ratio, kind) {
  const threshold = AA_THRESHOLDS[kind];
  if (threshold === undefined) {
    throw new Error(`Unknown contrast kind: ${kind}. Use 'text', 'large' or 'ui'.`);
  }
  return ratio >= threshold;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/contrast.test.js`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/scripts/contrast.mjs theme1/tests/unit/contrast.test.js
git commit -m "feat(tokens): wcag contrast maths utility"
```

---

### Task 2: Tier 1 — primitive tokens

**Files:**
- Create: `theme1/src/styles/tokens/_primitive.scss`
- Create: `theme1/src/styles/tokens/_index.scss`
- Modify: `theme1/src/styles/theme1.scss`
- Test: `theme1/tests/tokens/primitive.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties on `:root`, and the SCSS maps `$indigo`, `$slate`, `$ink`, `$emerald`, `$amber`, `$red`, `$cyan`, `$space`, `$size`, `$radius`, `$shadow`, `$z` exported from `tokens/_primitive.scss` for later tasks to reference via `@use`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/primitive.test.js`:

```js
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
  const ramps = ['indigo', 'slate', 'emerald', 'amber', 'red', 'cyan'];
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  it.each(ramps)('emits all 11 steps of %s', (ramp) => {
    for (const step of steps) {
      expect(tokenValue(`--t-${ramp}-${step}`), `--t-${ramp}-${step}`).toBeDefined();
    }
  });

  it('pins the brand primary at indigo-500', () => {
    expect(tokenValue('--t-indigo-500').toUpperCase()).toBe('#3D5AFE');
  });

  it('emits the dark-chrome ink ramp', () => {
    for (const step of [500, 600, 700, 800, 900]) {
      expect(tokenValue(`--t-ink-${step}`), `--t-ink-${step}`).toBeDefined();
    }
  });

  it('makes every ramp step a valid hex colour', () => {
    for (const ramp of [...ramps, 'ink']) {
      for (const step of steps) {
        const value = tokenValue(`--t-${ramp}-${step}`);
        if (value) expect(value, `--t-${ramp}-${step}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/primitive.test.js`
Expected: FAIL — every `tokenValue` is `undefined`.

- [ ] **Step 3: Write `src/styles/tokens/_primitive.scss`**

```scss
// Tier 1 — primitive tokens.
// Raw values with no meaning attached. Never referenced by component CSS;
// only tier 2 (semantic) may point at these.

$indigo: (
  50: #eef1ff,
  100: #dde3ff,
  200: #c2ccff,
  300: #9dadff,
  400: #7688ff,
  500: #3d5afe,
  600: #2f45e0,
  700: #2635b4,
  800: #202c8e,
  900: #1c2670,
  950: #121843,
);

$slate: (
  50: #f6f7f9,
  100: #edeff2,
  200: #e5e7eb,
  300: #cdd2da,
  400: #9ca3af,
  500: #6b7280,
  600: #4b5563,
  700: #374151,
  800: #1f2937,
  900: #111827,
  950: #0b0f17,
);

// Dedicated dark-chrome ramp. Deliberately cooler and flatter than $slate so
// dark surfaces read as designed rather than as inverted light surfaces.
$ink: (
  50: #e8eaf0,
  100: #ced3de,
  200: #aab2c2,
  300: #7f8798,
  400: #59616f,
  500: #3a4150,
  600: #2a2f3a,
  700: #1e212a,
  800: #16181d,
  900: #0f1117,
  950: #080a0e,
);

$emerald: (
  50: #ecfdf5,
  100: #d1fae5,
  200: #a7f3d0,
  300: #6ee7b7,
  400: #34d399,
  500: #10b981,
  600: #059669,
  700: #047857,
  800: #065f46,
  900: #064e3b,
  950: #022c22,
);

$amber: (
  50: #fffbeb,
  100: #fef3c7,
  200: #fde68a,
  300: #fcd34d,
  400: #fbbf24,
  500: #f59e0b,
  600: #d97706,
  700: #b45309,
  800: #92400e,
  900: #78350f,
  950: #451a03,
);

$red: (
  50: #fef2f2,
  100: #fee2e2,
  200: #fecaca,
  300: #fca5a5,
  400: #f87171,
  500: #ef4444,
  600: #dc2626,
  700: #b91c1c,
  800: #991b1b,
  900: #7f1d1d,
  950: #450a0a,
);

$cyan: (
  50: #ecfeff,
  100: #cffafe,
  200: #a5f3fc,
  300: #67e8f9,
  400: #22d3ee,
  500: #06b6d4,
  600: #0891b2,
  700: #0e7490,
  800: #155e75,
  900: #164e63,
  950: #083344,
);

$ramps: (
  'indigo': $indigo,
  'slate': $slate,
  'ink': $ink,
  'emerald': $emerald,
  'amber': $amber,
  'red': $red,
  'cyan': $cyan,
);

// 4px base spacing scale.
$space: (
  0: 0,
  1: 0.25rem,
  2: 0.5rem,
  3: 0.75rem,
  4: 1rem,
  5: 1.25rem,
  6: 1.5rem,
  8: 2rem,
  10: 2.5rem,
  12: 3rem,
  16: 4rem,
  20: 5rem,
  24: 6rem,
);

// 1.200 minor third, anchored at 14px body.
$size: (
  'xs': 0.6875rem,
  'sm': 0.75rem,
  'base': 0.875rem,
  'md': 1rem,
  'lg': 1.125rem,
  'xl': 1.25rem,
  '2xl': 1.5rem,
  '3xl': 1.75rem,
  '4xl': 2.125rem,
  '5xl': 2.5rem,
  '6xl': 3rem,
);

$radius: (
  'none': 0,
  'sm': 0.25rem,
  'md': 0.5rem,
  'lg': 0.75rem,
  'xl': 1rem,
  '2xl': 1.5rem,
  'full': 9999px,
);

$shadow: (
  0: none,
  1: (0 1px 2px rgb(16 24 40 / 6%)),
  2: (0 1px 3px rgb(16 24 40 / 8%), 0 1px 2px rgb(16 24 40 / 4%)),
  3: (0 4px 8px -2px rgb(16 24 40 / 8%), 0 2px 4px -2px rgb(16 24 40 / 4%)),
  4: (0 12px 16px -4px rgb(16 24 40 / 8%), 0 4px 6px -2px rgb(16 24 40 / 3%)),
  5: (0 20px 24px -4px rgb(16 24 40 / 10%), 0 8px 8px -4px rgb(16 24 40 / 4%)),
);

$z: (
  10: 100,
  20: 200,
  30: 300,
  40: 400,
  50: 500,
  60: 600,
  70: 700,
);

$weight: (400: 400, 500: 500, 600: 600, 700: 700);
$leading: ('tight': 1.2, 'snug': 1.35, 'normal': 1.5, 'relaxed': 1.7);
$tracking: ('tight': -0.01em, 'normal': 0, 'wide': 0.02em);
$duration: ('fast': 120ms, 'base': 200ms, 'slow': 320ms);
$ease: (
  'standard': cubic-bezier(0.2, 0, 0, 1),
  'decelerate': cubic-bezier(0, 0, 0, 1),
  'accelerate': cubic-bezier(0.3, 0, 1, 1),
);

:root {
  @each $name, $ramp in $ramps {
    @each $step, $value in $ramp {
      --t-#{$name}-#{$step}: #{$value};
    }
  }
  @each $step, $value in $space {
    --t-space-#{$step}: #{$value};
  }
  @each $key, $value in $size {
    --t-size-#{$key}: #{$value};
  }
  @each $key, $value in $radius {
    --t-radius-#{$key}: #{$value};
  }
  @each $key, $value in $shadow {
    --t-shadow-#{$key}: #{$value};
  }
  @each $key, $value in $z {
    --t-z-#{$key}: #{$value};
  }
  @each $key, $value in $weight {
    --t-weight-#{$key}: #{$value};
  }
  @each $key, $value in $leading {
    --t-leading-#{$key}: #{$value};
  }
  @each $key, $value in $tracking {
    --t-tracking-#{$key}: #{$value};
  }
  @each $key, $value in $duration {
    --t-duration-#{$key}: #{$value};
  }
  @each $key, $value in $ease {
    --t-ease-#{$key}: #{$value};
  }
}
```

- [ ] **Step 4: Write `src/styles/tokens/_index.scss`**

```scss
@forward 'primitive';
@forward 'semantic';
@forward 'dark';
@forward 'density';
@forward 'component';
```

Create empty placeholders for `_semantic.scss`, `_dark.scss`, `_density.scss`, and `_component.scss` containing only a `// filled in by a later task` comment, so `_index.scss` resolves now.

- [ ] **Step 5: Wire the entry point — replace `src/styles/theme1.scss`**

```scss
@use 'tokens';

.t-smoke {
  font-family: system-ui, sans-serif;
  color: var(--t-slate-900);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/tokens/primitive.test.js`
Expected: PASS — 13 tests. In particular the monotonic-luminance test proves every ramp is ordered.

- [ ] **Step 7: Lint and commit**

```bash
cd theme1 && npm run lint:css
git add theme1/src/styles/tokens/ theme1/src/styles/theme1.scss theme1/tests/tokens/primitive.test.js
git commit -m "feat(tokens): tier-1 primitive ramps and scales"
```

---

### Task 3: Tier 2 — semantic tokens, light theme

**Files:**
- Modify: `theme1/src/styles/tokens/_semantic.scss`
- Test: `theme1/tests/tokens/semantic-light.test.js`

**Interfaces:**
- Consumes: `$indigo`, `$slate`, `$emerald`, `$amber`, `$red`, `$cyan` from `tokens/_primitive.scss`.
- Produces: the semantic token names listed in spec §4.2 tier 2. Component CSS references **only** these names.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/semantic-light.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contrastRatio, meetsAA } from '../../scripts/contrast.mjs';

const stylesDir = fileURLToPath(new URL('../../src/styles', import.meta.url));
let root;

beforeAll(async () => {
  const { css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir] });
  // Capture the first :root block only — that is the light theme.
  const block = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  root = Object.fromEntries(
    [...block.matchAll(/(--t-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}, 60_000);

/** Resolve a token to a literal hex by following one level of var() indirection. */
function hex(name) {
  const raw = root[name];
  if (!raw) throw new Error(`missing token ${name}`);
  const ref = raw.match(/^var\((--t-[a-z0-9-]+)\)$/);
  return ref ? root[ref[1]] : raw;
}

describe('semantic surface and content tokens', () => {
  const required = [
    '--t-surface-page', '--t-surface-raised', '--t-surface-sunken', '--t-surface-overlay', '--t-surface-inverse',
    '--t-content-primary', '--t-content-secondary', '--t-content-muted', '--t-content-disabled',
    '--t-content-inverse', '--t-content-link', '--t-content-link-hover',
    '--t-border-subtle', '--t-border-default', '--t-border-strong', '--t-border-focus',
  ];

  it.each(required)('defines %s', (name) => {
    expect(root[name]).toBeDefined();
  });

  it('uses the spec surface and content values', () => {
    expect(hex('--t-surface-page').toLowerCase()).toBe('#f6f7f9');
    expect(hex('--t-surface-raised').toLowerCase()).toBe('#ffffff');
    expect(hex('--t-content-primary').toLowerCase()).toBe('#111827');
    expect(hex('--t-content-secondary').toLowerCase()).toBe('#6b7280');
    expect(hex('--t-border-default').toLowerCase()).toBe('#e5e7eb');
  });
});

describe('semantic action tokens', () => {
  const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'];
  const parts = ['bg', 'bg-hover', 'bg-active', 'bg-soft', 'fg', 'ring'];

  it.each(intents)('defines every part of the %s action', (intent) => {
    for (const part of parts) {
      expect(root[`--t-action-${intent}-${part}`], `--t-action-${intent}-${part}`).toBeDefined();
    }
  });

  it.each(intents)('gives %s foreground AA contrast on its own background', (intent) => {
    const ratio = contrastRatio(hex(`--t-action-${intent}-fg`), hex(`--t-action-${intent}-bg`));
    expect(meetsAA(ratio, 'text'), `${intent}: ${ratio.toFixed(2)}:1`).toBe(true);
  });

  it.each(intents)('darkens %s on hover rather than lightening it', async (intent) => {
    const { relativeLuminance, parseHex } = await import('../../scripts/contrast.mjs');
    const base = relativeLuminance(parseHex(hex(`--t-action-${intent}-bg`)));
    const hover = relativeLuminance(parseHex(hex(`--t-action-${intent}-bg-hover`)));
    expect(hover).toBeLessThan(base);
  });
});

describe('light-theme contrast gate', () => {
  const textPairs = [
    ['--t-content-primary', '--t-surface-page'],
    ['--t-content-primary', '--t-surface-raised'],
    ['--t-content-secondary', '--t-surface-page'],
    ['--t-content-secondary', '--t-surface-raised'],
    ['--t-content-link', '--t-surface-raised'],
    ['--t-content-inverse', '--t-surface-inverse'],
  ];

  it.each(textPairs)('%s on %s clears AA for text', (fg, bg) => {
    const ratio = contrastRatio(hex(fg), hex(bg));
    expect(meetsAA(ratio, 'text'), `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBe(true);
  });

  const uiPairs = [
    ['--t-border-default', '--t-surface-raised'],
    ['--t-border-strong', '--t-surface-page'],
  ];

  it.each(uiPairs)('%s on %s clears AA for UI boundaries', (fg, bg) => {
    const ratio = contrastRatio(hex(fg), hex(bg));
    expect(meetsAA(ratio, 'ui'), `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBe(true);
  });

  it('keeps the eight chart series distinguishable from the surface', () => {
    for (let i = 1; i <= 8; i += 1) {
      const ratio = contrastRatio(hex(`--t-chart-${i}`), hex('--t-surface-raised'));
      expect(meetsAA(ratio, 'ui'), `chart-${i} = ${ratio.toFixed(2)}:1`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/semantic-light.test.js`
Expected: FAIL — `missing token --t-surface-page`.

- [ ] **Step 3: Write `src/styles/tokens/_semantic.scss`**

```scss
// Tier 2 — semantic tokens, light theme.
// The ONLY tier that dark mode, density and presets redefine.
// Component CSS must reference these names, never tier-1 primitives.

:root {
  // Surfaces
  --t-surface-page: var(--t-slate-50);
  --t-surface-raised: #ffffff;
  --t-surface-sunken: var(--t-slate-100);
  --t-surface-overlay: #ffffff;
  --t-surface-inverse: var(--t-slate-900);

  // Content
  --t-content-primary: var(--t-slate-900);
  --t-content-secondary: var(--t-slate-500);
  --t-content-muted: var(--t-slate-400);
  --t-content-disabled: var(--t-slate-300);
  --t-content-inverse: #ffffff;
  --t-content-link: var(--t-indigo-600);
  --t-content-link-hover: var(--t-indigo-700);

  // Borders
  --t-border-subtle: var(--t-slate-100);
  --t-border-default: var(--t-slate-200);
  --t-border-strong: var(--t-slate-400);
  --t-border-focus: var(--t-indigo-500);

  // Actions — bg/hover/active darken; -soft is the tinted wash; -fg is the label
  --t-action-primary-bg: var(--t-indigo-500);
  --t-action-primary-bg-hover: var(--t-indigo-600);
  --t-action-primary-bg-active: var(--t-indigo-700);
  --t-action-primary-bg-soft: var(--t-indigo-50);
  --t-action-primary-fg: #ffffff;
  --t-action-primary-ring: rgb(61 90 254 / 32%);

  --t-action-secondary-bg: var(--t-slate-500);
  --t-action-secondary-bg-hover: var(--t-slate-600);
  --t-action-secondary-bg-active: var(--t-slate-700);
  --t-action-secondary-bg-soft: var(--t-slate-100);
  --t-action-secondary-fg: #ffffff;
  --t-action-secondary-ring: rgb(107 114 128 / 32%);

  --t-action-success-bg: var(--t-emerald-600);
  --t-action-success-bg-hover: var(--t-emerald-700);
  --t-action-success-bg-active: var(--t-emerald-800);
  --t-action-success-bg-soft: var(--t-emerald-50);
  --t-action-success-fg: #ffffff;
  --t-action-success-ring: rgb(5 150 105 / 32%);

  --t-action-warning-bg: var(--t-amber-700);
  --t-action-warning-bg-hover: var(--t-amber-800);
  --t-action-warning-bg-active: var(--t-amber-900);
  --t-action-warning-bg-soft: var(--t-amber-50);
  --t-action-warning-fg: #ffffff;
  --t-action-warning-ring: rgb(180 83 9 / 32%);

  --t-action-danger-bg: var(--t-red-600);
  --t-action-danger-bg-hover: var(--t-red-700);
  --t-action-danger-bg-active: var(--t-red-800);
  --t-action-danger-bg-soft: var(--t-red-50);
  --t-action-danger-fg: #ffffff;
  --t-action-danger-ring: rgb(220 38 38 / 32%);

  --t-action-info-bg: var(--t-cyan-700);
  --t-action-info-bg-hover: var(--t-cyan-800);
  --t-action-info-bg-active: var(--t-cyan-900);
  --t-action-info-bg-soft: var(--t-cyan-50);
  --t-action-info-fg: #ffffff;
  --t-action-info-ring: rgb(14 116 144 / 32%);

  // States — for alerts, badges and inline validation
  --t-state-success-bg: var(--t-emerald-50);
  --t-state-success-fg: var(--t-emerald-800);
  --t-state-success-border: var(--t-emerald-200);
  --t-state-success-icon: var(--t-emerald-600);

  --t-state-warning-bg: var(--t-amber-50);
  --t-state-warning-fg: var(--t-amber-900);
  --t-state-warning-border: var(--t-amber-200);
  --t-state-warning-icon: var(--t-amber-700);

  --t-state-danger-bg: var(--t-red-50);
  --t-state-danger-fg: var(--t-red-800);
  --t-state-danger-border: var(--t-red-200);
  --t-state-danger-icon: var(--t-red-600);

  --t-state-info-bg: var(--t-cyan-50);
  --t-state-info-fg: var(--t-cyan-900);
  --t-state-info-border: var(--t-cyan-200);
  --t-state-info-icon: var(--t-cyan-700);

  // Focus
  --t-focus-ring: 0 0 0 3px var(--t-action-primary-ring);

  // Categorical chart series — ordered for maximum adjacent separation
  --t-chart-1: var(--t-indigo-500);
  --t-chart-2: var(--t-emerald-600);
  --t-chart-3: var(--t-amber-600);
  --t-chart-4: var(--t-red-500);
  --t-chart-5: var(--t-cyan-600);
  --t-chart-6: var(--t-indigo-800);
  --t-chart-7: var(--t-emerald-800);
  --t-chart-8: var(--t-slate-500);

  // Elevation aliases — dark theme swaps these to surface-lightening
  --t-elevation-raised: var(--t-shadow-1);
  --t-elevation-overlay: var(--t-shadow-3);
  --t-elevation-popover: var(--t-shadow-4);
  --t-elevation-modal: var(--t-shadow-5);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/tokens/semantic-light.test.js`
Expected: PASS. Note that `warning` and `info` deliberately use the 700 step, not 500 — the 500 steps of amber and cyan cannot carry white text at 4.5:1, and the test proves it.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/styles/tokens/_semantic.scss theme1/tests/tokens/semantic-light.test.js
git commit -m "feat(tokens): tier-2 semantic tokens for the light theme"
```

---

### Task 4: Tier 2 — dark theme

**Files:**
- Modify: `theme1/src/styles/tokens/_dark.scss`
- Test: `theme1/tests/tokens/semantic-dark.test.js`

**Interfaces:**
- Consumes: tier-1 ramps; the tier-2 token names from Task 3.
- Produces: a dark palette applied by `[data-theme='dark']` **and** by `[data-theme='system']` under `prefers-color-scheme: dark`. Redefines tier 2 only — no new token names.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/semantic-dark.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contrastRatio, meetsAA } from '../../scripts/contrast.mjs';

const stylesDir = fileURLToPath(new URL('../../src/styles', import.meta.url));
let light, dark, css;

function parseBlock(text) {
  return Object.fromEntries([...text.matchAll(/(--t-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

beforeAll(async () => {
  ({ css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir] }));
  light = parseBlock(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);
  dark = parseBlock(css.match(/\[data-theme=(?:'|")dark(?:'|")\]\s*\{([\s\S]*?)\n\}/)[1]);
}, 60_000);

function hex(map, name) {
  const raw = map[name] ?? light[name];
  if (!raw) throw new Error(`missing token ${name}`);
  const ref = raw.match(/^var\((--t-[a-z0-9-]+)\)$/);
  return ref ? (light[ref[1]] ?? dark[ref[1]]) : raw;
}

describe('dark theme structure', () => {
  it('introduces no token names the light theme does not have', () => {
    const extras = Object.keys(dark).filter((k) => !(k in light));
    expect(extras, `dark theme must redefine tier 2 only, found: ${extras.join(', ')}`).toEqual([]);
  });

  it('also applies under prefers-color-scheme for data-theme="system"', () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    expect(css).toMatch(/\[data-theme=(?:'|")system(?:'|")\]/);
  });

  it('uses the spec dark surfaces', () => {
    expect(hex(dark, '--t-surface-page').toLowerCase()).toBe('#0f1117');
    expect(hex(dark, '--t-surface-raised').toLowerCase()).toBe('#16181d');
    expect(hex(dark, '--t-surface-overlay').toLowerCase()).toBe('#1e212a');
  });

  it('lifts the primary so it holds contrast on dark surfaces', () => {
    expect(hex(dark, '--t-action-primary-bg').toLowerCase()).toBe('#6b82ff');
  });

  it('flips the primary label to near-black, because white fails on the lifted primary', () => {
    const onWhite = contrastRatio('#ffffff', hex(dark, '--t-action-primary-bg'));
    expect(onWhite).toBeLessThan(4.5);
    expect(contrastRatio(hex(dark, '--t-action-primary-fg'), hex(dark, '--t-action-primary-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('replaces shadows with surface-lightening for elevation', () => {
    expect(dark['--t-elevation-raised']).toBeDefined();
    expect(dark['--t-elevation-raised']).not.toMatch(/rgb\(16 24 40/);
  });
});

describe('dark-theme contrast gate', () => {
  const textPairs = [
    ['--t-content-primary', '--t-surface-page'],
    ['--t-content-primary', '--t-surface-raised'],
    ['--t-content-secondary', '--t-surface-page'],
    ['--t-content-secondary', '--t-surface-raised'],
    ['--t-content-link', '--t-surface-raised'],
  ];

  it.each(textPairs)('%s on %s clears AA for text', (fg, bg) => {
    const ratio = contrastRatio(hex(dark, fg), hex(dark, bg));
    expect(meetsAA(ratio, 'text'), `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBe(true);
  });

  const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'];

  it.each(intents)('%s action label clears AA on its background', (intent) => {
    const ratio = contrastRatio(hex(dark, `--t-action-${intent}-fg`), hex(dark, `--t-action-${intent}-bg`));
    expect(meetsAA(ratio, 'text'), `${intent}: ${ratio.toFixed(2)}:1`).toBe(true);
  });

  it.each(intents)('%s state text clears AA on its own state background', (intent) => {
    if (intent === 'primary' || intent === 'secondary') return;
    const ratio = contrastRatio(hex(dark, `--t-state-${intent}-fg`), hex(dark, `--t-state-${intent}-bg`));
    expect(meetsAA(ratio, 'text'), `state-${intent}: ${ratio.toFixed(2)}:1`).toBe(true);
  });

  it('keeps borders visible against dark surfaces', () => {
    expect(meetsAA(contrastRatio(hex(dark, '--t-border-default'), hex(dark, '--t-surface-raised')), 'ui')).toBe(true);
  });

  it('keeps the eight chart series distinguishable on dark', () => {
    for (let i = 1; i <= 8; i += 1) {
      const ratio = contrastRatio(hex(dark, `--t-chart-${i}`), hex(dark, '--t-surface-raised'));
      expect(meetsAA(ratio, 'ui'), `chart-${i} = ${ratio.toFixed(2)}:1`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/semantic-dark.test.js`
Expected: FAIL — the `[data-theme='dark']` block does not exist, so the `beforeAll` regex match throws.

- [ ] **Step 3: Write `src/styles/tokens/_dark.scss`**

```scss
// Tier 2 — dark theme. Redefines semantic tokens ONLY; adds no new names.
// A designed palette, not an inversion: elevation moves from shadow to
// surface-lightening, and the primary lifts so it survives on dark ground.

@mixin dark-tokens {
  --t-surface-page: var(--t-ink-900);
  --t-surface-raised: var(--t-ink-800);
  --t-surface-sunken: var(--t-ink-950);
  --t-surface-overlay: var(--t-ink-700);
  --t-surface-inverse: var(--t-ink-50);

  --t-content-primary: var(--t-ink-50);
  --t-content-secondary: var(--t-ink-200);
  --t-content-muted: var(--t-ink-300);
  --t-content-disabled: var(--t-ink-400);
  --t-content-inverse: var(--t-ink-900);
  --t-content-link: var(--t-indigo-300);
  --t-content-link-hover: var(--t-indigo-200);

  --t-border-subtle: var(--t-ink-700);
  --t-border-default: var(--t-ink-500);
  --t-border-strong: var(--t-ink-300);
  --t-border-focus: var(--t-indigo-400);

  // Lifted action colours. Labels flip to near-black wherever the lifted
  // background is too light to carry white text at 4.5:1.
  --t-action-primary-bg: #6b82ff;
  --t-action-primary-bg-hover: #8497ff;
  --t-action-primary-bg-active: #9dabff;
  --t-action-primary-bg-soft: rgb(107 130 255 / 16%);
  --t-action-primary-fg: var(--t-ink-900);
  --t-action-primary-ring: rgb(107 130 255 / 40%);

  --t-action-secondary-bg: var(--t-ink-500);
  --t-action-secondary-bg-hover: var(--t-ink-400);
  --t-action-secondary-bg-active: var(--t-ink-300);
  --t-action-secondary-bg-soft: rgb(58 65 80 / 40%);
  --t-action-secondary-fg: var(--t-ink-50);
  --t-action-secondary-ring: rgb(154 163 175 / 40%);

  --t-action-success-bg: var(--t-emerald-400);
  --t-action-success-bg-hover: var(--t-emerald-300);
  --t-action-success-bg-active: var(--t-emerald-200);
  --t-action-success-bg-soft: rgb(52 211 153 / 16%);
  --t-action-success-fg: var(--t-ink-900);
  --t-action-success-ring: rgb(52 211 153 / 40%);

  --t-action-warning-bg: var(--t-amber-400);
  --t-action-warning-bg-hover: var(--t-amber-300);
  --t-action-warning-bg-active: var(--t-amber-200);
  --t-action-warning-bg-soft: rgb(251 191 36 / 16%);
  --t-action-warning-fg: var(--t-ink-900);
  --t-action-warning-ring: rgb(251 191 36 / 40%);

  --t-action-danger-bg: var(--t-red-400);
  --t-action-danger-bg-hover: var(--t-red-300);
  --t-action-danger-bg-active: var(--t-red-200);
  --t-action-danger-bg-soft: rgb(248 113 113 / 16%);
  --t-action-danger-fg: var(--t-ink-900);
  --t-action-danger-ring: rgb(248 113 113 / 40%);

  --t-action-info-bg: var(--t-cyan-400);
  --t-action-info-bg-hover: var(--t-cyan-300);
  --t-action-info-bg-active: var(--t-cyan-200);
  --t-action-info-bg-soft: rgb(34 211 238 / 16%);
  --t-action-info-fg: var(--t-ink-900);
  --t-action-info-ring: rgb(34 211 238 / 40%);

  --t-state-success-bg: rgb(16 185 129 / 14%);
  --t-state-success-fg: var(--t-emerald-200);
  --t-state-success-border: rgb(16 185 129 / 36%);
  --t-state-success-icon: var(--t-emerald-400);

  --t-state-warning-bg: rgb(245 158 11 / 14%);
  --t-state-warning-fg: var(--t-amber-200);
  --t-state-warning-border: rgb(245 158 11 / 36%);
  --t-state-warning-icon: var(--t-amber-400);

  --t-state-danger-bg: rgb(239 68 68 / 14%);
  --t-state-danger-fg: var(--t-red-200);
  --t-state-danger-border: rgb(239 68 68 / 36%);
  --t-state-danger-icon: var(--t-red-400);

  --t-state-info-bg: rgb(6 182 212 / 14%);
  --t-state-info-fg: var(--t-cyan-200);
  --t-state-info-border: rgb(6 182 212 / 36%);
  --t-state-info-icon: var(--t-cyan-400);

  --t-chart-1: var(--t-indigo-300);
  --t-chart-2: var(--t-emerald-400);
  --t-chart-3: var(--t-amber-400);
  --t-chart-4: var(--t-red-400);
  --t-chart-5: var(--t-cyan-400);
  --t-chart-6: var(--t-indigo-100);
  --t-chart-7: var(--t-emerald-200);
  --t-chart-8: var(--t-ink-200);

  // Elevation by surface-lightening. Shadows read as smudges on dark ground.
  --t-elevation-raised: inset 0 1px 0 0 rgb(255 255 255 / 5%);
  --t-elevation-overlay: inset 0 1px 0 0 rgb(255 255 255 / 7%), 0 8px 24px rgb(0 0 0 / 48%);
  --t-elevation-popover: inset 0 1px 0 0 rgb(255 255 255 / 8%), 0 12px 32px rgb(0 0 0 / 56%);
  --t-elevation-modal: inset 0 1px 0 0 rgb(255 255 255 / 9%), 0 24px 56px rgb(0 0 0 / 64%);
}

[data-theme='dark'] {
  @include dark-tokens;
}

@media (prefers-color-scheme: dark) {
  [data-theme='system'] {
    @include dark-tokens;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/tokens/semantic-dark.test.js`
Expected: PASS. If any pair fails, adjust the **token value**, never the threshold.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/styles/tokens/_dark.scss theme1/tests/tokens/semantic-dark.test.js
git commit -m "feat(tokens): designed dark palette with AA contrast gate"
```

---

### Task 5: Typography and self-hosted Inter

**Files:**
- Create: `theme1/src/fonts/inter-variable.woff2`
- Create: `theme1/src/fonts/inter-variable-italic.woff2`
- Create: `theme1/src/fonts/OFL.txt`
- Create: `theme1/src/styles/base/_typography.scss`
- Modify: `theme1/src/styles/theme1.scss`
- Test: `theme1/tests/tokens/typography.test.js`

**Interfaces:**
- Consumes: `$size`, `$weight`, `$leading` from tier 1; `--t-content-*` from tier 2.
- Produces: `--t-font-sans`, `--t-font-mono`, and heading/body rules other phases inherit.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/typography.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const stylesDir = path.join(rootDir, 'src/styles');
let css;

beforeAll(async () => {
  ({ css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir] }));
}, 60_000);

describe('font hosting', () => {
  it('ships the Inter variable font locally', () => {
    expect(existsSync(path.join(rootDir, 'src/fonts/inter-variable.woff2'))).toBe(true);
  });

  it('ships the SIL Open Font Licence alongside it', () => {
    expect(existsSync(path.join(rootDir, 'src/fonts/OFL.txt'))).toBe(true);
  });

  it('never references a remote font host', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\//);
  });

  it('declares @font-face with swap and a variable weight range', () => {
    expect(css).toContain('@font-face');
    expect(css).toMatch(/font-display:\s*swap/);
    expect(css).toMatch(/font-weight:\s*100\s+900/);
  });
});

describe('type tokens', () => {
  it('defines the sans and mono stacks with system fallbacks', () => {
    expect(css).toMatch(/--t-font-sans:[^;]*Inter/);
    expect(css).toMatch(/--t-font-sans:[^;]*system-ui/);
    expect(css).toMatch(/--t-font-mono:[^;]*monospace/);
  });

  it('sets the body to 14px via the base size token', () => {
    expect(css).toMatch(/font-size:\s*var\(--t-size-base\)/);
  });

  it('styles all six heading levels', () => {
    for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(css, `missing ${h}`).toMatch(new RegExp(`\\b${h}\\b`));
    }
  });

  it('honours prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/typography.test.js`
Expected: FAIL — the font files are absent.

- [ ] **Step 3: Vendor the font**

Download the Inter variable font (roman and italic `.woff2`) and its `OFL.txt` from the official Inter release, and place them in `theme1/src/fonts/`.

Verify the licence file is present and readable before continuing — an unlicensed binary in the repo defeats the whole project:

```bash
cd theme1 && ls -l src/fonts && head -3 src/fonts/OFL.txt
```

Expected: both `.woff2` files listed, and `OFL.txt` beginning with the SIL Open Font License copyright line.

- [ ] **Step 4: Write `src/styles/base/_typography.scss`**

```scss
@use '../tokens' as *;

@font-face {
  font-family: 'Inter';
  src: url('../fonts/inter-variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('../fonts/inter-variable-italic.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}

:root {
  --t-font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', roboto, sans-serif;
  --t-font-mono: ui-monospace, 'SFMono-Regular', 'Cascadia Mono', menlo, consolas, monospace;
}

html {
  // Scaled by data-font-scale in Task 6.
  font-size: 100%;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  background-color: var(--t-surface-page);
  color: var(--t-content-primary);
  font-family: var(--t-font-sans);
  font-size: var(--t-size-base);
  font-weight: var(--t-weight-400);
  line-height: var(--t-leading-normal);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  margin-block: 0 var(--t-space-3);
  color: var(--t-content-primary);
  font-weight: var(--t-weight-600);
  line-height: var(--t-leading-tight);
  letter-spacing: var(--t-tracking-tight);
}

h1 { font-size: var(--t-size-4xl); }
h2 { font-size: var(--t-size-3xl); }
h3 { font-size: var(--t-size-2xl); }
h4 { font-size: var(--t-size-xl); }
h5 { font-size: var(--t-size-lg); }
h6 { font-size: var(--t-size-md); }

p {
  margin-block: 0 var(--t-space-4);
}

small {
  font-size: var(--t-size-sm);
}

code,
kbd,
pre,
samp {
  font-family: var(--t-font-mono);
  font-size: 0.9375em;
}

a {
  color: var(--t-content-link);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;

  &:hover {
    color: var(--t-content-link-hover);
  }
}

:focus-visible {
  outline: 2px solid var(--t-border-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Update `src/styles/theme1.scss`**

```scss
@use 'tokens';
@use 'base/typography';
```

Delete the `.t-smoke` rule and update `tests/build/build.test.js`'s CSS assertion from `.t-smoke` to `@font-face`, and `src/pages/index.njk` to drop the `t-smoke` class.

- [ ] **Step 6: Run the tests**

Run: `cd theme1 && npx vitest run tests/tokens/ tests/build/`
Expected: PASS — 8 typography tests plus the build suite.

- [ ] **Step 7: Commit**

```bash
git add theme1/src/fonts theme1/src/styles/base/_typography.scss theme1/src/styles/theme1.scss theme1/src/pages/index.njk theme1/tests/tokens/typography.test.js theme1/tests/build/build.test.js
git commit -m "feat(tokens): self-hosted inter and the type scale"
```

---

### Task 6: Density, font scaling, and high contrast

**Files:**
- Modify: `theme1/src/styles/tokens/_density.scss`
- Test: `theme1/tests/tokens/density.test.js`

**Interfaces:**
- Consumes: tier-1 `$space`; tier-2 border and content tokens.
- Produces: `--t-density-scale`, `--t-control-height-{sm,md,lg}`, `--t-gutter`, applied by `[data-density]`, `[data-font-scale]`, and `[data-contrast='high']` on `<html>`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/density.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const stylesDir = fileURLToPath(new URL('../../src/styles', import.meta.url));
let css;

beforeAll(async () => {
  ({ css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir] }));
}, 60_000);

describe('density', () => {
  it('defaults to the comfortable scale', () => {
    expect(css).toMatch(/--t-density-scale:\s*1\b/);
  });

  it('defines a compact scale below comfortable', () => {
    const compact = css.match(/\[data-density=(?:'|")compact(?:'|")\]\s*\{([\s\S]*?)\n\}/);
    expect(compact).not.toBeNull();
    const value = Number(compact[1].match(/--t-density-scale:\s*([\d.]+)/)[1]);
    expect(value).toBeGreaterThan(0.5);
    expect(value).toBeLessThan(1);
  });

  it('derives control heights from the density scale', () => {
    for (const size of ['sm', 'md', 'lg']) {
      expect(css, `--t-control-height-${size}`).toMatch(new RegExp(`--t-control-height-${size}:[^;]*--t-density-scale`));
    }
  });
});

describe('font scaling', () => {
  it.each([
    ['87.5', '87.5%'],
    ['100', '100%'],
    ['112.5', '112.5%'],
    ['125', '125%'],
  ])('maps data-font-scale="%s" to root font-size %s', (attr, expected) => {
    const block = css.match(new RegExp(`\\[data-font-scale=(?:'|")${attr.replace('.', '\\.')}(?:'|")\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
    expect(block, `missing data-font-scale="${attr}"`).not.toBeNull();
    expect(block[1]).toContain(expected);
  });
});

describe('high contrast', () => {
  it('strengthens borders and removes soft washes', () => {
    const block = css.match(/\[data-contrast=(?:'|")high(?:'|")\]\s*\{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/--t-border-default/);
  });

  it('also responds to the prefers-contrast media query', () => {
    expect(css).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/density.test.js`
Expected: FAIL — none of the blocks exist.

- [ ] **Step 3: Write `src/styles/tokens/_density.scss`**

```scss
// Density, font scaling and high contrast.
// All three are tier-2 adjustments: no component CSS changes for any of them.

:root {
  --t-density-scale: 1;
  --t-control-height-sm: calc(1.75rem * var(--t-density-scale));
  --t-control-height-md: calc(2.25rem * var(--t-density-scale));
  --t-control-height-lg: calc(2.75rem * var(--t-density-scale));
  --t-gutter: calc(var(--t-space-6) * var(--t-density-scale));
  --t-stack: calc(var(--t-space-4) * var(--t-density-scale));
}

[data-density='compact'] {
  --t-density-scale: 0.875;
}

[data-font-scale='87.5'] { font-size: 87.5%; }
[data-font-scale='100'] { font-size: 100%; }
[data-font-scale='112.5'] { font-size: 112.5%; }
[data-font-scale='125'] { font-size: 125%; }

@mixin high-contrast-tokens {
  --t-border-subtle: var(--t-border-default);
  --t-border-default: var(--t-content-secondary);
  --t-border-strong: var(--t-content-primary);
  --t-content-secondary: var(--t-content-primary);
  --t-content-muted: var(--t-content-primary);
  --t-elevation-raised: 0 0 0 1px var(--t-border-strong);
  --t-elevation-overlay: 0 0 0 1px var(--t-border-strong);
}

[data-contrast='high'] {
  @include high-contrast-tokens;
}

@media (prefers-contrast: more) {
  :root:not([data-contrast='normal']) {
    @include high-contrast-tokens;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/tokens/density.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/styles/tokens/_density.scss theme1/tests/tokens/density.test.js
git commit -m "feat(tokens): density, font scaling and high-contrast modes"
```

---

### Task 7: Tier 3 component knobs and the Bootstrap bridge

**Files:**
- Modify: `theme1/src/styles/tokens/_component.scss`
- Create: `theme1/src/styles/bootstrap/_config.scss`
- Create: `theme1/src/styles/bootstrap/_bridge.scss`
- Modify: `theme1/src/styles/theme1.scss`
- Test: `theme1/tests/tokens/bootstrap-bridge.test.js`

**Interfaces:**
- Consumes: tiers 1 and 2.
- Produces: tier-3 knobs that Phase 03's components consume, and `--bs-*` runtime variables so Bootstrap utilities match our palette exactly.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/tokens/bootstrap-bridge.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAsync } from 'sass';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const stylesDir = fileURLToPath(new URL('../../src/styles', import.meta.url));
let css;

beforeAll(async () => {
  ({ css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), { loadPaths: [stylesDir, path.join(stylesDir, '../../node_modules')] }));
}, 60_000);

describe('tier 3 component knobs', () => {
  const knobs = [
    '--t-btn-height-sm', '--t-btn-height-md', '--t-btn-height-lg', '--t-btn-padding-x', '--t-btn-radius', '--t-btn-font-weight',
    '--t-card-padding', '--t-card-radius', '--t-card-shadow', '--t-card-border',
    '--t-input-height', '--t-input-border', '--t-input-bg', '--t-input-radius',
    '--t-sidebar-width', '--t-sidebar-width-collapsed', '--t-navbar-height', '--t-footer-height',
    '--t-table-cell-padding-comfortable', '--t-table-cell-padding-compact', '--t-table-stripe-bg',
  ];

  it.each(knobs)('defines %s', (knob) => {
    expect(css).toContain(`${knob}:`);
  });

  it('derives every knob from tier 2 or tier 1, never a raw hex', () => {
    const block = css.match(/:root\s*\{([\s\S]*?)\n\}/g).join('\n');
    for (const knob of knobs.filter((k) => /bg|border|shadow/.test(k))) {
      const value = block.match(new RegExp(`${knob}:\\s*([^;]+);`))?.[1] ?? '';
      expect(value, `${knob} = ${value}`).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });
});

describe('bootstrap bridge', () => {
  it('maps our primary onto --bs-primary', () => {
    expect(css).toMatch(/--bs-primary:\s*var\(--t-action-primary-bg\)/);
  });

  it('maps body colour and background', () => {
    expect(css).toMatch(/--bs-body-color:\s*var\(--t-content-primary\)/);
    expect(css).toMatch(/--bs-body-bg:\s*var\(--t-surface-page\)/);
  });

  it('maps the border colour and radius', () => {
    expect(css).toMatch(/--bs-border-color:\s*var\(--t-border-default\)/);
    expect(css).toMatch(/--bs-border-radius:\s*var\(--t-radius-md\)/);
  });

  it('maps the font stack', () => {
    expect(css).toMatch(/--bs-body-font-family:\s*var\(--t-font-sans\)/);
  });

  it('does not pull in the whole of bootstrap', () => {
    // A wholesale import drags in the full component layer; ours must stay lean.
    expect(css).not.toContain('.carousel-item-next');
    expect(css).not.toContain('.accordion-button');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/tokens/bootstrap-bridge.test.js`
Expected: FAIL — no tier-3 knobs and no `--bs-*` mappings.

- [ ] **Step 3: Write `src/styles/tokens/_component.scss`**

```scss
// Tier 3 — component knobs.
// Each defaults to a tier-2 role so a component can be rethemed in isolation
// without touching any other component.

:root {
  // Button
  --t-btn-height-sm: var(--t-control-height-sm);
  --t-btn-height-md: var(--t-control-height-md);
  --t-btn-height-lg: var(--t-control-height-lg);
  --t-btn-padding-x: var(--t-space-4);
  --t-btn-radius: var(--t-radius-md);
  --t-btn-font-weight: var(--t-weight-500);
  --t-btn-gap: var(--t-space-2);

  // Card
  --t-card-padding: var(--t-gutter);
  --t-card-radius: var(--t-radius-lg);
  --t-card-shadow: var(--t-elevation-raised);
  --t-card-border: 1px solid var(--t-border-subtle);
  --t-card-bg: var(--t-surface-raised);

  // Input
  --t-input-height: var(--t-control-height-md);
  --t-input-padding-x: var(--t-space-3);
  --t-input-border: 1px solid var(--t-border-default);
  --t-input-bg: var(--t-surface-raised);
  --t-input-radius: var(--t-radius-md);
  --t-input-placeholder: var(--t-content-muted);

  // Shell
  --t-sidebar-width: 16rem;
  --t-sidebar-width-collapsed: 4.5rem;
  --t-navbar-height: 4rem;
  --t-footer-height: 3.5rem;
  --t-shell-gap: var(--t-space-6);

  // Table
  --t-table-cell-padding-comfortable: var(--t-space-3) var(--t-space-4);
  --t-table-cell-padding-compact: var(--t-space-2) var(--t-space-3);
  --t-table-stripe-bg: var(--t-surface-sunken);
  --t-table-header-bg: var(--t-surface-sunken);
  --t-table-border: 1px solid var(--t-border-subtle);
}
```

- [ ] **Step 4: Write `src/styles/bootstrap/_config.scss`**

```scss
// Compile-time Bootstrap configuration.
// Selective imports only — never the bootstrap.scss barrel file.

$prefix: 'bs-';
$enable-shadows: false;
$enable-gradients: false;
$enable-smooth-scroll: false;
$enable-dark-mode: false; // our own data-theme owns dark mode
$enable-cssgrid: true;

$font-family-sans-serif: var(--t-font-sans);
$font-size-base: 0.875rem;
$border-radius: 0.5rem;
$grid-gutter-width: 1.5rem;

@import 'bootstrap/scss/functions';
@import 'bootstrap/scss/variables';
@import 'bootstrap/scss/maps';
@import 'bootstrap/scss/mixins';
@import 'bootstrap/scss/root';
@import 'bootstrap/scss/reboot';
@import 'bootstrap/scss/grid';
@import 'bootstrap/scss/containers';
@import 'bootstrap/scss/utilities';
@import 'bootstrap/scss/utilities/api';
```

- [ ] **Step 5: Write `src/styles/bootstrap/_bridge.scss`**

```scss
// Runtime bridge: point Bootstrap's CSS variables at our semantic tokens so
// utility classes and our components can never drift apart.

:root {
  --bs-primary: var(--t-action-primary-bg);
  --bs-secondary: var(--t-action-secondary-bg);
  --bs-success: var(--t-action-success-bg);
  --bs-warning: var(--t-action-warning-bg);
  --bs-danger: var(--t-action-danger-bg);
  --bs-info: var(--t-action-info-bg);
  --bs-light: var(--t-surface-sunken);
  --bs-dark: var(--t-surface-inverse);

  --bs-body-color: var(--t-content-primary);
  --bs-body-bg: var(--t-surface-page);
  --bs-secondary-color: var(--t-content-secondary);
  --bs-secondary-bg: var(--t-surface-sunken);
  --bs-emphasis-color: var(--t-content-primary);

  --bs-border-color: var(--t-border-default);
  --bs-border-radius: var(--t-radius-md);
  --bs-border-radius-sm: var(--t-radius-sm);
  --bs-border-radius-lg: var(--t-radius-lg);
  --bs-border-radius-pill: var(--t-radius-full);

  --bs-body-font-family: var(--t-font-sans);
  --bs-body-font-size: var(--t-size-base);
  --bs-body-line-height: var(--t-leading-normal);

  --bs-link-color: var(--t-content-link);
  --bs-link-hover-color: var(--t-content-link-hover);
  --bs-focus-ring-color: var(--t-action-primary-ring);
}
```

- [ ] **Step 6: Update `src/styles/theme1.scss`**

```scss
// Order matters: Bootstrap's reboot and utilities first, then our tokens
// (which win because they are declared later), then our base layer.
@use 'bootstrap/config';
@use 'tokens';
@use 'bootstrap/bridge';
@use 'base/typography';
```

Add `node_modules` to the Sass load paths in every test file's `compileAsync` call that now needs it, matching `vite.config.js`'s `css.preprocessorOptions.scss.loadPaths`.

- [ ] **Step 7: Run the whole token suite**

Run: `cd theme1 && npx vitest run tests/tokens/`
Expected: PASS — all five token test files.

- [ ] **Step 8: Check the budget did not blow up**

Run: `cd theme1 && npm run build && npm run check:budgets`
Expected: the CSS asset is well inside 120 KB gzipped. If Bootstrap's utility API pushed it over, trim the `$utilities` map in `_config.scss` rather than raising the budget.

- [ ] **Step 9: Commit**

```bash
git add theme1/src/styles/tokens/_component.scss theme1/src/styles/bootstrap/ theme1/src/styles/theme1.scss theme1/tests/tokens/bootstrap-bridge.test.js
git commit -m "feat(tokens): tier-3 knobs and the bootstrap variable bridge"
```

---

### Task 8: Token export

**Files:**
- Create: `theme1/scripts/token-export.mjs`
- Modify: `theme1/package.json` (add `"tokens:export"` script)
- Modify: `theme1/.github/workflows/ci.yml` (add the drift check)
- Test: `theme1/tests/unit/token-export.test.js`

**Interfaces:**
- Consumes: the compiled CSS from `src/styles/theme1.scss`.
- Produces:
  - `extractTokens(css: string) => { light: Record<string,string>, dark: Record<string,string> }`
  - `toJson(tokens) => string`, `toCss(tokens) => string`, `toScss(tokens) => string`
  - Files `dist-tokens/tokens.json`, `dist-tokens/tokens.css`, `dist-tokens/tokens.scss`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/token-export.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractTokens, toJson, toCss, toScss } from '../../scripts/token-export.mjs';

const SAMPLE = `
:root {
  --t-indigo-500: #3d5afe;
  --t-surface-page: var(--t-slate-50);
}
[data-theme='dark'] {
  --t-surface-page: var(--t-ink-900);
}
.t-btn { color: red; }
`;

describe('extractTokens', () => {
  it('collects light-theme tokens from :root', () => {
    expect(extractTokens(SAMPLE).light['--t-indigo-500']).toBe('#3d5afe');
  });

  it('collects dark-theme overrides separately', () => {
    const { dark } = extractTokens(SAMPLE);
    expect(dark['--t-surface-page']).toBe('var(--t-ink-900)');
    expect(dark['--t-indigo-500']).toBeUndefined();
  });

  it('ignores declarations outside token blocks', () => {
    expect(Object.values(extractTokens(SAMPLE).light)).not.toContain('red');
  });

  it('returns empty maps for css with no tokens', () => {
    expect(extractTokens('.a { color: red; }')).toEqual({ light: {}, dark: {} });
  });
});

describe('serialisers', () => {
  const tokens = { light: { '--t-indigo-500': '#3d5afe' }, dark: { '--t-surface-page': '#0f1117' } };

  it('emits parseable JSON with both themes', () => {
    const parsed = JSON.parse(toJson(tokens));
    expect(parsed.light['--t-indigo-500']).toBe('#3d5afe');
    expect(parsed.dark['--t-surface-page']).toBe('#0f1117');
  });

  it('emits css with a :root block and a dark block', () => {
    const css = toCss(tokens);
    expect(css).toContain(':root');
    expect(css).toContain("[data-theme='dark']");
    expect(css).toContain('--t-indigo-500: #3d5afe;');
  });

  it('emits scss variables with the leading dashes stripped', () => {
    const scss = toScss(tokens);
    expect(scss).toContain('$t-indigo-500: #3d5afe;');
    expect(scss).not.toContain('$--t');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/token-export.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/token-export.mjs`**

```js
#!/usr/bin/env node
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { compileAsync } from 'sass';

const DECL = /(--t-[a-z0-9-]+)\s*:\s*([^;]+);/g;

function declarationsIn(block) {
  return Object.fromEntries([...block.matchAll(DECL)].map((m) => [m[1], m[2].trim()]));
}

/** Split compiled CSS into light (:root) and dark ([data-theme='dark']) token maps. */
export function extractTokens(css) {
  const light = {};
  const dark = {};

  for (const match of css.matchAll(/:root\s*\{([\s\S]*?)\n?\}/g)) {
    Object.assign(light, declarationsIn(match[1]));
  }
  for (const match of css.matchAll(/\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n?\}/g)) {
    Object.assign(dark, declarationsIn(match[1]));
  }
  return { light, dark };
}

export function toJson(tokens) {
  return `${JSON.stringify(tokens, null, 2)}\n`;
}

export function toCss({ light, dark }) {
  const body = (map) =>
    Object.entries(map)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
  return `:root {\n${body(light)}\n}\n\n[data-theme='dark'] {\n${body(dark)}\n}\n`;
}

export function toScss({ light, dark }) {
  const body = (title, map) =>
    `// ${title}\n${Object.entries(map)
      .map(([k, v]) => `$${k.replace(/^--/, '')}: ${v};`)
      .join('\n')}`;
  return `${body('Light theme', light)}\n\n${body('Dark theme', dark)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const stylesDir = path.join(root, 'src/styles');
  const { css } = await compileAsync(path.join(stylesDir, 'theme1.scss'), {
    loadPaths: [stylesDir, path.join(root, 'node_modules')],
  });

  const tokens = extractTokens(css);
  const outDir = path.join(root, 'dist-tokens');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'tokens.json'), toJson(tokens), 'utf8');
  await writeFile(path.join(outDir, 'tokens.css'), toCss(tokens), 'utf8');
  await writeFile(path.join(outDir, 'tokens.scss'), toScss(tokens), 'utf8');

  console.log(`exported ${Object.keys(tokens.light).length} light and ${Object.keys(tokens.dark).length} dark tokens`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/token-export.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Wire it up**

Add to `package.json` scripts: `"tokens:export": "node scripts/token-export.mjs"`.
Add `dist-tokens/` to `.gitignore`.
Add to `.github/workflows/ci.yml`, after the build step:

```yaml
      - name: Export tokens
        run: npm run tokens:export
```

- [ ] **Step 6: Run it for real**

Run: `cd theme1 && npm run tokens:export`
Expected: a count of exported tokens, and three files in `dist-tokens/`. Open `tokens.json` and confirm the primitive ramps, semantic roles, and component knobs are all present.

- [ ] **Step 7: Commit**

```bash
git add theme1/scripts/token-export.mjs theme1/package.json theme1/.gitignore theme1/.github/workflows/ci.yml theme1/tests/unit/token-export.test.js
git commit -m "feat(tokens): export tokens as json, css and scss"
```

---

## Phase exit checklist

- [ ] `npm run lint` exits 0.
- [ ] `npm run test` green — token suite plus everything from Phase 00.
- [ ] Every documented foreground/background pair clears WCAG AA in **both** light and dark, proved by `tests/tokens/semantic-light.test.js` and `semantic-dark.test.js`.
- [ ] Dark theme adds **zero** new token names — proved by the structure test.
- [ ] No remote font or CDN reference appears in the compiled CSS.
- [ ] `src/fonts/OFL.txt` is present alongside the font binaries.
- [ ] `npm run build && npm run check:budgets` passes.
- [ ] `npm run tokens:export` produces `tokens.json`, `tokens.css`, `tokens.scss`.
- [ ] CI green.

**Unblocks:** Phase 02 (Layout shell) and Phase 03 (Core components), which may run in parallel.
