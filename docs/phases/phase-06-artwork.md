# Phase 06 — Artwork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate every image the theme ships — avatars, illustrations, product and banner art, brand-neutral role icons, the logo, and the favicon — as original SVG produced from code, so the theme carries zero third-party imagery and recolours with the palette.

**Architecture:** One generator (`scripts/svg-gen.mjs`) composes SVG from small pure functions at build time. Nothing is hand-traced from a reference. Every shape uses `currentColor` or a semantic token, so artwork inherits the theme and works in dark mode without a second copy. A manifest test asserts that `dist/` contains no raster image at all, which is the phase's real deliverable: proof of licence cleanliness.

**Why this replaces what the source template shipped:** the source's illustrations come from a paid UI8 kit and from Freepik, its photography from Unsplash (whose licence forbids redistributing collections), and its `images/icons/` folder is 34 third-party trademarks — Chrome, Safari, Firefox, Dropbox, iCloud, OneDrive, Figma, Sketch, React, Vue, Angular, Adobe PSD. None of it can ship. See spec §2.1.

**Tech Stack:** Node ESM · SVG generated as strings · Vitest

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.** This applies with particular force to artwork: do not trace, re-draw from, or "reinterpret" any of their SVGs.
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA in both themes.
- **Icons: Feather (MIT) only.**
- **No photographic assets. No third-party trademarks. No AI-generated raster art.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Artwork rules

1. Every generated file is SVG. `dist/` contains **no** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, or `.avif`.
2. Colour comes from `currentColor` or `var(--t-…)`. No hard-coded hex in any generated shape.
3. Every SVG has a `viewBox` and no fixed `width`/`height`, so it scales.
4. Decorative art is `aria-hidden="true"` and `focusable="false"`. Meaningful art has `role="img"` and a `<title>`.
5. Generation is deterministic: the same input always yields byte-identical output, so builds are reproducible and diffs are meaningful.
6. No shape depicts a real company's mark, product, or logo.
7. Illustrations must read at 200 px wide and still be legible in high-contrast mode.

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/svg-gen.mjs` | CLI entry; writes every generated asset |
| `scripts/svg/primitives.mjs` | `svg()`, `path()`, `circle()`, `rect()`, `group()` builders |
| `scripts/svg/avatar.mjs` | Initials avatars and the deterministic hue hash |
| `scripts/svg/illustration.mjs` | The 14 named illustration scenes |
| `scripts/svg/pattern.mjs` | Abstract product / banner / cover compositions |
| `scripts/svg/role-icons.mjs` | Brand-neutral replacements for the 34 trademarked icons |
| `scripts/svg/brand.mjs` | The theme1 logo mark and favicon |
| `src/generated/img/**` | Output (gitignored, rebuilt on every build) |
| `src/partials/ui/illustration.njk` | Macro that inlines an illustration |
| `tests/unit/svg-*.test.js` | Generator tests |
| `tests/build/no-raster.test.js` | The licence-cleanliness gate |

---

### Task 1: SVG primitives

**Files:**
- Create: `theme1/scripts/svg/primitives.mjs`
- Test: `theme1/tests/unit/svg-primitives.test.js`

**Interfaces:**
- Produces:
  - `svg({ viewBox, title, decorative, class: className, children }) => string`
  - `path(d, attrs?)`, `circle(cx, cy, r, attrs?)`, `rect(x, y, w, h, attrs?)`, `ellipse`, `line`, `polygon`
  - `group(children, attrs?)`, `defs(children)`, `linearGradient(id, stops, attrs?)`
  - `attrs(object) => string` — serialises attributes, skipping `undefined`/`null`/`false`, escaping values
  - `round(n, places = 2) => number` — keeps generated paths compact and deterministic

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/svg-primitives.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { svg, path, circle, rect, group, attrs, round } from '../../scripts/svg/primitives.mjs';

describe('attrs', () => {
  it('serialises key/value pairs', () => {
    expect(attrs({ fill: 'red', 'stroke-width': 2 })).toBe(' fill="red" stroke-width="2"');
  });
  it('skips undefined, null and false', () => {
    expect(attrs({ a: undefined, b: null, c: false, d: 'x' })).toBe(' d="x"');
  });
  it('keeps zero and empty string, which are meaningful in SVG', () => {
    expect(attrs({ x: 0 })).toBe(' x="0"');
  });
  it('escapes double quotes and angle brackets so output cannot be broken', () => {
    expect(attrs({ title: 'a"b<c>' })).toBe(' title="a&quot;b&lt;c&gt;"');
  });
  it('returns an empty string for an empty object', () => {
    expect(attrs({})).toBe('');
  });
});

describe('round', () => {
  it('rounds to two places by default', () => {
    expect(round(1.23456)).toBe(1.23);
  });
  it('drops a trailing zero by returning a number, not a string', () => {
    expect(round(1.5)).toBe(1.5);
    expect(round(2.0)).toBe(2);
  });
  it('is deterministic for the same input', () => {
    expect(round(0.1 + 0.2)).toBe(round(0.30000000000000004));
  });
});

describe('svg', () => {
  it('always emits a viewBox and no fixed dimensions', () => {
    const out = svg({ viewBox: '0 0 24 24', children: '' });
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).not.toMatch(/\swidth="/);
    expect(out).not.toMatch(/\sheight="/);
  });

  it('marks decorative art aria-hidden and unfocusable', () => {
    const out = svg({ viewBox: '0 0 24 24', decorative: true, children: '' });
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('focusable="false"');
    expect(out).not.toContain('<title>');
  });

  it('gives meaningful art a role and a title', () => {
    const out = svg({ viewBox: '0 0 24 24', title: 'Empty inbox', children: '' });
    expect(out).toContain('role="img"');
    expect(out).toContain('<title');
    expect(out).toContain('Empty inbox');
    expect(out).not.toContain('aria-hidden');
  });

  it('links the title with aria-labelledby rather than relying on title alone', () => {
    const out = svg({ viewBox: '0 0 24 24', title: 'Chart' });
    const id = out.match(/<title id="([^"]+)"/)[1];
    expect(out).toContain(`aria-labelledby="${id}"`);
  });

  it('escapes the title text', () => {
    expect(svg({ viewBox: '0 0 1 1', title: '<script>' })).not.toContain('<script>');
  });

  it('is deterministic — identical input yields identical output', () => {
    const a = svg({ viewBox: '0 0 24 24', title: 'X', children: circle(1, 1, 1) });
    const b = svg({ viewBox: '0 0 24 24', title: 'X', children: circle(1, 1, 1) });
    expect(a).toBe(b);
  });
});

describe('shape builders', () => {
  it('builds a path', () => {
    expect(path('M0 0L1 1', { fill: 'none' })).toBe('<path d="M0 0L1 1" fill="none"/>');
  });
  it('rounds numeric coordinates', () => {
    expect(circle(1.23456, 2, 3)).toContain('cx="1.23"');
  });
  it('defaults fill to currentColor so shapes inherit the theme', () => {
    expect(rect(0, 0, 10, 10)).toContain('fill="currentColor"');
  });
  it('lets fill be overridden with a token reference', () => {
    expect(rect(0, 0, 10, 10, { fill: 'var(--t-chart-2)' })).toContain('var(--t-chart-2)');
  });
  it('groups children', () => {
    expect(group([circle(0, 0, 1), circle(1, 1, 1)], { opacity: 0.5 })).toMatch(/^<g opacity="0.5">.*<\/g>$/s);
  });
});

describe('colour policy', () => {
  it('never emits a hard-coded hex from a builder default', () => {
    const output = [path('M0 0'), circle(0, 0, 1), rect(0, 0, 1, 1), group([])].join('');
    expect(output).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/svg-primitives.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/svg/primitives.mjs`**

Implement all of the above. `svg()` derives the `<title>` id deterministically from a hash of the title text so output stays reproducible. Every builder rounds coordinates through `round()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/svg-primitives.test.js`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/scripts/svg/primitives.mjs theme1/tests/unit/svg-primitives.test.js
git commit -m "feat(art): deterministic svg primitive builders"
```

---

### Task 2: Avatars

**Files:**
- Create: `theme1/scripts/svg/avatar.mjs`
- Modify: `theme1/src/partials/ui/avatar.njk`
- Test: `theme1/tests/unit/svg-avatar.test.js`

**Interfaces:**
- Produces:
  - `initials(name: string) => string` — one or two uppercase letters
  - `hueIndex(name: string) => number` — 0–7, deterministic
  - `avatarSvg({ name, shape, hueIndex }) => string`
  - `avatarDataUri({ name, shape }) => string`

This replaces all 24 avatars and 26 portraits the source template took from Unsplash.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/svg-avatar.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { initials, hueIndex, avatarSvg, avatarDataUri } from '../../scripts/svg/avatar.mjs';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
  });
  it('takes one letter from a single word', () => {
    expect(initials('Prince')).toBe('P');
  });
  it('ignores extra words beyond the second', () => {
    expect(initials('Jean Luc Picard')).toBe('JL');
  });
  it('uppercases', () => {
    expect(initials('ada lovelace')).toBe('AL');
  });
  it('collapses extra whitespace', () => {
    expect(initials('  Ada   Lovelace  ')).toBe('AL');
  });
  it('handles non-Latin scripts by taking whole characters', () => {
    expect(initials('李 明')).toBe('李明');
    expect(initials('Ünal Öz')).toBe('ÜÖ');
  });
  it('handles an emoji name without splitting the surrogate pair', () => {
    expect([...initials('👍 Team')].length).toBe(2);
  });
  it('returns a neutral placeholder for an empty name', () => {
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
    expect(initials('   ')).toBe('?');
  });
  it('strips punctuation-only words', () => {
    expect(initials('- Ada')).toBe('A');
  });
});

describe('hueIndex', () => {
  it('is deterministic', () => {
    expect(hueIndex('Ada Lovelace')).toBe(hueIndex('Ada Lovelace'));
  });
  it('is always within the eight chart slots', () => {
    for (const name of ['a', 'bb', 'Ada Lovelace', 'X', '李明', '']) {
      const index = hueIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });
  it('distributes reasonably across many names', () => {
    const counts = new Array(8).fill(0);
    for (let i = 0; i < 400; i += 1) counts[hueIndex(`User ${i}`)] += 1;
    expect(counts.every((n) => n > 0)).toBe(true);
  });
  it('gives different names different hues more often than not', () => {
    expect(hueIndex('Ada Lovelace')).not.toBe(hueIndex('Grace Hopper'));
  });
});

describe('avatarSvg', () => {
  it('renders the initials as text', () => {
    expect(avatarSvg({ name: 'Ada Lovelace' })).toContain('>AL<');
  });
  it('uses a chart token for the background, never a hex', () => {
    const out = avatarSvg({ name: 'Ada Lovelace' });
    expect(out).toMatch(/var\(--t-chart-[1-8]\)/);
    expect(out).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
  it('is decorative by default, since the name is already in the DOM', () => {
    expect(avatarSvg({ name: 'Ada Lovelace' })).toContain('aria-hidden="true"');
  });
  it('supports circle and square shapes', () => {
    expect(avatarSvg({ name: 'A', shape: 'circle' })).toContain('<circle');
    expect(avatarSvg({ name: 'A', shape: 'square' })).toContain('<rect');
  });
  it('escapes the rendered initials', () => {
    expect(avatarSvg({ name: '<b> x' })).not.toContain('<b>');
  });
  it('is deterministic', () => {
    expect(avatarSvg({ name: 'Ada' })).toBe(avatarSvg({ name: 'Ada' }));
  });
});

describe('avatarDataUri', () => {
  it('produces a usable data URI', () => {
    expect(avatarDataUri({ name: 'Ada' })).toMatch(/^data:image\/svg\+xml,/);
  });
  it('percent-encodes characters that break in a url()', () => {
    const uri = avatarDataUri({ name: 'Ada' });
    expect(uri).not.toContain('#');
    expect(uri).not.toContain('"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/svg-avatar.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/svg/avatar.mjs`**

`initials` splits on whitespace, discards words with no letter or ideograph, and takes the first grapheme of each of the first two — use `Intl.Segmenter` with `granularity: 'grapheme'` so emoji and combining marks survive.

`hueIndex` is a small FNV-1a hash of the name modulo 8 — deterministic, well-distributed, and no dependency.

`avatarSvg` draws the shape filled with `var(--t-chart-N)` and the initials in a foreground chosen for contrast against that slot; because the eight chart tokens differ between themes, take the foreground from `var(--t-surface-raised)` in light and `var(--t-content-inverse)` in dark by using `currentColor` on a wrapper that CSS sets.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/svg-avatar.test.js`
Expected: PASS — 21 tests.

- [ ] **Step 5: Wire it into the avatar component**

Update `src/partials/ui/avatar.njk` so that when no `src` is given it inlines `avatarSvg`. Add `--t-avatar-fg` to the avatar's tier-3 knobs. Confirm on the style guide page that avatars recolour with the theme.

- [ ] **Step 6: Commit**

```bash
git add theme1/scripts/svg/avatar.mjs theme1/src/partials/ui/avatar.njk theme1/src/styles/components/_avatar.scss theme1/tests/unit/svg-avatar.test.js
git commit -m "feat(art): generated initials avatars replacing stock photography"
```

---

### Task 3: Illustrations

**Files:**
- Create: `theme1/scripts/svg/illustration.mjs`
- Create: `theme1/src/partials/ui/illustration.njk`
- Create: `theme1/src/styles/components/_illustration.scss`
- Test: `theme1/tests/unit/svg-illustration.test.js`

**Interfaces:**
- Produces: `ILLUSTRATIONS: string[]` and `illustration(name, { title }) => string`.

The 14 named scenes, replacing the paid UI8 and Freepik artwork:

| Name | Used by |
|---|---|
| `empty-inbox` | Email, chat, notifications empty states |
| `empty-search` | Zero results after filtering |
| `empty-list` | Any empty collection |
| `error-404` | Not-found page |
| `error-500` | Server-error page |
| `not-authorized` | Permission-denied page |
| `maintenance` | Under-maintenance page |
| `coming-soon` | Coming-soon page |
| `auth-panel` | The v2 split auth layout |
| `pricing` | Pricing page hero |
| `faq` | FAQ hero |
| `knowledge-base` | Knowledge-base hero |
| `welcome` | Welcome mail and first-run dashboard card |
| `success` | Order confirmed, payment received |

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/svg-illustration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { illustration, ILLUSTRATIONS } from '../../scripts/svg/illustration.mjs';

const EXPECTED = [
  'empty-inbox', 'empty-search', 'empty-list', 'error-404', 'error-500', 'not-authorized',
  'maintenance', 'coming-soon', 'auth-panel', 'pricing', 'faq', 'knowledge-base', 'welcome', 'success',
];

describe('catalogue', () => {
  it('contains exactly the fourteen named scenes', () => {
    expect([...ILLUSTRATIONS].sort()).toEqual([...EXPECTED].sort());
  });
});

describe.each(EXPECTED)('%s', (name) => {
  const out = illustration(name, { title: name });

  it('is a single svg element', () => {
    expect(out.startsWith('<svg')).toBe(true);
    expect(out.trimEnd().endsWith('</svg>')).toBe(true);
    expect(out.match(/<svg/g)).toHaveLength(1);
  });

  it('has a viewBox and no fixed dimensions', () => {
    expect(out).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(out).not.toMatch(/\swidth="\d/);
  });

  it('uses only tokens and currentColor for colour', () => {
    expect(out).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(out).not.toMatch(/\brgb\(/);
    expect(out).toMatch(/var\(--t-|currentColor/);
  });

  it('is titled and exposed as an image', () => {
    expect(out).toContain('role="img"');
    expect(out).toContain('<title');
  });

  it('has enough shapes to be a scene rather than a placeholder box', () => {
    const shapes = out.match(/<(path|circle|rect|ellipse|polygon|line)\b/g) ?? [];
    expect(shapes.length).toBeGreaterThanOrEqual(6);
  });

  it('embeds no raster data', () => {
    expect(out).not.toContain('data:image/png');
    expect(out).not.toContain('<image');
  });

  it('references no external resource', () => {
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/xlink:href="(?!#)/);
  });

  it('is deterministic', () => {
    expect(illustration(name, { title: name })).toBe(out);
  });

  it('stays small enough to inline', () => {
    expect(out.length).toBeLessThan(12_000);
  });
});

describe('unknown names', () => {
  it('throws rather than silently rendering nothing', () => {
    expect(() => illustration('does-not-exist')).toThrow(/does-not-exist/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/svg-illustration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Draw the fourteen scenes**

This is design work, not transcription. Compose each scene from the primitives using a shared visual language so the set reads as one family:

- A consistent 400 × 300 viewBox and a common horizon or baseline.
- A three-value depth scheme: a `var(--t-action-primary-bg-soft)` back plane, `var(--t-border-default)` mid-tone structure, and `currentColor` foreground detail.
- Geometric construction — rounded rectangles, circles, arcs, simple polygons. No gradients heavier than a two-stop token pair, no rendered shadows.
- One accent element per scene in `var(--t-action-primary-bg)` to carry the eye.
- Legible at 200 px: nothing thinner than 2 units of stroke, no detail smaller than 8 units.
- No human faces, no company marks, no product likenesses.

Verify each scene against the tests, then look at all fourteen side by side on the style guide and adjust until they read as a set.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/svg-illustration.test.js`
Expected: PASS — 1 + 14 × 9 + 1 = 128 tests.

- [ ] **Step 5: Write the macro and styles**

`illustration.njk` inlines the SVG — inlining is what lets `currentColor` and the tokens work. `_illustration.scss` sets a max inline size, centres it, and provides `--illustration-tone` so a page can shift the accent.

Wire `emptyState()` from Phase 03 to accept an illustration name.

- [ ] **Step 6: Commit**

```bash
git add theme1/scripts/svg/illustration.mjs theme1/src/partials/ui/illustration.njk theme1/src/styles/components/_illustration.scss theme1/src/partials/ui/empty-state.njk theme1/tests/unit/svg-illustration.test.js
git commit -m "feat(art): fourteen original token-coloured illustration scenes"
```

---

### Task 4: Patterns, role icons, brand mark

**Files:**
- Create: `theme1/scripts/svg/pattern.mjs`, `role-icons.mjs`, `brand.mjs`
- Test: `theme1/tests/unit/svg-pattern.test.js`, `svg-role-icons.test.js`

**Interfaces:**
- Produces:
  - `pattern(seed: string, { variant: 'product'|'banner'|'cover'|'tile', ratio }) => string`
  - `ROLE_ICONS: string[]` and `roleIcon(name) => string`
  - `logo({ variant: 'full'|'mark', title }) => string`, `faviconSvg() => string`

The role icons replace the 34 trademarked files in the source template's `images/icons/`. They are generic **categories**, not brands:

`browser` · `cloud-storage` · `design-file` · `document` · `spreadsheet` · `presentation` · `archive` · `code-file` · `image-file` · `video-file` · `audio-file` · `pdf-file` · `text-file` · `database` · `unknown-file` · `framework` · `package` · `plugin`

- [ ] **Step 1: Write the failing tests**

`svg-pattern.test.js` asserts: `pattern` is deterministic for a seed; different seeds produce different output; the same seed with a different variant differs; output uses only tokens; each variant honours its aspect ratio; and generated markup stays under 4 KB.

`svg-role-icons.test.js` asserts the catalogue matches the list above exactly, every icon uses a 24 × 24 viewBox and `currentColor`, none contains a hex, and — the point of the task — a guard test:

```js
it('depicts no third-party brand', () => {
  const banned = [
    'chrome', 'safari', 'firefox', 'edge', 'opera', 'internet explorer',
    'dropbox', 'icloud', 'onedrive', 'google', 'drive', 'figma', 'sketch',
    'react', 'vue', 'angular', 'bootstrap', 'photoshop', 'psd', 'adobe', 'apple', 'microsoft',
  ];
  const all = ROLE_ICONS.map((n) => `${n} ${roleIcon(n)}`).join(' ').toLowerCase();
  for (const brand of banned) expect(all, `must not reference ${brand}`).not.toContain(brand);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/svg-pattern.test.js tests/unit/svg-role-icons.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three generators**

`pattern.mjs` composes abstract geometry from a seeded PRNG — implement `mulberry32(seed)` inline; it is six lines and avoids a dependency. Seed from a string hash so `pattern('Wireless Headphones')` is stable across builds. Variants differ in ratio and density: `product` 1:1 and dense, `banner` 3:1 and sparse, `cover` 4:1, `tile` 16:9.

`role-icons.mjs` draws each category as a simple, obviously-generic glyph in the Feather visual language: 24 × 24, 2-unit stroke, round caps, no fill.

`brand.mjs` produces the theme1 mark. Keep it abstract and geometric so there is no chance of resembling an existing logo. `faviconSvg()` emits a 32 × 32 variant with the palette baked in, since a favicon cannot inherit CSS.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/svg-pattern.test.js tests/unit/svg-role-icons.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/scripts/svg/pattern.mjs theme1/scripts/svg/role-icons.mjs theme1/scripts/svg/brand.mjs theme1/tests/unit/svg-pattern.test.js theme1/tests/unit/svg-role-icons.test.js
git commit -m "feat(art): abstract patterns, brand-neutral role icons and the theme1 mark"
```

---

### Task 5: Generator CLI and the licence-cleanliness gate

**Files:**
- Create: `theme1/scripts/svg-gen.mjs`
- Create: `theme1/tests/build/no-raster.test.js`
- Modify: `theme1/package.json`, `theme1/vite.config.js`, `theme1/.github/workflows/ci.yml`, `theme1/src/layouts/base.njk`

**Interfaces:**
- Produces: `generateAll(outDir) => Promise<string[]>`; the `dist/` gate.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/build/no-raster.test.js`:

```js
import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const distDir = path.join(rootDir, 'dist');

describe('licence cleanliness', () => {
  it('ships no raster image of any format', async () => {
    const raster = await fg('**/*.{jpg,jpeg,png,gif,webp,avif,bmp,tif,tiff,ico}', { cwd: distDir });
    expect(raster).toEqual([]);
  });

  it('ships no raster image in the source tree either', async () => {
    const raster = await fg('**/*.{jpg,jpeg,png,gif,webp,avif,bmp}', { cwd: path.join(rootDir, 'src') });
    expect(raster).toEqual([]);
  });

  it('embeds no base64 raster inside any built file', async () => {
    const files = await fg('**/*.{html,css,js,svg}', { cwd: distDir, absolute: true });
    const offenders = [];
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      if (/data:image\/(png|jpe?g|gif|webp|avif);base64/i.test(text)) offenders.push(path.relative(distDir, file));
    }
    expect(offenders).toEqual([]);
  });

  it('references no remote image host', async () => {
    const files = await fg('**/*.{html,css,js}', { cwd: distDir, absolute: true });
    const offenders = [];
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      if (/https?:\/\/[^"')\s]*\.(png|jpe?g|gif|webp|avif|svg)/i.test(text)) offenders.push(path.relative(distDir, file));
    }
    expect(offenders).toEqual([]);
  });

  it('ships a favicon, as SVG', async () => {
    const favicons = await fg('**/favicon*.svg', { cwd: distDir });
    expect(favicons.length).toBeGreaterThan(0);
  });

  it('keeps the whole image payload trivially small', async () => {
    const svgs = await fg('**/*.svg', { cwd: distDir, absolute: true });
    let total = 0;
    for (const file of svgs) total += (await stat(file)).size;
    expect(total).toBeLessThan(400 * 1024);
  });

  it('names no third-party brand anywhere in the built output', async () => {
    const files = await fg('**/*.{html,css,js,svg}', { cwd: distDir, absolute: true });
    const banned = ['unsplash', 'freepik', 'ui8.net', 'pixinvent', 'vuexy', 'themeforest', 'fontawesome', 'font-awesome'];
    const offenders = [];
    for (const file of files) {
      const text = (await readFile(file, 'utf8')).toLowerCase();
      for (const term of banned) if (text.includes(term)) offenders.push(`${path.relative(distDir, file)}: ${term}`);
    }
    expect(offenders).toEqual([]);
  });
});
```

The last assertion is the one that matters most: it is a standing, automated check that nothing from the source template ever leaks into the deliverable.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/build/no-raster.test.js`
Expected: FAIL — no favicon yet, and possibly leftover references.

- [ ] **Step 3: Write `scripts/svg-gen.mjs`**

Generate into `src/generated/img/`: the fourteen illustrations, the eighteen role icons, `logo-full.svg`, `logo-mark.svg`, `favicon.svg`, and a set of seeded patterns for the demo data. Print a summary line with the file count and total bytes.

Add `"art": "node scripts/svg-gen.mjs"` and make `build` run `npm run icons && npm run art && vite build`.

Link the favicon from `base.njk` as `<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/build/no-raster.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Wire the gate into CI**

Add `"test:assets": "vitest run tests/build/no-raster.test.js"` and a CI step after `Build`.

- [ ] **Step 6: Full verification**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 7: Commit**

```bash
git add theme1/scripts/svg-gen.mjs theme1/tests/build/no-raster.test.js theme1/package.json theme1/vite.config.js theme1/.github/workflows/ci.yml theme1/src/layouts/base.njk
git commit -m "feat(art): svg generator cli and the no-raster licence gate"
```

---

## Phase exit checklist

- [ ] `dist/` contains **zero** raster images, zero base64 rasters, and zero remote image references.
- [ ] The total SVG payload is under 400 KB — against 13 MB of images in the source template.
- [ ] All fourteen illustrations render, use only tokens, and read as one visual family at 200 px.
- [ ] Avatars are deterministic per name and recolour with the theme.
- [ ] All eighteen role icons are generic; the brand-name guard test passes.
- [ ] The favicon ships as SVG.
- [ ] No built file contains the words unsplash, freepik, ui8.net, pixinvent, vuexy, themeforest, or fontawesome.
- [ ] `npm run test:assets` is wired into CI.
- [ ] CI green.

**Unblocks:** Phases 07–12, which consume the illustrations, avatars and patterns.
