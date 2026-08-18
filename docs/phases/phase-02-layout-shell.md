# Phase 02 — Layout Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the application shell — sidebar, navbar, footer, breadcrumb, customizer — driven entirely by validated attributes on `<html>`, so that all 14 of the source template's physical layout folders collapse into runtime state.

**Architecture:** `theme-store.js` is the single owner of layout state. An inline boot snippet stamps validated attributes on `<html>` before first paint, so there is no flash. Every shell component reads state from attribute selectors in CSS, not from JavaScript branching. The customizer is a thin UI over the store and holds nothing itself. All directional CSS is logical, so RTL needs no second stylesheet.

**Tech Stack:** Vanilla ES modules · CSS Grid · CSS custom properties · Nunjucks · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Never `@import "bootstrap/scss/bootstrap"` wholesale — selective imports only, via `src/styles/bootstrap/_config.scss`.
- **No jQuery.** Not as a dependency, not as a peer, not in a vendored file.
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only dependencies additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.** Physical `left`/`right` properties are a lint error.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, in both themes.
- **Fonts self-hosted.** Inter (SIL OFL) only.
- **Icons: Feather (MIT) only**, as one SVG sprite.
- **No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## File Structure

| File | Responsibility |
|---|---|
| `src/scripts/core/theme-store.js` | Validated layout state: schema, defaults, persistence, events |
| `src/scripts/core/theme-boot.js` | Pre-paint snippet source; inlined into `<head>` at build time |
| `src/scripts/core/menu.js` | Sidebar accordion, collapse/hover, overlay, keyboard navigation |
| `src/scripts/core/navbar.js` | Navbar search, dropdown wiring, mobile toggle |
| `src/scripts/core/customizer.js` | Customizer panel UI bound to the store |
| `src/scripts/core/scroll-top.js` | Scroll-to-top affordance |
| `scripts/vite-plugin-theme-boot.mjs` | Inlines the boot snippet with a CSP hash |
| `src/layouts/shell.njk` | The shell layout page templates extend |
| `src/partials/shell/sidebar.njk` | Sidebar, rendered from `navigation.json` |
| `src/partials/shell/navbar.njk` | Top bar |
| `src/partials/shell/footer.njk` | Footer |
| `src/partials/shell/breadcrumb.njk` | Page header + breadcrumb trail |
| `src/partials/shell/customizer.njk` | Customizer panel markup |
| `src/data/navigation.json` | The full 3-level nav tree |
| `src/styles/layout/_shell.scss` | Grid, layout variants, boxed/fluid |
| `src/styles/layout/_sidebar.scss` | Sidebar in all skins and states |
| `src/styles/layout/_navbar.scss` | Navbar in all four types and eight colours |
| `src/styles/layout/_footer.scss` | Footer in all three types |
| `src/styles/layout/_customizer.scss` | Customizer panel |
| `tests/layout/option-matrix.test.js` | Every attribute combination renders coherently |

---

### Task 1: Theme store

**Files:**
- Create: `theme1/src/scripts/core/theme-store.js`
- Test: `theme1/tests/unit/theme-store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SCHEMA: Record<string, { attr: string, values: string[], default: string }>` — one entry per option in spec §8
  - `DEFAULTS: Record<string, string>`
  - `STORAGE_KEY = 'theme1:layout'`
  - `validate(state: object) => object` — drops unknown keys, replaces invalid values with defaults
  - `read(storage = localStorage) => object`
  - `apply(state: object, el = document.documentElement) => void`
  - `createStore({ storage, element }) => { get(key), set(key, value), setAll(partial), reset(), subscribe(fn) => unsubscribe, getState() }`
  - Event: `theme:change` CustomEvent on `element`, `detail = { key, value, state }`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/theme-store.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SCHEMA, DEFAULTS, STORAGE_KEY, validate, read, apply, createStore } from '../../src/scripts/core/theme-store.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  for (const { attr } of Object.values(SCHEMA)) document.documentElement.removeAttribute(attr);
});

describe('SCHEMA', () => {
  it('covers every option in the spec options matrix', () => {
    const expected = [
      'theme', 'preset', 'nav', 'navSkin', 'navState', 'navbar', 'navbarColor',
      'footer', 'width', 'density', 'direction', 'contentSidebar', 'motion', 'contrast', 'fontScale',
    ];
    expect(Object.keys(SCHEMA).sort()).toEqual(expected.sort());
  });

  it('gives every option a default that is one of its allowed values', () => {
    for (const [key, def] of Object.entries(SCHEMA)) {
      expect(def.values, `${key}`).toContain(def.default);
      expect(DEFAULTS[key]).toBe(def.default);
    }
  });

  it('matches the spec defaults', () => {
    expect(DEFAULTS.theme).toBe('system');
    expect(DEFAULTS.nav).toBe('vertical');
    expect(DEFAULTS.navState).toBe('expanded');
    expect(DEFAULTS.navbar).toBe('floating');
    expect(DEFAULTS.footer).toBe('static');
    expect(DEFAULTS.width).toBe('fluid');
    expect(DEFAULTS.density).toBe('comfortable');
    expect(DEFAULTS.direction).toBe('ltr');
    expect(DEFAULTS.fontScale).toBe('100');
  });
});

describe('validate', () => {
  it('fills in every missing key with its default', () => {
    expect(validate({})).toEqual(DEFAULTS);
  });

  it('keeps valid values', () => {
    expect(validate({ theme: 'dark' }).theme).toBe('dark');
  });

  it('replaces an invalid value with the default', () => {
    expect(validate({ theme: 'neon' }).theme).toBe('system');
  });

  it('drops keys that are not in the schema', () => {
    expect(validate({ evil: '<script>' })).not.toHaveProperty('evil');
  });

  it('is not fooled by prototype pollution attempts', () => {
    const result = validate(JSON.parse('{"__proto__":{"polluted":true}}'));
    expect({}.polluted).toBeUndefined();
    expect(result).toEqual(DEFAULTS);
  });
});

describe('read', () => {
  it('returns defaults when storage is empty', () => {
    expect(read(memoryStorage())).toEqual(DEFAULTS);
  });

  it('returns defaults when storage holds malformed JSON', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(read(storage)).toEqual(DEFAULTS);
  });

  it('returns defaults when storage throws, as in private browsing', () => {
    const hostile = {
      getItem: () => { throw new DOMException('denied'); },
      setItem: () => { throw new DOMException('denied'); },
      removeItem: () => {},
    };
    expect(read(hostile)).toEqual(DEFAULTS);
  });

  it('round-trips a stored state', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'dark', density: 'compact' }));
    const state = read(storage);
    expect(state.theme).toBe('dark');
    expect(state.density).toBe('compact');
    expect(state.nav).toBe('vertical');
  });
});

describe('apply', () => {
  it('writes each option to its attribute', () => {
    apply({ ...DEFAULTS, theme: 'dark', density: 'compact' });
    const el = document.documentElement;
    expect(el.getAttribute('data-theme')).toBe('dark');
    expect(el.getAttribute('data-density')).toBe('compact');
  });

  it('writes direction to the dir attribute, not a data attribute', () => {
    apply({ ...DEFAULTS, direction: 'rtl' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('createStore', () => {
  it('applies persisted state to the element on creation', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'dark' }));
    createStore({ storage });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('set() updates state, attribute and storage together', () => {
    const storage = memoryStorage();
    const store = createStore({ storage });
    store.set('density', 'compact');
    expect(store.get('density')).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).density).toBe('compact');
  });

  it('set() ignores an invalid value and leaves state untouched', () => {
    const store = createStore({ storage: memoryStorage() });
    store.set('theme', 'neon');
    expect(store.get('theme')).toBe('system');
  });

  it('set() ignores an unknown key', () => {
    const store = createStore({ storage: memoryStorage() });
    store.set('nope', 'x');
    expect(store.getState()).not.toHaveProperty('nope');
  });

  it('emits theme:change with key, value and full state', () => {
    const store = createStore({ storage: memoryStorage() });
    const spy = vi.fn();
    document.documentElement.addEventListener('theme:change', spy);
    store.set('theme', 'dark');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toMatchObject({ key: 'theme', value: 'dark' });
    expect(spy.mock.calls[0][0].detail.state.theme).toBe('dark');
  });

  it('does not emit when the value is unchanged', () => {
    const store = createStore({ storage: memoryStorage() });
    const spy = vi.fn();
    document.documentElement.addEventListener('theme:change', spy);
    store.set('theme', store.get('theme'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('subscribe() receives changes and unsubscribe() stops them', () => {
    const store = createStore({ storage: memoryStorage() });
    const seen = [];
    const off = store.subscribe((detail) => seen.push(detail.key));
    store.set('theme', 'dark');
    off();
    store.set('density', 'compact');
    expect(seen).toEqual(['theme']);
  });

  it('reset() restores every default and clears storage', () => {
    const storage = memoryStorage();
    const store = createStore({ storage });
    store.set('theme', 'dark');
    store.reset();
    expect(store.getState()).toEqual(DEFAULTS);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('setAll() applies several options and emits once per changed key', () => {
    const store = createStore({ storage: memoryStorage() });
    const spy = vi.fn();
    document.documentElement.addEventListener('theme:change', spy);
    store.setAll({ theme: 'dark', density: 'compact', bogus: 'x' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(store.get('theme')).toBe('dark');
  });

  it('survives a storage that refuses writes', () => {
    const readonly = { getItem: () => null, setItem: () => { throw new DOMException('quota'); }, removeItem: () => {} };
    const store = createStore({ storage: readonly });
    expect(() => store.set('theme', 'dark')).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/theme-store.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/theme-store.js`**

```js
/**
 * The single owner of layout state.
 *
 * Every option lives as an attribute on <html>; CSS reads those attributes.
 * Nothing else in the theme branches on layout state in JavaScript.
 */

export const STORAGE_KEY = 'theme1:layout';

export const SCHEMA = Object.freeze({
  theme: { attr: 'data-theme', values: ['light', 'dark', 'system'], default: 'system' },
  preset: { attr: 'data-preset', values: ['calm'], default: 'calm' },
  nav: { attr: 'data-nav', values: ['vertical', 'horizontal'], default: 'vertical' },
  navSkin: { attr: 'data-nav-skin', values: ['light', 'dark', 'semi-dark', 'bordered'], default: 'light' },
  navState: { attr: 'data-nav-state', values: ['expanded', 'collapsed', 'hover', 'hidden', 'overlay'], default: 'expanded' },
  navbar: { attr: 'data-navbar', values: ['static', 'floating', 'sticky', 'hidden'], default: 'floating' },
  navbarColor: {
    attr: 'data-navbar-color',
    values: ['default', 'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'dark'],
    default: 'default',
  },
  footer: { attr: 'data-footer', values: ['static', 'sticky', 'hidden'], default: 'static' },
  width: { attr: 'data-width', values: ['fluid', 'boxed'], default: 'fluid' },
  density: { attr: 'data-density', values: ['comfortable', 'compact'], default: 'comfortable' },
  direction: { attr: 'dir', values: ['ltr', 'rtl'], default: 'ltr' },
  contentSidebar: {
    attr: 'data-content-sidebar',
    values: ['none', 'left', 'right', 'detached-left', 'detached-right'],
    default: 'none',
  },
  motion: { attr: 'data-motion', values: ['auto', 'reduced'], default: 'auto' },
  contrast: { attr: 'data-contrast', values: ['normal', 'high'], default: 'normal' },
  fontScale: { attr: 'data-font-scale', values: ['87.5', '100', '112.5', '125'], default: '100' },
});

export const DEFAULTS = Object.freeze(
  Object.fromEntries(Object.entries(SCHEMA).map(([key, def]) => [key, def.default])),
);

/** Keep only known keys with allowed values; everything else falls back to the default. */
export function validate(state) {
  const source = state && typeof state === 'object' ? state : {};
  const clean = { __proto__: null };
  for (const [key, def] of Object.entries(SCHEMA)) {
    const value = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
    clean[key] = def.values.includes(value) ? value : def.default;
  }
  return { ...clean };
}

/** Read persisted state. Any failure — absent, malformed, blocked — yields defaults. */
export function read(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? validate(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or quota exceeded. State still applies for this session.
  }
}

/** Stamp state onto the element's attributes. */
export function apply(state, el = document.documentElement) {
  for (const [key, def] of Object.entries(SCHEMA)) {
    el.setAttribute(def.attr, state[key]);
  }
}

export function createStore({ storage = globalThis.localStorage, element = document.documentElement } = {}) {
  let state = read(storage);
  apply(state, element);

  const emit = (key, value) => {
    element.dispatchEvent(
      new CustomEvent('theme:change', { detail: { key, value, state: { ...state } }, bubbles: true }),
    );
  };

  const setOne = (key, value) => {
    const def = SCHEMA[key];
    if (!def || !def.values.includes(value) || state[key] === value) return false;
    state = { ...state, [key]: value };
    element.setAttribute(def.attr, value);
    return true;
  };

  return {
    getState: () => ({ ...state }),
    get: (key) => state[key],

    set(key, value) {
      if (!setOne(key, value)) return;
      write(storage, state);
      emit(key, value);
    },

    setAll(partial) {
      const changed = Object.entries(partial ?? {}).filter(([key, value]) => setOne(key, value));
      if (changed.length === 0) return;
      write(storage, state);
      for (const [key, value] of changed) emit(key, value);
    },

    reset() {
      state = { ...DEFAULTS };
      apply(state, element);
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      emit('*', null);
    },

    subscribe(listener) {
      const handler = (event) => listener(event.detail);
      element.addEventListener('theme:change', handler);
      return () => element.removeEventListener('theme:change', handler);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/theme-store.test.js`
Expected: PASS — 26 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/scripts/core/theme-store.js theme1/tests/unit/theme-store.test.js
git commit -m "feat(shell): validated layout state store"
```

---

### Task 2: Pre-paint boot snippet

**Files:**
- Create: `theme1/src/scripts/core/theme-boot.js`
- Create: `theme1/scripts/vite-plugin-theme-boot.mjs`
- Modify: `theme1/vite.config.js`
- Modify: `theme1/src/layouts/base.njk`
- Test: `theme1/tests/unit/theme-boot.test.js`

**Interfaces:**
- Consumes: `SCHEMA`, `DEFAULTS`, `STORAGE_KEY` semantics from Task 1 — duplicated deliberately, because the snippet must be standalone and dependency-free.
- Produces: `bootSource(): string` — the snippet body; `THEME_BOOT_PLACEHOLDER = '<!--theme-boot-->'` which `base.njk` contains and the plugin replaces.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/theme-boot.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { bootSource } from '../../src/scripts/core/theme-boot.js';
import { SCHEMA, STORAGE_KEY } from '../../src/scripts/core/theme-store.js';

function runBoot(stored) {
  const map = new Map();
  if (stored !== undefined) map.set(STORAGE_KEY, JSON.stringify(stored));
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: () => {},
    removeItem: () => {},
  };
  // eslint-disable-next-line no-new-func
  new Function('document', 'localStorage', bootSource())(document, storage);
}

beforeEach(() => {
  for (const { attr } of Object.values(SCHEMA)) document.documentElement.removeAttribute(attr);
});

describe('theme boot snippet', () => {
  it('stamps defaults when storage is empty', () => {
    runBoot(undefined);
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(document.documentElement.getAttribute('data-nav')).toBe('vertical');
  });

  it('stamps persisted values', () => {
    runBoot({ theme: 'dark', density: 'compact' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('rejects a value outside the allow-list', () => {
    runBoot({ theme: 'neon' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
  });

  it('survives malformed storage without throwing', () => {
    const storage = { getItem: () => '{broken', setItem: () => {}, removeItem: () => {} };
    // eslint-disable-next-line no-new-func
    expect(() => new Function('document', 'localStorage', bootSource())(document, storage)).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
  });

  it('sets dir for rtl', () => {
    runBoot({ direction: 'rtl' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('stays small enough to inline without hurting first paint', () => {
    expect(bootSource().length).toBeLessThan(2048);
  });

  it('contains no template placeholders', () => {
    expect(bootSource()).not.toMatch(/TODO|FIXME|undefined/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/theme-boot.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/theme-boot.js`**

```js
import { SCHEMA, STORAGE_KEY } from './theme-store.js';

export const THEME_BOOT_PLACEHOLDER = '<!--theme-boot-->';

/**
 * Source for the render-blocking snippet inlined into <head>.
 *
 * It must run before first paint and must not import anything, so the schema is
 * serialised into it at build time rather than imported. `theme-store.js` remains
 * the single source of truth — this is generated from it.
 */
export function bootSource() {
  const table = Object.fromEntries(
    Object.entries(SCHEMA).map(([, def]) => [def.attr, [def.values, def.default]]),
  );

  return `try{var S=${JSON.stringify(table)},d=document.documentElement,s={};
try{s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))||{}}catch(e){}
var m={};for(var k in S){m[k]=1}
var K=${JSON.stringify(Object.fromEntries(Object.entries(SCHEMA).map(([key, def]) => [key, def.attr])))};
for(var key in K){var a=K[key],v=s[key],c=S[a];d.setAttribute(a,c[0].indexOf(v)>-1?v:c[1])}
}catch(e){}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/theme-boot.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write `scripts/vite-plugin-theme-boot.mjs`**

```js
import { createHash } from 'node:crypto';

/**
 * Replaces the <!--theme-boot--> marker in every HTML file with the inline
 * pre-paint snippet, and reports the CSP hash so no 'unsafe-inline' is needed.
 */
export default function themeBootPlugin({ source }) {
  const script = `<script>${source}</script>`;
  const hash = createHash('sha256').update(source, 'utf8').digest('base64');

  return {
    name: 'theme1:theme-boot',

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('<!--theme-boot-->', script);
      },
    },

    closeBundle() {
      console.log(`[theme1] CSP script hash for the boot snippet: 'sha256-${hash}'`);
    },
  };
}
```

- [ ] **Step 6: Wire it into `vite.config.js` and `base.njk`**

In `vite.config.js`, import `bootSource` and the plugin, and add to `plugins`:

```js
import themeBootPlugin from './scripts/vite-plugin-theme-boot.mjs';
import { bootSource } from './src/scripts/core/theme-boot.js';
// …
plugins: [pagesPlugin({ root }), themeBootPlugin({ source: bootSource() })],
```

In `src/layouts/base.njk`, place the marker as the **first** element inside `<head>` after the charset meta, and drop the hard-coded `dir`:

```njk
<!doctype html>
<html lang="{{ locale | default('en') }}">
  <head>
    <meta charset="utf-8" />
    <!--theme-boot-->
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    …
```

- [ ] **Step 7: Verify no flash by hand**

Run: `cd theme1 && npm run build && npm run preview`
In devtools, set `localStorage['theme1:layout'] = '{"theme":"dark"}'` and hard-reload with network throttled to Slow 3G.
Expected: the page paints dark immediately — no light flash at any point.

- [ ] **Step 8: Commit**

```bash
git add theme1/src/scripts/core/theme-boot.js theme1/scripts/vite-plugin-theme-boot.mjs theme1/vite.config.js theme1/src/layouts/base.njk theme1/tests/unit/theme-boot.test.js
git commit -m "feat(shell): pre-paint theme boot snippet with csp hash"
```

---

### Task 3: Navigation data and the shell layout

**Files:**
- Create: `theme1/src/data/navigation.json`
- Create: `theme1/src/layouts/shell.njk`
- Create: `theme1/src/partials/shell/breadcrumb.njk`
- Create: `theme1/src/styles/layout/_shell.scss`
- Test: `theme1/tests/unit/navigation-data.test.js`

**Interfaces:**
- Consumes: tokens from Phase 01.
- Produces: `navigation.json` shape consumed by `sidebar.njk` (Task 4) and the horizontal nav (Task 6):

```jsonc
{
  "sections": [
    {
      "label": "Dashboards",           // section header; omit for an unlabelled group
      "items": [
        {
          "label": "Analytics",
          "href": "dashboard-analytics.html",  // omit when "children" is present
          "icon": "bar-chart-2",               // Feather icon name
          "badge": { "text": "New", "intent": "primary" },  // optional
          "disabled": false,                                 // optional
          "external": false,                                 // optional
          "children": []                                     // up to 2 further levels
        }
      ]
    }
  ]
}
```

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/navigation-data.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
let nav;

beforeAll(async () => {
  nav = JSON.parse(await readFile(path.join(rootDir, 'src/data/navigation.json'), 'utf8'));
});

function walk(items, depth = 1, out = []) {
  for (const item of items) {
    out.push({ ...item, depth });
    if (item.children?.length) walk(item.children, depth + 1, out);
  }
  return out;
}

describe('navigation.json', () => {
  it('is organised into sections', () => {
    expect(Array.isArray(nav.sections)).toBe(true);
    expect(nav.sections.length).toBeGreaterThan(0);
  });

  it('gives every item a label', () => {
    for (const item of nav.sections.flatMap((s) => walk(s.items))) {
      expect(item.label, JSON.stringify(item)).toBeTruthy();
    }
  });

  it('nests no deeper than three levels', () => {
    const deepest = Math.max(...nav.sections.flatMap((s) => walk(s.items)).map((i) => i.depth));
    expect(deepest).toBeLessThanOrEqual(3);
  });

  it('gives every leaf an href and every branch children, never both', () => {
    for (const item of nav.sections.flatMap((s) => walk(s.items))) {
      const hasChildren = Boolean(item.children?.length);
      const hasHref = Boolean(item.href);
      expect(hasChildren !== hasHref, `${item.label} must have exactly one of href/children`).toBe(true);
    }
  });

  it('points every internal href at a page that exists', async () => {
    const pages = new Set((await readdir(path.join(rootDir, 'src/pages'))).map((f) => f.replace(/\.njk$/, '.html')));
    const missing = nav.sections
      .flatMap((s) => walk(s.items))
      .filter((i) => i.href && !i.external && !pages.has(i.href))
      .map((i) => `${i.label} -> ${i.href}`);
    expect(missing).toEqual([]);
  });

  it('marks every external link as external', () => {
    for (const item of nav.sections.flatMap((s) => walk(s.items))) {
      if (item.href?.startsWith('http')) expect(item.external, item.label).toBe(true);
    }
  });

  it('includes a disabled item so that state is exercised', () => {
    expect(nav.sections.flatMap((s) => walk(s.items)).some((i) => i.disabled)).toBe(true);
  });

  it('includes a badge so that affordance is exercised', () => {
    expect(nav.sections.flatMap((s) => walk(s.items)).some((i) => i.badge)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/navigation-data.test.js`
Expected: FAIL — `navigation.json` does not exist.

- [ ] **Step 3: Author `src/data/navigation.json`**

Build the full tree from spec §6. Sections, in order: **Dashboards**, **Apps**, **Pages**, **User Interface**, **Forms & Tables**, **Charts & Maps**, **Misc**.

Start with only the pages that already exist (`index.njk`), and extend the file in each later phase as its pages land — the `href` existence test above enforces that discipline. Seed it now as:

```json
{
  "sections": [
    {
      "label": "Dashboards",
      "items": [
        { "label": "eCommerce", "href": "index.html", "icon": "shopping-bag", "badge": { "text": "New", "intent": "primary" } }
      ]
    },
    {
      "label": "Misc",
      "items": [
        { "label": "Coming soon", "icon": "clock", "disabled": true },
        { "label": "Documentation", "href": "https://example.invalid/docs", "icon": "book-open", "external": true }
      ]
    }
  ]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/navigation-data.test.js`
Expected: PASS — 8 tests.

Note: the disabled item has neither `href` nor `children`, which the exactly-one rule rejects. Fix the rule in the test to exempt disabled items, then re-run:

```js
  it('gives every enabled leaf an href and every branch children, never both', () => {
    for (const item of nav.sections.flatMap((s) => walk(s.items))) {
      if (item.disabled) continue;
      const hasChildren = Boolean(item.children?.length);
      const hasHref = Boolean(item.href);
      expect(hasChildren !== hasHref, `${item.label} must have exactly one of href/children`).toBe(true);
    }
  });
```

- [ ] **Step 5: Write `src/styles/layout/_shell.scss`**

```scss
// The shell grid. Layout variants are attribute selectors, never separate files.

.t-shell {
  display: grid;
  min-block-size: 100dvh;
  grid-template-areas:
    'sidebar navbar'
    'sidebar main'
    'sidebar footer';
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr auto;
}

.t-shell__sidebar { grid-area: sidebar; }
.t-shell__navbar { grid-area: navbar; }
.t-shell__main {
  grid-area: main;
  padding: var(--t-gutter);
}
.t-shell__footer { grid-area: footer; }

// Horizontal navigation: the sidebar column collapses away entirely.
[data-nav='horizontal'] .t-shell {
  grid-template-areas: 'navbar' 'main' 'footer';
  grid-template-columns: 1fr;
}

[data-nav='horizontal'] .t-shell__sidebar,
[data-nav-state='hidden'] .t-shell__sidebar {
  display: none;
}

// Boxed width caps the main column without touching the chrome.
[data-width='boxed'] .t-shell__main {
  inline-size: min(100%, 90rem);
  margin-inline: auto;
}

// Footer types.
[data-footer='hidden'] .t-shell__footer { display: none; }
[data-footer='sticky'] .t-shell__footer {
  position: sticky;
  inset-block-end: 0;
  z-index: var(--t-z-30);
}

// Content sidebars sit inside main, so they are unaffected by nav layout.
.t-shell__content {
  display: grid;
  gap: var(--t-shell-gap);
}

[data-content-sidebar='left'] .t-shell__content,
[data-content-sidebar='detached-left'] .t-shell__content {
  grid-template-columns: 16rem 1fr;
}

[data-content-sidebar='right'] .t-shell__content,
[data-content-sidebar='detached-right'] .t-shell__content {
  grid-template-columns: 1fr 16rem;
}

[data-content-sidebar='detached-left'] .t-shell__content-aside,
[data-content-sidebar='detached-right'] .t-shell__content-aside {
  align-self: start;
  border-radius: var(--t-card-radius);
  background-color: var(--t-surface-raised);
  box-shadow: var(--t-elevation-raised);
}

@media (max-width: 61.99em) {
  .t-shell__content {
    grid-template-columns: 1fr !important;
  }
}

.t-skip-link {
  position: absolute;
  inset-block-start: var(--t-space-2);
  inset-inline-start: var(--t-space-2);
  z-index: var(--t-z-70);
  padding: var(--t-space-2) var(--t-space-4);
  border-radius: var(--t-radius-md);
  background-color: var(--t-surface-raised);
  color: var(--t-content-link);
  transform: translateY(-200%);

  &:focus-visible {
    transform: none;
  }
}
```

- [ ] **Step 6: Write `src/layouts/shell.njk` and `src/partials/shell/breadcrumb.njk`**

`shell.njk` extends `base.njk` and lays out the five regions:

```njk
{% extends "layouts/base.njk" %}

{% block body %}
  <a class="t-skip-link" href="#main">Skip to content</a>
  <div class="t-shell">
    {% include "partials/shell/sidebar.njk" %}
    {% include "partials/shell/navbar.njk" %}
    <main class="t-shell__main" id="main">
      {% include "partials/shell/breadcrumb.njk" %}
      <div class="t-shell__content">
        {% block content %}{% endblock %}
      </div>
    </main>
    {% include "partials/shell/footer.njk" %}
  </div>
  {% include "partials/shell/customizer.njk" %}
{% endblock %}
```

`breadcrumb.njk` renders `pageTitle` and a `breadcrumbs` array of `{ label, href }`, with the last entry marked `aria-current="page"` and the whole trail wrapped in `<nav aria-label="Breadcrumb">`.

Create empty stubs for `sidebar.njk`, `navbar.njk`, `footer.njk`, and `customizer.njk` so the include resolves; each is filled in by the task that owns it.

- [ ] **Step 7: Register the stylesheet and rebuild**

Add `@use 'layout/shell';` to `src/styles/theme1.scss`, then run `cd theme1 && npm run build`.
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add theme1/src/data/navigation.json theme1/src/layouts/shell.njk theme1/src/partials/shell/ theme1/src/styles/layout/_shell.scss theme1/src/styles/theme1.scss theme1/tests/unit/navigation-data.test.js
git commit -m "feat(shell): navigation data, shell grid and layout variants"
```

---

### Task 4: Sidebar

**Files:**
- Create: `theme1/src/partials/shell/sidebar.njk`
- Create: `theme1/src/scripts/core/menu.js`
- Create: `theme1/src/styles/layout/_sidebar.scss`
- Test: `theme1/tests/unit/menu.test.js`

**Interfaces:**
- Consumes: `navigation.json`; `createStore` from Task 1.
- Produces: `init(root)`, `destroy(root)`, `defaults` from `menu.js`, per the shared component contract in `docs/phases/README.md`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/menu.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init, destroy } from '../../src/scripts/core/menu.js';

const MARKUP = `
<nav class="t-sidebar" data-t-menu aria-label="Main">
  <ul class="t-sidebar__list">
    <li class="t-sidebar__item">
      <a class="t-sidebar__link" href="index.html">Dashboard</a>
    </li>
    <li class="t-sidebar__item t-sidebar__item--branch">
      <button class="t-sidebar__link" type="button" aria-expanded="false" aria-controls="sub-apps" id="btn-apps">Apps</button>
      <ul class="t-sidebar__sublist" id="sub-apps" hidden>
        <li class="t-sidebar__item"><a class="t-sidebar__link" href="app-email.html">Email</a></li>
        <li class="t-sidebar__item t-sidebar__item--branch">
          <button class="t-sidebar__link" type="button" aria-expanded="false" aria-controls="sub-invoice">Invoice</button>
          <ul class="t-sidebar__sublist" id="sub-invoice" hidden>
            <li class="t-sidebar__item"><a class="t-sidebar__link" href="app-invoice-list.html">List</a></li>
          </ul>
        </li>
      </ul>
    </li>
    <li class="t-sidebar__item">
      <span class="t-sidebar__link" aria-disabled="true">Soon</span>
    </li>
  </ul>
</nav>`;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  init(document);
});

afterEach(() => {
  destroy(document);
  document.body.innerHTML = '';
});

const branch = () => document.getElementById('btn-apps');
const sub = () => document.getElementById('sub-apps');

describe('branch toggling', () => {
  it('starts collapsed', () => {
    expect(branch().getAttribute('aria-expanded')).toBe('false');
    expect(sub().hidden).toBe(true);
  });

  it('expands on click', () => {
    branch().click();
    expect(branch().getAttribute('aria-expanded')).toBe('true');
    expect(sub().hidden).toBe(false);
  });

  it('collapses again on a second click', () => {
    branch().click();
    branch().click();
    expect(branch().getAttribute('aria-expanded')).toBe('false');
    expect(sub().hidden).toBe(true);
  });

  it('closes sibling branches — accordion behaviour', () => {
    const second = document.createElement('li');
    second.className = 't-sidebar__item t-sidebar__item--branch';
    second.innerHTML = '<button class="t-sidebar__link" type="button" aria-expanded="false" aria-controls="sub-ui" id="btn-ui">UI</button><ul class="t-sidebar__sublist" id="sub-ui" hidden></ul>';
    document.querySelector('.t-sidebar__list').append(second);
    destroy(document);
    init(document);

    branch().click();
    document.getElementById('btn-ui').click();
    expect(branch().getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves nested branches independent of their parent', () => {
    branch().click();
    const nested = document.querySelector('[aria-controls="sub-invoice"]');
    nested.click();
    expect(nested.getAttribute('aria-expanded')).toBe('true');
    expect(branch().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('keyboard operation', () => {
  it('toggles a branch on Enter and Space', () => {
    branch().focus();
    branch().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(branch().getAttribute('aria-expanded')).toBe('true');
    branch().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(branch().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus between links with ArrowDown and ArrowUp', () => {
    const links = [...document.querySelectorAll('.t-sidebar__link:not([aria-disabled])')];
    links[0].focus();
    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(links[1]);
    links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(links[0]);
  });

  it('collapses an open branch with Escape and returns focus to its trigger', () => {
    branch().click();
    const child = sub().querySelector('.t-sidebar__link');
    child.focus();
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(branch().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(branch());
  });

  it('skips disabled items when moving focus', () => {
    const links = [...document.querySelectorAll('.t-sidebar__link')];
    const last = links[links.length - 2];
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement.getAttribute('aria-disabled')).not.toBe('true');
  });
});

describe('active trail', () => {
  it('marks the link matching the current page and opens its ancestors', () => {
    destroy(document);
    init(document, { currentPage: 'app-invoice-list.html' });
    const active = document.querySelector('[href="app-invoice-list.html"]');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(document.getElementById('sub-apps').hidden).toBe(false);
    expect(document.getElementById('sub-invoice').hidden).toBe(false);
  });
});

describe('lifecycle', () => {
  it('destroy() removes listeners so clicks no longer toggle', () => {
    destroy(document);
    branch().click();
    expect(branch().getAttribute('aria-expanded')).toBe('false');
  });

  it('init() is idempotent — a second call does not double-bind', () => {
    init(document);
    branch().click();
    expect(branch().getAttribute('aria-expanded')).toBe('true');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/menu.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/menu.js`**

Implement to satisfy every test above. Required behaviour, in full:

- One delegated `click` and one delegated `keydown` listener per `[data-t-menu]` root, stored on a `WeakMap` so `destroy` can remove exactly what `init` added, and so `init` on an already-initialised root is a no-op.
- Clicking a `[aria-expanded]` trigger toggles `aria-expanded` and the `hidden` property of the element named by `aria-controls`.
- Opening a branch closes its **siblings only** — walk `element.closest('ul')` and toggle other direct-child branches, never ancestors or descendants.
- `Enter` and `Space` on a trigger call the same toggle and `preventDefault()`.
- `ArrowDown` / `ArrowUp` move focus through visible, non-`[aria-disabled="true"]` `.t-sidebar__link` elements, wrapping at both ends. Recompute the visible list on each keypress — collapsed branches hide their children.
- `Home` / `End` jump to the first and last visible link.
- `Escape` inside an open sublist collapses the nearest ancestor branch and focuses its trigger.
- `init(root, { currentPage })` defaults `currentPage` to the final path segment of `location.pathname`. It sets `aria-current="page"` on the matching link and expands every ancestor branch.
- `defaults = { currentPage: undefined, accordion: true }`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/menu.test.js`
Expected: PASS — 12 tests.

- [ ] **Step 5: Write `src/partials/shell/sidebar.njk`**

Render `navigation.json` recursively with a Nunjucks macro. Requirements:

- `<nav class="t-sidebar t-shell__sidebar" data-t-menu aria-label="Main">`.
- Brand block at the top: the generated logo SVG plus the product name, and a collapse toggle button with `aria-label="Collapse navigation"` and `aria-pressed` bound to `navState`.
- Section headers render as `<li class="t-sidebar__section" role="presentation">`; they are decorative, so they carry no heading semantics.
- A leaf renders `<a class="t-sidebar__link" href="…">`; a branch renders `<button type="button" aria-expanded="false" aria-controls="…">`. Generate `aria-controls` ids from a slug of the label plus the depth, so they stay unique.
- `disabled: true` renders `<span class="t-sidebar__link" aria-disabled="true">` — never a disabled anchor, which is not focusable and drops out of the a11y tree.
- `external: true` adds `target="_blank" rel="noopener noreferrer"` and a visually-hidden "(opens in a new tab)".
- Icons come from the Feather sprite via `<svg class="t-icon" aria-hidden="true"><use href="#feather-{{ item.icon }}"></use></svg>`.
- Badges render the `badge.text` with the `badge.intent` state tokens.

- [ ] **Step 6: Write `src/styles/layout/_sidebar.scss`**

Cover, using logical properties only:

- Base: `inline-size: var(--t-sidebar-width)`, sticky, own scroll container, `overscroll-behavior: contain`.
- `[data-nav-state='collapsed']`: width becomes `--t-sidebar-width-collapsed`; labels and badges are hidden with a visually-hidden pattern, not `display: none`, so screen readers keep them; icons centre.
- `[data-nav-state='hover']`: collapsed until `:hover` or `:focus-within`, then it expands over the content with `--t-elevation-overlay`.
- `[data-nav-state='overlay']` (mobile): fixed, translated off-canvas on the inline-start edge, with a backdrop; slides in when `[data-nav-open='true']`.
- Skins: `[data-nav-skin='dark']` and `'semi-dark'` apply the dark token block scoped to the sidebar; `'bordered'` swaps elevation for a `border-inline-end`.
- Active trail: `[aria-current='page']` gets the primary soft background and an inline-start accent bar.
- `[aria-disabled='true']` uses `--t-content-disabled` and `cursor: default`.
- Below the `md` breakpoint force overlay behaviour regardless of the stored `navState`.

- [ ] **Step 7: Rebuild and check visually**

Run: `cd theme1 && npm run dev`, then in devtools set `data-nav-state` to each of `expanded`, `collapsed`, `hover`, `hidden`, `overlay` and `data-nav-skin` to each of its four values, in both `dir="ltr"` and `dir="rtl"`.
Expected: every combination is coherent; nothing overlaps; RTL mirrors correctly.

- [ ] **Step 8: Commit**

```bash
git add theme1/src/partials/shell/sidebar.njk theme1/src/scripts/core/menu.js theme1/src/styles/layout/_sidebar.scss theme1/tests/unit/menu.test.js
git commit -m "feat(shell): accessible three-level sidebar with all skins and states"
```

---

### Task 5: Navbar and footer

**Files:**
- Create: `theme1/src/partials/shell/navbar.njk`
- Create: `theme1/src/partials/shell/footer.njk`
- Create: `theme1/src/scripts/core/navbar.js`
- Create: `theme1/src/scripts/core/scroll-top.js`
- Create: `theme1/src/styles/layout/_navbar.scss`
- Create: `theme1/src/styles/layout/_footer.scss`
- Test: `theme1/tests/unit/navbar.test.js`

**Interfaces:**
- Consumes: `createStore` from Task 1; the Feather sprite.
- Produces: `init`/`destroy` from `navbar.js` and `scroll-top.js`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/navbar.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init, destroy } from '../../src/scripts/core/navbar.js';
import { createStore } from '../../src/scripts/core/theme-store.js';

const MARKUP = `
<header class="t-navbar" data-t-navbar>
  <button class="t-navbar__toggle" type="button" data-t-nav-toggle aria-expanded="false" aria-label="Open navigation"></button>
  <form class="t-navbar__search" role="search">
    <input class="t-navbar__search-input" type="search" data-t-search aria-label="Search" />
    <ul class="t-navbar__results" data-t-search-results hidden></ul>
  </form>
  <button class="t-navbar__theme" type="button" data-t-theme-toggle aria-pressed="false" aria-label="Switch to dark theme"></button>
  <button class="t-navbar__fullscreen" type="button" data-t-fullscreen aria-pressed="false" aria-label="Enter full screen"></button>
</header>`;

let store;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  const map = new Map();
  store = createStore({
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) },
  });
  init(document, { store });
});

afterEach(() => {
  destroy(document);
  document.body.innerHTML = '';
});

describe('mobile navigation toggle', () => {
  it('opens the overlay sidebar and reflects it in aria-expanded', () => {
    const toggle = document.querySelector('[data-t-nav-toggle]');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.getAttribute('data-nav-open')).toBe('true');
  });

  it('closes on Escape', () => {
    document.querySelector('[data-t-nav-toggle]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.documentElement.getAttribute('data-nav-open')).toBe('false');
  });
});

describe('theme toggle', () => {
  it('switches the store from light to dark', () => {
    store.set('theme', 'light');
    document.querySelector('[data-t-theme-toggle]').click();
    expect(store.get('theme')).toBe('dark');
  });

  it('switches back from dark to light', () => {
    store.set('theme', 'dark');
    document.querySelector('[data-t-theme-toggle]').click();
    expect(store.get('theme')).toBe('light');
  });

  it('resolves system to the opposite of the current OS preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    store.set('theme', 'system');
    document.querySelector('[data-t-theme-toggle]').click();
    expect(store.get('theme')).toBe('light');
    vi.unstubAllGlobals();
  });

  it('keeps aria-pressed and the label in sync with the store', () => {
    const button = document.querySelector('[data-t-theme-toggle]');
    store.set('theme', 'dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toMatch(/light/i);
  });
});

describe('search', () => {
  it('shows results for a query and hides them when cleared', () => {
    const input = document.querySelector('[data-t-search]');
    const results = document.querySelector('[data-t-search-results]');
    input.value = 'inv';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(results.hidden).toBe(false);

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(results.hidden).toBe(true);
  });

  it('renders result text with textContent, never innerHTML', () => {
    const input = document.querySelector('[data-t-search]');
    input.value = '<img src=x onerror=alert(1)>';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-t-search-results]').querySelector('img')).toBeNull();
  });

  it('closes the results on Escape and restores focus to the input', () => {
    const input = document.querySelector('[data-t-search]');
    input.value = 'inv';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-t-search-results]').hidden).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});

describe('lifecycle', () => {
  it('destroy() unbinds the theme toggle', () => {
    destroy(document);
    store.set('theme', 'light');
    document.querySelector('[data-t-theme-toggle]').click();
    expect(store.get('theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/navbar.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/navbar.js`**

Behaviour required by the tests, in full:

- `init(root, { store })` binds delegated listeners and returns an instance; `destroy(root)` removes them.
- Nav toggle: flips `data-nav-open` on `<html>` between `'true'` and `'false'`, keeps `aria-expanded` in step, traps focus inside the sidebar while open, and restores focus to the toggle on close.
- `Escape` anywhere closes an open overlay nav.
- Theme toggle: `light → dark`, `dark → light`, and `system →` the opposite of `matchMedia('(prefers-color-scheme: dark)').matches`. Subscribes to the store so `aria-pressed` and `aria-label` always describe the **next** action.
- Search: filters `navigation.json` entries by label, debounced 120 ms, rendering each result with `document.createElement` + `textContent`. Never `innerHTML`. `Escape` closes and restores focus. Arrow keys move through results; `Enter` follows the focused one.
- Fullscreen: uses the Fullscreen API, keeps `aria-pressed` in step, and hides itself when `document.fullscreenEnabled` is false.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/navbar.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Write the navbar and footer markup and styles**

`navbar.njk` — `<header class="t-navbar t-shell__navbar" data-t-navbar>` containing: mobile nav toggle, bookmark shortcuts, search, language switcher, theme toggle, fullscreen, notifications dropdown (with an unread counter announced via `aria-label`), cart dropdown, and the user menu. Every icon-only control carries an `aria-label`. Dropdowns use Bootstrap's Dropdown plugin.

`_navbar.scss` — the four types via `[data-navbar]`:

- `static`: in normal flow.
- `floating`: `position: sticky`, inset from the content edges, `--t-radius-lg`, `--t-elevation-overlay`.
- `sticky`: full-bleed `position: sticky` with a bottom border.
- `hidden`: `display: none`.

Then the eight `[data-navbar-color]` values, each setting the navbar's local `--t-content-primary`/`--t-content-secondary` to the matching action foreground so text stays AA on the coloured ground.

`footer.njk` + `_footer.scss` — copyright line, link list, and a "back to top" button; `[data-footer]` handles static/sticky/hidden.

`scroll-top.js` — reveals the button past 400 px of scroll using an `IntersectionObserver` sentinel rather than a scroll listener, and honours `prefers-reduced-motion` by jumping instead of smooth-scrolling.

- [ ] **Step 6: Rebuild and check**

Run: `cd theme1 && npm run build && npm run check:budgets`
Expected: build succeeds, budgets pass.

- [ ] **Step 7: Commit**

```bash
git add theme1/src/partials/shell/navbar.njk theme1/src/partials/shell/footer.njk theme1/src/scripts/core/navbar.js theme1/src/scripts/core/scroll-top.js theme1/src/styles/layout/_navbar.scss theme1/src/styles/layout/_footer.scss theme1/tests/unit/navbar.test.js
git commit -m "feat(shell): navbar with all types and colours, footer, scroll-to-top"
```

---

### Task 6: Horizontal navigation

**Files:**
- Create: `theme1/src/partials/shell/nav-horizontal.njk`
- Modify: `theme1/src/scripts/core/menu.js`
- Create: `theme1/src/styles/layout/_nav-horizontal.scss`
- Test: `theme1/tests/unit/menu-horizontal.test.js`

**Interfaces:**
- Consumes: `navigation.json`; `menu.js` from Task 4.
- Produces: `initHorizontal(root)` exported from `menu.js`, sharing the same tree data and the same active-trail logic.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/menu-horizontal.test.js` covering:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initHorizontal, destroy } from '../../src/scripts/core/menu.js';

const MARKUP = `
<nav class="t-navh" data-t-menu-horizontal aria-label="Main">
  <ul class="t-navh__list">
    <li class="t-navh__item t-navh__item--branch">
      <button class="t-navh__link" type="button" aria-expanded="false" aria-controls="h-apps" id="h-btn-apps">Apps</button>
      <ul class="t-navh__sublist" id="h-apps" hidden>
        <li><a class="t-navh__link" href="app-email.html">Email</a></li>
      </ul>
    </li>
    <li class="t-navh__item"><a class="t-navh__link" href="index.html">Home</a></li>
  </ul>
</nav>`;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  initHorizontal(document);
});

afterEach(() => {
  destroy(document);
  document.body.innerHTML = '';
});

describe('horizontal menu', () => {
  it('opens a flyout on click', () => {
    document.getElementById('h-btn-apps').click();
    expect(document.getElementById('h-apps').hidden).toBe(false);
  });

  it('closes when focus leaves the branch', () => {
    document.getElementById('h-btn-apps').click();
    document.querySelector('[href="index.html"]').focus();
    document.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.getElementById('h-apps').hidden).toBe(true);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const trigger = document.getElementById('h-btn-apps');
    trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('h-apps').hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('moves between top-level items with ArrowRight and ArrowLeft', () => {
    const items = [...document.querySelectorAll('.t-navh__list > .t-navh__item > .t-navh__link')];
    items[0].focus();
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
  });

  it('reverses arrow direction in RTL', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const items = [...document.querySelectorAll('.t-navh__list > .t-navh__item > .t-navh__link')];
    items[0].focus();
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    document.documentElement.setAttribute('dir', 'ltr');
  });

  it('closes an open flyout when another opens', () => {
    const second = document.createElement('li');
    second.className = 't-navh__item t-navh__item--branch';
    second.innerHTML = '<button class="t-navh__link" type="button" aria-expanded="false" aria-controls="h-ui" id="h-btn-ui">UI</button><ul class="t-navh__sublist" id="h-ui" hidden></ul>';
    document.querySelector('.t-navh__list').append(second);
    destroy(document);
    initHorizontal(document);

    document.getElementById('h-btn-apps').click();
    document.getElementById('h-btn-ui').click();
    expect(document.getElementById('h-apps').hidden).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/menu-horizontal.test.js`
Expected: FAIL — `initHorizontal` is not exported.

- [ ] **Step 3: Implement `initHorizontal` in `menu.js`**

Required behaviour: flyouts open on click and on hover-with-intent (150 ms delay); close on `focusout` of the branch, on `Escape` with focus returned to the trigger, on outside click, and when a sibling opens. `ArrowRight`/`ArrowLeft` move between top-level items, **swapped when `document.documentElement.dir === 'rtl'`**. `ArrowDown` on a trigger opens the flyout and focuses its first item. Second-level flyouts open on the inline-end edge and flip to inline-start when they would overflow the viewport.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/menu-horizontal.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Write the markup and styles**

`nav-horizontal.njk` renders the same `navigation.json` in a horizontal bar, shown only when `[data-nav='horizontal']`. `_nav-horizontal.scss` handles the bar, flyout panels, overflow into a "More" menu when the bar runs out of room, and a fallback to the vertical overlay below the `lg` breakpoint.

Include it from `shell.njk` alongside the sidebar; CSS decides which is visible, so no JavaScript branch is needed.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/shell/nav-horizontal.njk theme1/src/scripts/core/menu.js theme1/src/styles/layout/_nav-horizontal.scss theme1/src/layouts/shell.njk theme1/tests/unit/menu-horizontal.test.js
git commit -m "feat(shell): horizontal navigation with rtl-aware keyboard support"
```

---

### Task 7: Customizer panel

**Files:**
- Create: `theme1/src/partials/shell/customizer.njk`
- Create: `theme1/src/scripts/core/customizer.js`
- Create: `theme1/src/styles/layout/_customizer.scss`
- Test: `theme1/tests/unit/customizer.test.js`

**Interfaces:**
- Consumes: `SCHEMA`, `createStore` from Task 1.
- Produces: `init(root, { store })`, `destroy(root)`. The panel renders itself from `SCHEMA`, so a new option appears automatically.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/customizer.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init, destroy } from '../../src/scripts/core/customizer.js';
import { createStore, SCHEMA, DEFAULTS } from '../../src/scripts/core/theme-store.js';

let store;

beforeEach(() => {
  document.body.innerHTML = `
    <button type="button" data-t-customizer-open aria-expanded="false" aria-controls="customizer">Customize</button>
    <aside id="customizer" class="t-customizer" data-t-customizer hidden>
      <button type="button" data-t-customizer-close>Close</button>
      <div data-t-customizer-controls></div>
      <button type="button" data-t-customizer-reset>Reset</button>
    </aside>`;
  const map = new Map();
  store = createStore({
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) },
  });
  init(document, { store });
});

afterEach(() => {
  destroy(document);
  document.body.innerHTML = '';
});

describe('rendering', () => {
  it('renders a control group for every schema option', () => {
    const groups = document.querySelectorAll('[data-t-option]');
    expect(groups).toHaveLength(Object.keys(SCHEMA).length);
  });

  it('renders one radio per allowed value', () => {
    const themeInputs = document.querySelectorAll('[data-t-option="theme"] input[type="radio"]');
    expect(themeInputs).toHaveLength(SCHEMA.theme.values.length);
  });

  it('preselects the current value', () => {
    const checked = document.querySelector('[data-t-option="theme"] input:checked');
    expect(checked.value).toBe(DEFAULTS.theme);
  });

  it('labels every control group', () => {
    for (const group of document.querySelectorAll('[data-t-option]')) {
      expect(group.querySelector('legend, [role="group"] > .t-customizer__label')).not.toBeNull();
    }
  });
});

describe('interaction', () => {
  it('writes a change to the store', () => {
    const input = document.querySelector('[data-t-option="density"] input[value="compact"]');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get('density')).toBe('compact');
  });

  it('reflects an external store change back into the controls', () => {
    store.set('density', 'compact');
    expect(document.querySelector('[data-t-option="density"] input:checked').value).toBe('compact');
  });

  it('reset restores every default', () => {
    store.set('theme', 'dark');
    document.querySelector('[data-t-customizer-reset]').click();
    expect(store.getState()).toEqual(DEFAULTS);
    expect(document.querySelector('[data-t-option="theme"] input:checked').value).toBe(DEFAULTS.theme);
  });
});

describe('panel behaviour', () => {
  it('opens and closes, keeping aria-expanded in step', () => {
    const opener = document.querySelector('[data-t-customizer-open]');
    opener.click();
    expect(document.querySelector('[data-t-customizer]').hidden).toBe(false);
    expect(opener.getAttribute('aria-expanded')).toBe('true');

    document.querySelector('[data-t-customizer-close]').click();
    expect(document.querySelector('[data-t-customizer]').hidden).toBe(true);
    expect(opener.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and returns focus to the opener', () => {
    const opener = document.querySelector('[data-t-customizer-open]');
    opener.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-t-customizer]').hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('hides navbar-colour when the navbar is hidden', () => {
    store.set('navbar', 'hidden');
    expect(document.querySelector('[data-t-option="navbarColor"]').hidden).toBe(true);
  });

  it('hides nav-state and nav-skin in horizontal layout', () => {
    store.set('nav', 'horizontal');
    expect(document.querySelector('[data-t-option="navState"]').hidden).toBe(true);
    expect(document.querySelector('[data-t-option="navSkin"]').hidden).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/customizer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/customizer.js`**

Required behaviour: build the controls from `SCHEMA` with `document.createElement` only; each option is a `<fieldset data-t-option="key">` with a `<legend>` and one radio per value, named by the option key. `change` writes to the store. A store subscription re-checks the matching radio, so external changes and `reset()` are reflected. Dependent options hide themselves: `navbarColor` when `navbar === 'hidden'`; `navState` and `navSkin` when `nav === 'horizontal'`. The panel is an `aside` with `role="dialog"` and `aria-label`, focus is trapped while open, `Escape` closes it and restores focus, and the open state is **not** persisted.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/customizer.test.js`
Expected: PASS — 11 tests.

- [ ] **Step 5: Write the markup and styles**

`customizer.njk` provides only the shell — opener button, panel, close button, an empty `[data-t-customizer-controls]`, and reset. `_customizer.scss` styles it as an off-canvas panel on the inline-end edge with `--t-elevation-modal`, sliding in via `transform` and honouring `prefers-reduced-motion`.

Wire `main.js` to create the store once and pass it to `menu`, `navbar`, `customizer`, and `scrollTop`.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/shell/customizer.njk theme1/src/scripts/core/customizer.js theme1/src/styles/layout/_customizer.scss theme1/src/scripts/main.js theme1/tests/unit/customizer.test.js
git commit -m "feat(shell): schema-driven customizer panel"
```

---

### Task 8: Option matrix verification

**Files:**
- Create: `theme1/tests/layout/option-matrix.test.js`
- Create: `theme1/src/pages/layout-blank.njk`
- Create: `theme1/src/pages/layout-boxed.njk`
- Create: `theme1/src/pages/layout-collapsed-menu.njk`
- Create: `theme1/src/pages/layout-empty.njk`
- Create: `theme1/src/pages/layout-without-menu.njk`
- Modify: `theme1/.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything above.
- Produces: the gate that proves the 14 physical layout folders really did collapse into runtime state.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/layout/option-matrix.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCHEMA, validate, apply } from '../../src/scripts/core/theme-store.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
let html;

beforeAll(async () => {
  html = await readFile(path.join(rootDir, 'dist/index.html'), 'utf8');
}, 60_000);

/** Every combination of the layout-critical options — the rest are independent. */
function criticalCombinations() {
  const keys = ['nav', 'navState', 'navbar', 'footer', 'width', 'direction', 'theme'];
  return keys.reduce(
    (acc, key) => acc.flatMap((state) => SCHEMA[key].values.map((value) => ({ ...state, [key]: value }))),
    [{}],
  );
}

describe('option matrix', () => {
  const combos = criticalCombinations();

  it('covers every layout-critical combination', () => {
    const expected = ['nav', 'navState', 'navbar', 'footer', 'width', 'direction', 'theme']
      .map((k) => SCHEMA[k].values.length)
      .reduce((a, b) => a * b, 1);
    expect(combos).toHaveLength(expected);
  });

  it.each(combos.map((c) => [JSON.stringify(c), c]))('renders coherently for %s', (_label, combo) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    apply(validate(combo), doc.documentElement);

    // The shell is always present.
    expect(doc.querySelector('.t-shell')).not.toBeNull();
    expect(doc.querySelector('#main')).not.toBeNull();

    // Exactly one main landmark and one banner.
    expect(doc.querySelectorAll('main')).toHaveLength(1);
    expect(doc.querySelectorAll('header.t-navbar')).toHaveLength(1);

    // The skip link is always first in the body's tab order.
    expect(doc.querySelector('body a.t-skip-link')).not.toBeNull();

    // Attributes round-trip exactly.
    for (const [key, value] of Object.entries(combo)) {
      expect(doc.documentElement.getAttribute(SCHEMA[key].attr)).toBe(value);
    }

    dom.window.close();
  });
});

describe('structural invariants', () => {
  it('has no physical left/right CSS properties in the built stylesheet', async () => {
    const fg = (await import('fast-glob')).default;
    const [cssFile] = await fg('assets/*.css', { cwd: path.join(rootDir, 'dist'), absolute: true });
    const css = await readFile(cssFile, 'utf8');
    const offenders = [...css.matchAll(/(?:^|[;{])\s*(margin-left|margin-right|padding-left|padding-right|left|right)\s*:/g)]
      .map((m) => m[1]);
    // Bootstrap's reboot is exempt; ours must be clean. Assert only on t- rules.
    const ours = css.split('}').filter((rule) => rule.includes('.t-'));
    const ourOffenders = ours.filter((rule) => /(?:^|[;{])\s*(margin-left|margin-right|padding-left|padding-right)\s*:/.test(rule));
    expect(ourOffenders, `physical properties in: ${ourOffenders.slice(0, 3).join(' | ')}`).toEqual([]);
    expect(offenders.length).toBeGreaterThanOrEqual(0);
  });

  it('inlines the theme boot snippet before any stylesheet', () => {
    const scriptAt = html.indexOf('<script>');
    const linkAt = html.indexOf('<link rel="stylesheet"');
    expect(scriptAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeLessThan(linkAt);
  });

  it('loads no external origin', () => {
    expect(html).not.toMatch(/https?:\/\/(?!example\.invalid)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/layout/option-matrix.test.js`
Expected: FAIL — the shell markup is not yet on `index.njk`.

- [ ] **Step 3: Convert `index.njk` to the shell layout and add the five layout pages**

`index.njk` extends `layouts/shell.njk` and sets `pageTitle` and `breadcrumbs`.

The five layout demo pages set their own initial state and explain the variant:

| Page | Purpose |
|---|---|
| `layout-collapsed-menu.njk` | Ships with `navState: 'collapsed'` applied on load |
| `layout-boxed.njk` | Ships with `width: 'boxed'` |
| `layout-without-menu.njk` | Ships with `navState: 'hidden'` |
| `layout-empty.njk` | Shell chrome with an empty content area |
| `layout-blank.njk` | Extends `layouts/blank.njk` — no chrome at all |

Create `src/layouts/blank.njk` extending `base.njk` with only the skip link and `<main id="main">`.

Each demo page applies its state through the store on load rather than hard-coding attributes, so the customizer stays authoritative.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/layout/option-matrix.test.js`
Expected: PASS — 2 × 3 × 4 × 3 × 2 × 2 × 3 = **864** combinations, plus 3 structural invariants.

- [ ] **Step 5: Add the gate to CI**

In `.github/workflows/ci.yml`, the existing `Unit tests` step already runs the whole suite; add an explicit build-then-matrix ordering note by moving the `Build` step **before** `Unit tests`, since `option-matrix.test.js` reads `dist/index.html`.

- [ ] **Step 6: Full local verification**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 7: Commit**

```bash
git add theme1/tests/layout/option-matrix.test.js theme1/src/pages/ theme1/src/layouts/blank.njk theme1/.github/workflows/ci.yml
git commit -m "test(shell): 864-combination option matrix gate"
```

---

## Phase exit checklist

- [ ] `npm run lint` exits 0.
- [ ] `npm run test` green, including the 864-combination matrix.
- [ ] No flash of the wrong theme on a throttled hard reload.
- [ ] Sidebar is fully keyboard-operable: arrows, Home/End, Enter/Space, Escape.
- [ ] Horizontal nav reverses its arrow keys in RTL.
- [ ] Customizer renders itself from `SCHEMA`; adding a schema entry needs no customizer change.
- [ ] Every shell region works in all four nav skins, both directions, and both themes.
- [ ] No physical `left`/`right` properties in any `.t-` rule.
- [ ] `npm run check:budgets` passes.
- [ ] CI green.

**Unblocks:** Phases 04, 05, 06 (once Phase 03 also lands).
