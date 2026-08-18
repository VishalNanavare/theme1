# Phase 03 — Core Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the component library — the icon sprite, the auto-init runtime, ~35 base components with every variant and state from spec §7, and a style guide page that documents and a11y-tests all of them.

**Architecture:** Every component is a Nunjucks macro (markup), an SCSS partial (styling from tier-3 tokens), and — where it needs behaviour — an ES module exporting `init`/`destroy`/`defaults`. A single delegated scanner discovers `data-t-*` hooks, so markup injected after load initialises itself. Bootstrap's JS plugins are wrapped in thin adapters rather than called directly, so the rest of the theme depends on our interface, not theirs.

**Tech Stack:** Nunjucks macros · SCSS · vanilla ES modules · Bootstrap 5.3 JS plugins · Feather icons (MIT) · Vitest + jsdom · axe-core

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports via `src/styles/bootstrap/_config.scss`; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.** Physical `left`/`right` are a lint error.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **Fonts self-hosted.** Inter (SIL OFL) only.
- **Icons: Feather (MIT) only**, as one SVG sprite.
- **No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Component contract

Every component in this phase satisfies all of the following, and the style guide test proves it:

1. **Markup** — a Nunjucks macro in `src/partials/ui/<name>.njk`, exported with a camelCase name.
2. **Styling** — `src/styles/components/_<name>.scss`, referencing tier-2 and tier-3 tokens only. No raw hex, no raw px outside a token.
3. **Behaviour** (if interactive) — `src/scripts/components/<name>.js` exporting `NAME`, `init(root)`, `destroy(root)`, `defaults`.
4. **States** — default, hover, focus-visible, active, disabled, and where applicable loading, error, empty, selected.
5. **Themes** — correct in light and dark, both densities, both directions.
6. **A11y** — correct role, name, and keyboard operation; `axe` clean.
7. **Docs** — a section on the style guide page showing every variant.

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/icon-sprite.mjs` | Builds one SVG sprite from Feather |
| `src/scripts/core/registry.js` | `register()` + `scan()` auto-init runtime |
| `src/scripts/core/focus-trap.js` | Shared focus trapping for overlays |
| `src/scripts/vendor/bs.js` | Thin adapters over Bootstrap's JS plugins |
| `src/partials/ui/*.njk` | One macro file per component |
| `src/styles/components/*.scss` | One partial per component |
| `src/scripts/components/*.js` | One module per interactive component |
| `src/pages/ui-components.njk` | The style guide |
| `tests/unit/components/*.test.js` | Per-component behaviour |
| `tests/a11y/style-guide.test.js` | axe over the built style guide |

---

### Task 1: Icon sprite

**Files:**
- Create: `theme1/scripts/icon-sprite.mjs`
- Create: `theme1/src/partials/ui/icon.njk`
- Create: `theme1/src/styles/components/_icon.scss`
- Modify: `theme1/package.json`, `theme1/vite.config.js`
- Test: `theme1/tests/unit/icon-sprite.test.js`

**Interfaces:**
- Consumes: the `feather-icons` package (MIT), added as a **dev** dependency — only its SVG data is used, none of its runtime.
- Produces:
  - `ICON_SET: string[]` — the icon names the theme uses
  - `buildSprite(icons: Record<string,string>, names: string[]) => string` — the `<svg><symbol>…` sprite
  - `symbolId(name: string) => string` → `feather-<name>`
  - A macro `icon(name, opts)` in `icon.njk`
  - `dist/assets/icons.svg`, injected inline into every page

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/icon-sprite.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSprite, symbolId, ICON_SET } from '../../scripts/icon-sprite.mjs';

const FAKE = {
  home: '<path d="M1 1"/>',
  search: '<circle cx="5" cy="5" r="4"/>',
  unused: '<path d="M2 2"/>',
};

describe('symbolId', () => {
  it('namespaces the icon name', () => {
    expect(symbolId('home')).toBe('feather-home');
  });
});

describe('ICON_SET', () => {
  it('is a non-empty list of unique, kebab-case names', () => {
    expect(ICON_SET.length).toBeGreaterThan(0);
    expect(new Set(ICON_SET).size).toBe(ICON_SET.length);
    for (const name of ICON_SET) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('buildSprite', () => {
  it('emits one symbol per requested icon', () => {
    const sprite = buildSprite(FAKE, ['home', 'search']);
    expect(sprite.match(/<symbol/g)).toHaveLength(2);
    expect(sprite).toContain('id="feather-home"');
    expect(sprite).toContain('id="feather-search"');
  });

  it('omits icons that were not requested', () => {
    expect(buildSprite(FAKE, ['home'])).not.toContain('feather-unused');
  });

  it('throws when a requested icon is missing, rather than emitting a blank symbol', () => {
    expect(() => buildSprite(FAKE, ['nope'])).toThrow(/nope/);
  });

  it('hides the sprite from layout and from assistive technology', () => {
    const sprite = buildSprite(FAKE, ['home']);
    expect(sprite).toMatch(/aria-hidden="true"/);
    expect(sprite).toMatch(/display:\s*none/);
  });

  it('gives every symbol the viewBox so it scales', () => {
    expect(buildSprite(FAKE, ['home'])).toContain('viewBox="0 0 24 24"');
  });

  it('uses currentColor so icons inherit text colour in both themes', () => {
    expect(buildSprite(FAKE, ['home'])).toContain('stroke="currentColor"');
  });

  it('produces deterministic output for a stable name order', () => {
    expect(buildSprite(FAKE, ['home', 'search'])).toBe(buildSprite(FAKE, ['home', 'search']));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/icon-sprite.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the dependency and write `scripts/icon-sprite.mjs`**

Run: `cd theme1 && npm install --save-dev feather-icons`

```js
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

/**
 * Every icon the theme uses. Keep this list explicit: it is the difference
 * between a 12 KB sprite and shipping all 280 Feather icons on every page.
 * Add a name here when a component or page needs it.
 */
export const ICON_SET = [
  // shell
  'menu', 'x', 'search', 'bell', 'settings', 'sun', 'moon', 'maximize', 'minimize',
  'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'chevron-right', 'more-vertical', 'more-horizontal',
  'log-out', 'user', 'users', 'globe', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  // status
  'check', 'check-circle', 'alert-circle', 'alert-triangle', 'info', 'x-circle', 'help-circle',
  // actions
  'plus', 'minus', 'edit-2', 'trash-2', 'copy', 'download', 'upload', 'refresh-cw', 'filter',
  'eye', 'eye-off', 'save', 'send', 'printer', 'share-2', 'external-link', 'link',
  // objects
  'home', 'grid', 'list', 'calendar', 'mail', 'message-square', 'file', 'file-text', 'folder',
  'shopping-bag', 'shopping-cart', 'credit-card', 'package', 'truck', 'tag', 'bookmark', 'star',
  'heart', 'clock', 'map-pin', 'phone', 'camera', 'image', 'video', 'music', 'paperclip',
  'bar-chart-2', 'pie-chart', 'trending-up', 'trending-down', 'activity', 'database', 'server',
  'lock', 'unlock', 'shield', 'key', 'book-open', 'award', 'gift', 'zap', 'coffee', 'cpu',
  'toggle-left', 'sliders', 'columns', 'layout', 'sidebar', 'move', 'maximize-2', 'corner-down-right',
];

export const symbolId = (name) => `feather-${name}`;

/** Build one SVG sprite containing exactly the requested icons. */
export function buildSprite(icons, names) {
  const unique = [...new Set(names)];
  const symbols = unique.map((name) => {
    const body = icons[name];
    if (!body) throw new Error(`Unknown icon: ${name}. Add it to ICON_SET only if Feather provides it.`);
    return `<symbol id="${symbolId(name)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="display: none;">${symbols.join('')}</svg>`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { icons } = await import('feather-icons');
  const contents = Object.fromEntries(Object.entries(icons).map(([name, icon]) => [name, icon.contents]));

  const sprite = buildSprite(contents, ICON_SET);
  const outDir = path.join(process.cwd(), 'src/generated');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'icons.svg'), sprite, 'utf8');

  console.log(`sprite: ${ICON_SET.length} icons, ${(sprite.length / 1024).toFixed(1)} KB`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/icon-sprite.test.js`
Expected: PASS — 9 tests. Note the duplicate `'chevron-right'` in `ICON_SET` is harmless because `buildSprite` de-duplicates, but remove it anyway.

- [ ] **Step 5: Generate and inline the sprite**

Add to `package.json`: `"icons": "node scripts/icon-sprite.mjs"`, and make `build` run it first: `"build": "npm run icons && vite build"`.

Add `src/generated/` to `.gitignore`.

Extend `scripts/vite-plugin-theme-boot.mjs` — or add a sibling plugin — to replace an `<!--icon-sprite-->` marker placed as the first child of `<body>` in `base.njk` with the sprite contents. Inlining beats a separate request: it is small, it is needed immediately, and `<use href="external.svg#id">` is blocked cross-origin and unreliable in Safari.

- [ ] **Step 6: Write the icon macro and styles**

`src/partials/ui/icon.njk`:

```njk
{% macro icon(name, opts = {}) %}
<svg class="t-icon {{ opts.class | default('') }}"
     {% if opts.size %}style="--t-icon-size: {{ opts.size }}"{% endif %}
     {% if opts.label %}role="img" aria-label="{{ opts.label }}"{% else %}aria-hidden="true" focusable="false"{% endif %}>
  <use href="#feather-{{ name }}"></use>
</svg>
{% endmacro %}
```

`src/styles/components/_icon.scss`:

```scss
.t-icon {
  --t-icon-size: 1.25em;

  display: inline-block;
  flex: none;
  inline-size: var(--t-icon-size);
  block-size: var(--t-icon-size);
  vertical-align: -0.15em;
}

// Icons that imply direction must mirror in RTL. Clocks, media controls and
// logos must not, so this is opt-in per icon rather than blanket.
[dir='rtl'] .t-icon--directional {
  transform: scaleX(-1);
}
```

- [ ] **Step 7: Commit**

```bash
git add theme1/scripts/icon-sprite.mjs theme1/src/partials/ui/icon.njk theme1/src/styles/components/_icon.scss theme1/package.json theme1/.gitignore theme1/vite.config.js theme1/src/layouts/base.njk theme1/tests/unit/icon-sprite.test.js
git commit -m "feat(ui): inline feather icon sprite"
```

---

### Task 2: Component registry and shared helpers

**Files:**
- Create: `theme1/src/scripts/core/registry.js`
- Create: `theme1/src/scripts/core/focus-trap.js`
- Create: `theme1/src/scripts/vendor/bs.js`
- Test: `theme1/tests/unit/registry.test.js`
- Test: `theme1/tests/unit/focus-trap.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `register(name: string, module: { init, destroy })` — throws on a duplicate name
  - `scan(root = document) => void` — initialises every registered component inside `root`, skipping already-initialised nodes
  - `teardown(root = document) => void`
  - `observe(root = document) => MutationObserver` — auto-scans nodes added later
  - `getFocusable(container) => HTMLElement[]`
  - `trapFocus(container, { onEscape, returnFocusTo }) => () => void` — returns a release function

- [ ] **Step 1: Write the failing tests**

Create `theme1/tests/unit/registry.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { register, scan, teardown, observe, _reset } from '../../src/scripts/core/registry.js';

beforeEach(() => {
  _reset();
  document.body.innerHTML = '';
});

describe('register', () => {
  it('rejects a duplicate name so components cannot silently shadow each other', () => {
    register('demo', { init() {}, destroy() {} });
    expect(() => register('demo', { init() {}, destroy() {} })).toThrow(/demo/);
  });

  it('rejects a module missing init or destroy', () => {
    expect(() => register('bad', { init() {} })).toThrow(/destroy/);
    expect(() => register('bad2', { destroy() {} })).toThrow(/init/);
  });
});

describe('scan', () => {
  it('initialises each registered component once per root', () => {
    const init = vi.fn();
    register('demo', { init, destroy() {} });
    document.body.innerHTML = '<div data-t-demo></div>';
    scan(document);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not re-initialise on a second scan', () => {
    const init = vi.fn();
    register('demo', { init, destroy() {} });
    document.body.innerHTML = '<div data-t-demo></div>';
    scan(document);
    scan(document);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('initialises components added after the first scan', () => {
    const init = vi.fn();
    register('demo', { init, destroy() {} });
    scan(document);
    document.body.innerHTML = '<div data-t-demo></div>';
    scan(document);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not let one component throwing stop the others', () => {
    const good = vi.fn();
    register('boom', { init() { throw new Error('nope'); }, destroy() {} });
    register('good', { init: good, destroy() {} });
    document.body.innerHTML = '<div data-t-boom></div><div data-t-good></div>';
    expect(() => scan(document)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('skips a subtree marked data-t-ignore', () => {
    const init = vi.fn();
    register('demo', { init, destroy() {} });
    document.body.innerHTML = '<div data-t-ignore><div data-t-demo></div></div>';
    scan(document);
    expect(init).not.toHaveBeenCalled();
  });
});

describe('teardown', () => {
  it('calls destroy and allows a later re-init', () => {
    const init = vi.fn();
    const destroy = vi.fn();
    register('demo', { init, destroy });
    document.body.innerHTML = '<div data-t-demo></div>';
    scan(document);
    teardown(document);
    expect(destroy).toHaveBeenCalledTimes(1);
    scan(document);
    expect(init).toHaveBeenCalledTimes(2);
  });
});

describe('observe', () => {
  it('initialises nodes inserted later', async () => {
    const init = vi.fn();
    register('demo', { init, destroy() {} });
    const observer = observe(document.body);
    document.body.append(Object.assign(document.createElement('div'), { dataset: { tDemo: '' } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(init).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});
```

Create `theme1/tests/unit/focus-trap.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFocusable, trapFocus } from '../../src/scripts/core/focus-trap.js';

beforeEach(() => {
  document.body.innerHTML = `
    <button id="outside">outside</button>
    <div id="panel">
      <button id="first">first</button>
      <a id="link" href="#x">link</a>
      <input id="input" />
      <button id="hidden" hidden>hidden</button>
      <button id="disabled" disabled>disabled</button>
      <button id="last">last</button>
    </div>`;
});

describe('getFocusable', () => {
  it('finds focusable elements in document order', () => {
    expect(getFocusable(document.getElementById('panel')).map((el) => el.id)).toEqual(['first', 'link', 'input', 'last']);
  });

  it('excludes hidden and disabled elements', () => {
    const ids = getFocusable(document.getElementById('panel')).map((el) => el.id);
    expect(ids).not.toContain('hidden');
    expect(ids).not.toContain('disabled');
  });

  it('excludes elements with tabindex="-1"', () => {
    document.getElementById('link').tabIndex = -1;
    expect(getFocusable(document.getElementById('panel')).map((el) => el.id)).not.toContain('link');
  });

  it('returns an empty array for a container with nothing focusable', () => {
    document.body.innerHTML = '<div id="empty"><span>text</span></div>';
    expect(getFocusable(document.getElementById('empty'))).toEqual([]);
  });
});

describe('trapFocus', () => {
  it('moves focus to the first focusable element', () => {
    trapFocus(document.getElementById('panel'));
    expect(document.activeElement.id).toBe('first');
  });

  it('wraps Tab from the last element to the first', () => {
    trapFocus(document.getElementById('panel'));
    document.getElementById('last').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.id).toBe('first');
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    trapFocus(document.getElementById('panel'));
    document.getElementById('first').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement.id).toBe('last');
  });

  it('calls onEscape', () => {
    const onEscape = vi.fn();
    trapFocus(document.getElementById('panel'), { onEscape });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to returnFocusTo when released', () => {
    const outside = document.getElementById('outside');
    const release = trapFocus(document.getElementById('panel'), { returnFocusTo: outside });
    release();
    expect(document.activeElement).toBe(outside);
  });

  it('stops trapping once released', () => {
    const release = trapFocus(document.getElementById('panel'));
    release();
    document.getElementById('outside').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.id).toBe('outside');
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/registry.test.js tests/unit/focus-trap.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/scripts/core/registry.js`**

```js
const registry = new Map();
const initialised = new WeakMap();

/** Test-only hook: clear the registry between cases. */
export function _reset() {
  registry.clear();
}

export function register(name, module) {
  if (registry.has(name)) throw new Error(`Component "${name}" is already registered.`);
  if (typeof module?.init !== 'function') throw new Error(`Component "${name}" must export init().`);
  if (typeof module?.destroy !== 'function') throw new Error(`Component "${name}" must export destroy().`);
  registry.set(name, module);
}

const attrFor = (name) => `data-t-${name}`;

function targets(root, name) {
  const selector = `[${attrFor(name)}]`;
  const found = [...root.querySelectorAll(selector)];
  if (root.matches?.(selector)) found.unshift(root);
  return found.filter((el) => !el.closest('[data-t-ignore]'));
}

/** Initialise every registered component inside root. Idempotent per element. */
export function scan(root = document) {
  for (const [name, module] of registry) {
    for (const el of targets(root, name)) {
      const done = initialised.get(el) ?? new Set();
      if (done.has(name)) continue;
      try {
        module.init(el);
        done.add(name);
        initialised.set(el, done);
      } catch (error) {
        console.error(`[theme1] ${name} failed to initialise`, error);
      }
    }
  }
}

export function teardown(root = document) {
  for (const [name, module] of registry) {
    for (const el of targets(root, name)) {
      const done = initialised.get(el);
      if (!done?.has(name)) continue;
      try {
        module.destroy(el);
      } catch (error) {
        console.error(`[theme1] ${name} failed to tear down`, error);
      }
      done.delete(name);
    }
  }
}

/** Watch for nodes added later — AJAX, templating — and initialise them. */
export function observe(root = document.body) {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
```

- [ ] **Step 4: Write `src/scripts/core/focus-trap.js`**

```js
const FOCUSABLE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

/** Focusable descendants in document order, excluding hidden and disabled. */
export function getFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('disabled') && !el.hasAttribute('hidden') && el.tabIndex !== -1 && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Trap Tab focus inside container. Returns a release function. */
export function trapFocus(container, { onEscape, returnFocusTo } = {}) {
  const previous = returnFocusTo ?? document.activeElement;

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      onEscape?.(event);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !container.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeydown, true);
  getFocusable(container)[0]?.focus();

  return function release() {
    document.removeEventListener('keydown', onKeydown, true);
    previous?.focus?.();
  };
}
```

- [ ] **Step 5: Write `src/scripts/vendor/bs.js`**

A thin adapter so no page file imports Bootstrap directly. Export `getDropdown(el)`, `getModal(el)`, `getOffcanvas(el)`, `getTooltip(el, opts)`, `getPopover(el, opts)`, `getCollapse(el)`, `getTab(el)`, `getToast(el, opts)`, `getCarousel(el)`, `getScrollSpy(el, opts)` — each importing its plugin from `bootstrap/js/dist/<plugin>.js` so only what is used lands in the bundle, and each returning the existing instance via `getOrCreateInstance`. Also export `disposeAll(root)` used by `teardown`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/registry.test.js tests/unit/focus-trap.test.js`
Expected: PASS — 9 registry tests, 11 focus-trap tests.

- [ ] **Step 7: Commit**

```bash
git add theme1/src/scripts/core/registry.js theme1/src/scripts/core/focus-trap.js theme1/src/scripts/vendor/bs.js theme1/tests/unit/registry.test.js theme1/tests/unit/focus-trap.test.js
git commit -m "feat(ui): component registry, focus trap and bootstrap adapters"
```

---

### Task 3: Button, badge, avatar

**Files:**
- Create: `theme1/src/partials/ui/button.njk`, `badge.njk`, `avatar.njk`
- Create: `theme1/src/styles/components/_button.scss`, `_badge.scss`, `_avatar.scss`
- Create: `theme1/src/scripts/components/button.js`
- Test: `theme1/tests/unit/components/button.test.js`

**Interfaces:**
- Consumes: tier-3 `--t-btn-*` knobs; the `icon()` macro.
- Produces:
  - `button(opts)` — `{ label, intent, variant, size, icon, iconEnd, iconOnly, block, rounded, loading, disabled, href, type, attrs }`
  - `badge(opts)` — `{ text, intent, variant, pill, glow, icon, dot, positioned }`
  - `avatar(opts)` — `{ name, src, icon, size, shape, intent, status, ariaHidden }`
  - `avatarGroup(items, opts)` — `{ max, size }`
  - `setLoading(el, isLoading)` from `button.js`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/components/button.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { init, destroy, setLoading } from '../../../src/scripts/components/button.js';

beforeEach(() => {
  document.body.innerHTML = `
    <button class="t-btn" data-t-button id="b">
      <span class="t-btn__label">Save</span>
    </button>`;
  init(document.getElementById('b'));
});

describe('loading state', () => {
  it('marks the button busy and disables it', () => {
    const button = document.getElementById('b');
    setLoading(button, true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(true);
    expect(button.classList.contains('t-btn--loading')).toBe(true);
  });

  it('keeps the label in the accessibility tree while loading', () => {
    const button = document.getElementById('b');
    setLoading(button, true);
    expect(button.textContent).toContain('Save');
  });

  it('restores the previous disabled state when loading ends', () => {
    const button = document.getElementById('b');
    setLoading(button, true);
    setLoading(button, false);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('does not re-enable a button that was already disabled', () => {
    const button = document.getElementById('b');
    button.disabled = true;
    destroy(button);
    init(button);
    setLoading(button, true);
    setLoading(button, false);
    expect(button.disabled).toBe(true);
  });

  it('swallows clicks while loading', () => {
    const button = document.getElementById('b');
    let clicks = 0;
    button.addEventListener('click', () => { clicks += 1; });
    setLoading(button, true);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks).toBe(0);
  });
});

describe('link buttons', () => {
  it('uses aria-disabled on an anchor, since anchors ignore disabled', () => {
    document.body.innerHTML = '<a class="t-btn" data-t-button href="#x" id="a">Go</a>';
    const link = document.getElementById('a');
    init(link);
    setLoading(link, true);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.hasAttribute('disabled')).toBe(false);
  });

  it('prevents navigation while an anchor is loading', () => {
    document.body.innerHTML = '<a class="t-btn" data-t-button href="#x" id="a">Go</a>';
    const link = document.getElementById('a');
    init(link);
    setLoading(link, true);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/components/button.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/components/button.js`**

Implement `NAME = 'button'`, `init(el)` (records the element's original `disabled` state in a `WeakMap` and adds a capture-phase click guard), `destroy(el)`, `defaults = {}`, and `setLoading(el, isLoading)` satisfying every assertion above. Register it with the registry.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/button.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write the three macros**

`button.njk` renders `<button>` or `<a>` per `href`, with classes `t-btn t-btn--{{ variant }} t-btn--{{ intent }} t-btn--{{ size }}`, an optional leading and trailing icon, a `.t-btn__label` span, and a `.t-btn__spinner` that is `aria-hidden`. `iconOnly` requires `label` and renders it as visually-hidden text — an icon-only button with no accessible name is a hard failure.

`badge.njk` renders `<span class="t-badge">` with `--pill`, `--glow`, `--soft`, `--dot`, and `--positioned` modifiers. A `dot` badge with no text gets `role="status"` plus a visually-hidden description; a `positioned` counter renders its number and an `aria-label` such as "3 unread notifications".

`avatar.njk` renders an image, initials derived from `name`, or an icon. Initials come from the first character of the first two words, uppercased. The background hue is derived deterministically from the name so the same person is always the same colour — implement `hueFromName(name)` as a small string hash mapped onto the eight chart tokens. `status` renders a dot with a visually-hidden label ("online", "away", "busy", "offline"). `avatarGroup` stacks up to `max` avatars and renders a `+N` overflow chip carrying an `aria-label` listing the remainder count.

- [ ] **Step 6: Write the three stylesheets**

`_button.scss` must cover, from tokens only: variants `filled`, `outline`, `flat`, `soft`, `gradient`, `relief`, `link`; intents `primary`, `secondary`, `success`, `warning`, `danger`, `info`; sizes `sm`, `md`, `lg`; `--icon-only` (square, width equals height); `--block`; `--rounded`; states hover, `:focus-visible` (using `--t-focus-ring`), active, `:disabled`/`[aria-disabled]`, and `--loading` (spinner visible, label at reduced opacity but still rendered). Button groups join adjacent radii using logical `border-start-start-radius` and friends so RTL is correct.

`_badge.scss` covers all six intents × solid/soft/outline, pill, glow, dot, and positioned (absolutely placed with `inset-inline-end` and `inset-block-start`).

`_avatar.scss` covers sizes `xs`/`sm`/`md`/`lg`/`xl`, circle and square, image `object-fit: cover`, initials centring, the eight hue backgrounds with a foreground chosen for AA, the status dot with a ring in the surface colour, and the group's negative inline margin overlap — which must flip in RTL, so use `margin-inline-start`.

- [ ] **Step 7: Commit**

```bash
git add theme1/src/partials/ui/button.njk theme1/src/partials/ui/badge.njk theme1/src/partials/ui/avatar.njk theme1/src/styles/components/_button.scss theme1/src/styles/components/_badge.scss theme1/src/styles/components/_avatar.scss theme1/src/scripts/components/button.js theme1/tests/unit/components/button.test.js
git commit -m "feat(ui): button, badge and avatar with full variant matrix"
```

---

### Task 4: Card and card actions

**Files:**
- Create: `theme1/src/partials/ui/card.njk`
- Create: `theme1/src/styles/components/_card.scss`
- Create: `theme1/src/scripts/components/card-actions.js`
- Test: `theme1/tests/unit/components/card-actions.test.js`

**Interfaces:**
- Consumes: `--t-card-*` knobs; `button()`; `icon()`.
- Produces: `card(opts)` and the `cardHeader`/`cardBody`/`cardFooter` sub-macros; `init`/`destroy` from `card-actions.js`; events `card:collapse`, `card:expand`, `card:refresh`, `card:remove`, `card:fullscreen`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/components/card-actions.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, destroy } from '../../../src/scripts/components/card-actions.js';

beforeEach(() => {
  document.body.innerHTML = `
    <section class="t-card" data-t-card-actions id="card">
      <header class="t-card__header">
        <h3 class="t-card__title" id="card-title">Revenue</h3>
        <div class="t-card__actions">
          <button type="button" data-t-card-action="collapse" aria-expanded="true" aria-controls="card-body" aria-label="Collapse"></button>
          <button type="button" data-t-card-action="refresh" aria-label="Refresh"></button>
          <button type="button" data-t-card-action="fullscreen" aria-pressed="false" aria-label="Expand to full screen"></button>
          <button type="button" data-t-card-action="remove" aria-label="Remove"></button>
        </div>
      </header>
      <div class="t-card__body" id="card-body">content</div>
    </section>`;
  init(document.getElementById('card'));
});

const action = (name) => document.querySelector(`[data-t-card-action="${name}"]`);

describe('collapse', () => {
  it('hides the body and flips aria-expanded', () => {
    action('collapse').click();
    expect(document.getElementById('card-body').hidden).toBe(true);
    expect(action('collapse').getAttribute('aria-expanded')).toBe('false');
  });

  it('emits card:collapse then card:expand', () => {
    const seen = [];
    const card = document.getElementById('card');
    card.addEventListener('card:collapse', () => seen.push('collapse'));
    card.addEventListener('card:expand', () => seen.push('expand'));
    action('collapse').click();
    action('collapse').click();
    expect(seen).toEqual(['collapse', 'expand']);
  });
});

describe('refresh', () => {
  it('shows a busy overlay and emits card:refresh', () => {
    const spy = vi.fn();
    document.getElementById('card').addEventListener('card:refresh', spy);
    action('refresh').click();
    expect(document.getElementById('card').getAttribute('aria-busy')).toBe('true');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears busy when the consumer calls detail.done()', () => {
    const card = document.getElementById('card');
    card.addEventListener('card:refresh', (event) => event.detail.done());
    action('refresh').click();
    expect(card.getAttribute('aria-busy')).toBe('false');
  });
});

describe('remove', () => {
  it('emits card:remove and detaches the card', () => {
    const spy = vi.fn();
    document.getElementById('card').addEventListener('card:remove', spy);
    action('remove').click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.getElementById('card')).toBeNull();
  });

  it('keeps the card when a listener cancels the event', () => {
    document.getElementById('card').addEventListener('card:remove', (event) => event.preventDefault());
    action('remove').click();
    expect(document.getElementById('card')).not.toBeNull();
  });

  it('moves focus somewhere sensible after removal, never to the body', () => {
    document.body.insertAdjacentHTML('afterbegin', '<button id="before">before</button>');
    destroy(document.getElementById('card'));
    init(document.getElementById('card'));
    action('remove').click();
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('fullscreen', () => {
  it('toggles the class and aria-pressed', () => {
    action('fullscreen').click();
    expect(document.getElementById('card').classList.contains('t-card--fullscreen')).toBe(true);
    expect(action('fullscreen').getAttribute('aria-pressed')).toBe('true');
  });

  it('exits on Escape', () => {
    action('fullscreen').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('card').classList.contains('t-card--fullscreen')).toBe(false);
  });
});

describe('lifecycle', () => {
  it('destroy() unbinds every action', () => {
    destroy(document.getElementById('card'));
    action('collapse').click();
    expect(document.getElementById('card-body').hidden).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/components/card-actions.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/components/card-actions.js`**

Satisfy every assertion. `card:remove` and `card:collapse` are **cancelable**; `card:refresh`'s detail carries a `done()` callback. Removal moves focus to the previous focusable sibling, or the card's container, before detaching.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/card-actions.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Write the macro and styles**

`card.njk` supports: `title`, `subtitle`, `headerActions`, `footer`, `image` (top or overlay), `padding: none`, `bordered`, `elevated`, `intent` (coloured header), and an `actions` array drawn from `['collapse', 'refresh', 'fullscreen', 'remove']`. The title renders as a heading at a caller-supplied level (`headingLevel`, default 3) so page heading order stays correct.

`_card.scss` covers the base, header/body/footer, image top and overlay, the deck/group/columns/masonry layouts (CSS grid and `columns`), `--fullscreen` (fixed, `--t-z-50`, full viewport), the busy overlay, coloured headers for all six intents, and the collapsed state.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/ui/card.njk theme1/src/styles/components/_card.scss theme1/src/scripts/components/card-actions.js theme1/tests/unit/components/card-actions.test.js
git commit -m "feat(ui): card with collapse, refresh, fullscreen and remove actions"
```

---

### Task 5: Feedback components — alert, toast, empty state, skeleton

**Files:**
- Create: `theme1/src/partials/ui/alert.njk`, `toast.njk`, `empty-state.njk`, `skeleton.njk`
- Create: `theme1/src/styles/components/_alert.scss`, `_toast.scss`, `_empty-state.scss`, `_skeleton.scss`
- Create: `theme1/src/scripts/components/alert.js`, `toast.js`
- Test: `theme1/tests/unit/components/toast.test.js`

**Interfaces:**
- Consumes: `--t-state-*` tokens; `getToast` from `vendor/bs.js`.
- Produces:
  - `alert(opts)` — `{ intent, variant, title, body, icon, dismissible, actions }`
  - `emptyState(opts)` — `{ illustration, title, body, action }`
  - `skeleton(opts)` — `{ variant: 'text'|'title'|'avatar'|'card'|'row', lines, width }`
  - `toast.show({ intent, title, body, timeout, dismissible }) => id`
  - `toast.dismiss(id)`, `toast.clear()`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/components/toast.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { show, dismiss, clear, _container } from '../../../src/scripts/components/toast.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  clear();
  vi.useRealTimers();
});

describe('toast container', () => {
  it('creates one live region and reuses it', () => {
    show({ body: 'one' });
    show({ body: 'two' });
    expect(document.querySelectorAll('[data-t-toast-container]')).toHaveLength(1);
  });

  it('marks the container as a polite live region', () => {
    show({ body: 'hello' });
    const container = _container();
    expect(container.getAttribute('aria-live')).toBe('polite');
    expect(container.getAttribute('aria-atomic')).toBe('false');
  });

  it('uses assertive for danger toasts, so errors interrupt', () => {
    show({ body: 'broken', intent: 'danger' });
    expect(document.querySelector('.t-toast--danger').getAttribute('role')).toBe('alert');
  });
});

describe('lifecycle', () => {
  it('returns an id and renders the body text', () => {
    const id = show({ body: 'Saved' });
    expect(typeof id).toBe('string');
    expect(document.querySelector('.t-toast').textContent).toContain('Saved');
  });

  it('renders body text with textContent, never innerHTML', () => {
    show({ body: '<img src=x onerror=alert(1)>' });
    expect(document.querySelector('.t-toast img')).toBeNull();
  });

  it('auto-dismisses after the timeout', () => {
    show({ body: 'bye', timeout: 3000 });
    expect(document.querySelectorAll('.t-toast')).toHaveLength(1);
    vi.advanceTimersByTime(3001);
    expect(document.querySelectorAll('.t-toast')).toHaveLength(0);
  });

  it('never auto-dismisses when timeout is 0', () => {
    show({ body: 'sticky', timeout: 0 });
    vi.advanceTimersByTime(60_000);
    expect(document.querySelectorAll('.t-toast')).toHaveLength(1);
  });

  it('dismiss(id) removes exactly that toast', () => {
    const first = show({ body: 'one', timeout: 0 });
    show({ body: 'two', timeout: 0 });
    dismiss(first);
    expect([...document.querySelectorAll('.t-toast')].map((t) => t.textContent.trim())).toEqual(['two']);
  });

  it('dismiss on an unknown id is a no-op', () => {
    show({ body: 'one', timeout: 0 });
    expect(() => dismiss('nope')).not.toThrow();
    expect(document.querySelectorAll('.t-toast')).toHaveLength(1);
  });

  it('pauses the timer while hovered and resumes on leave', () => {
    show({ body: 'hover me', timeout: 3000 });
    const toast = document.querySelector('.t-toast');
    toast.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(5000);
    expect(document.querySelectorAll('.t-toast')).toHaveLength(1);
    toast.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(3001);
    expect(document.querySelectorAll('.t-toast')).toHaveLength(0);
  });

  it('caps the number of visible toasts, dropping the oldest', () => {
    for (let i = 0; i < 8; i += 1) show({ body: `t${i}`, timeout: 0 });
    expect(document.querySelectorAll('.t-toast').length).toBeLessThanOrEqual(5);
    expect(document.querySelector('.t-toast').textContent).not.toContain('t0');
  });

  it('clear() removes all toasts', () => {
    show({ body: 'a', timeout: 0 });
    show({ body: 'b', timeout: 0 });
    clear();
    expect(document.querySelectorAll('.t-toast')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/components/toast.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `toast.js` and `alert.js`**

`toast.js` owns a lazily-created container appended to `<body>`, positioned by the `--t-toast-position` token (defaulting to block-end / inline-end, so RTL flips it automatically). `defaults = { intent: 'info', timeout: 5000, dismissible: true, max: 5 }`.

`alert.js` handles dismissal: fade out, remove, move focus to the alert's previous focusable sibling, and emit a cancelable `alert:dismiss`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/toast.test.js`
Expected: PASS — 13 tests.

- [ ] **Step 5: Write the macros and stylesheets**

`alert.njk` covers solid / soft / left-accent / outline × six intents, with icon, with title and body, dismissible, and with actions.

`empty-state.njk` takes an illustration slot (filled by Phase 06), a title, explanatory body, and an optional primary action. It is the shared answer to every "no results" case in later phases.

`skeleton.njk` renders shimmer placeholders for text, title, avatar, card, and table row; the shimmer animation is disabled under `prefers-reduced-motion`.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/ui/alert.njk theme1/src/partials/ui/toast.njk theme1/src/partials/ui/empty-state.njk theme1/src/partials/ui/skeleton.njk theme1/src/styles/components/_alert.scss theme1/src/styles/components/_toast.scss theme1/src/styles/components/_empty-state.scss theme1/src/styles/components/_skeleton.scss theme1/src/scripts/components/alert.js theme1/src/scripts/components/toast.js theme1/tests/unit/components/toast.test.js
git commit -m "feat(ui): alert, toast, empty state and skeleton"
```

---

### Task 6: Overlay and disclosure components

**Files:**
- Create: `theme1/src/partials/ui/modal.njk`, `dropdown.njk`, `drawer.njk`, `tooltip.njk`, `popover.njk`, `accordion.njk`, `tabs.njk`
- Create: matching partials in `theme1/src/styles/components/`
- Create: `theme1/src/scripts/components/modal.js`, `dropdown.js`, `drawer.js`, `tabs.js`
- Test: `theme1/tests/unit/components/modal.test.js`, `tests/unit/components/tabs.test.js`

**Interfaces:**
- Consumes: `vendor/bs.js`; `trapFocus`.
- Produces: `modal.open(id, opts)`, `modal.close(id)`; `tabs` supporting both automatic and manual activation; `drawer` (our own off-canvas over Bootstrap's Offcanvas).

- [ ] **Step 1: Write the failing tests**

`tests/unit/components/tabs.test.js` must assert, using jsdom:

- The tablist has `role="tablist"`; each tab has `role="tab"`, `aria-selected`, and `aria-controls`; each panel has `role="tabpanel"` and `aria-labelledby`.
- Only the selected tab is in the tab order (`tabindex="0"`); the rest are `-1` — the roving tabindex pattern.
- `ArrowRight`/`ArrowLeft` move between tabs and wrap, **reversed under `dir="rtl"`**.
- `ArrowDown`/`ArrowUp` do the same when `aria-orientation="vertical"`.
- `Home`/`End` jump to the first and last tab.
- With `activation: 'automatic'` (the default) arrow keys select as they move; with `'manual'` they only move focus and `Enter`/`Space` selects.
- Selecting emits a cancelable `tabs:change` with `{ from, to }`.
- Disabled tabs are skipped by arrow keys and cannot be selected.
- `destroy()` restores the original tabindex values.

`tests/unit/components/modal.test.js` must assert:

- Opening sets `aria-modal="true"`, traps focus, and moves focus to the first focusable element — or to the element named by `data-t-autofocus` when present.
- `Escape` closes, and focus returns to the trigger.
- Closing is cancelable via a `modal:close` listener calling `preventDefault()`.
- Background content receives `inert` (or `aria-hidden`) while open, and it is removed on close.
- Stacked modals: opening a second modal traps focus in the second, and closing it returns the trap to the first.
- Scroll lock is applied to `<body>` on open and released only when the **last** modal closes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/modal.test.js tests/unit/components/tabs.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the modules**

Each wraps its Bootstrap counterpart through `vendor/bs.js` and adds the behaviour the tests demand — Bootstrap does not give roving tabindex, RTL-aware arrows, cancelable close, or the stacked-modal focus stack.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS across all component test files.

- [ ] **Step 5: Write the macros and stylesheets**

Cover the full variant lists from spec §7: modal sizes `sm`/`md`/`lg`/`xl`/`fullscreen`, centered, scrollable, themed headers × six intents, form modal; dropdown directions `down`/`up`/`start`/`end`, sizes, header, divider, form-in-dropdown, nested submenu; accordion single and multiple open, flush and boxed; tabs horizontal, vertical, pill, underline, with icons, with badges.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/ui/ theme1/src/styles/components/ theme1/src/scripts/components/ theme1/tests/unit/components/
git commit -m "feat(ui): modal, dropdown, drawer, tabs, accordion, tooltip, popover"
```

---

### Task 7: Remaining base components

**Files:**
- Create: macros, styles and — where interactive — scripts for: `breadcrumb`, `pagination`, `progress`, `spinner`, `list-group`, `media-object`, `timeline`, `divider`, `carousel`, `segmented-control`, `tag`, `kbd`, `code-block`, `stat-tile`, `sparkline`, `rating`, `notification-item`, `activity-feed`, `command-palette`
- Test: `theme1/tests/unit/components/pagination.test.js`, `rating.test.js`, `command-palette.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `pagination(opts)` — `{ page, pageCount, siblingCount, showFirstLast, size, ariaLabel }`, plus `pageRange(page, pageCount, siblingCount) => Array<number|'…'>`
  - `rating` — `init`/`destroy`, `getValue(el)`, `setValue(el, value)`
  - `commandPalette` — `open()`, `close()`, `registerCommand({ id, label, keywords, run })`

- [ ] **Step 1: Write the failing tests**

`pagination.test.js` tests `pageRange` as a pure function — this is where off-by-one bugs live:

```js
import { describe, it, expect } from 'vitest';
import { pageRange } from '../../../src/scripts/components/pagination.js';

describe('pageRange', () => {
  it('lists every page when there are few enough to fit', () => {
    expect(pageRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns a single page for a one-page set', () => {
    expect(pageRange(1, 1, 1)).toEqual([1]);
  });

  it('returns an empty range for zero pages', () => {
    expect(pageRange(1, 0, 1)).toEqual([]);
  });

  it('truncates on the right when near the start', () => {
    expect(pageRange(1, 20, 1)).toEqual([1, 2, 3, '…', 20]);
  });

  it('truncates on the left when near the end', () => {
    expect(pageRange(20, 20, 1)).toEqual([1, '…', 18, 19, 20]);
  });

  it('truncates on both sides in the middle', () => {
    expect(pageRange(10, 20, 1)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('widens with siblingCount', () => {
    expect(pageRange(10, 20, 2)).toEqual([1, '…', 8, 9, 10, 11, 12, '…', 20]);
  });

  it('never emits an ellipsis standing in for a single page', () => {
    const range = pageRange(4, 9, 1);
    for (let i = 1; i < range.length - 1; i += 1) {
      if (range[i] === '…') expect(range[i + 1] - range[i - 1]).toBeGreaterThan(2);
    }
  });

  it('clamps a page above the count', () => {
    expect(pageRange(99, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps a page below one', () => {
    expect(pageRange(0, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });
});
```

`rating.test.js` covers: renders as a radio group with an accessible name; arrow keys increment and decrement and clamp at both ends; `readonly` blocks interaction but stays readable; half-star values round-trip; `setValue` emits `rating:change`.

`command-palette.test.js` covers: opens on `Ctrl/Cmd+K`; filters by label and by keywords; `ArrowDown`/`ArrowUp` move the active option with `aria-activedescendant`; `Enter` runs the active command and closes; `Escape` closes and restores focus; the empty result state renders; and the listbox/option roles are correct.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/pagination.test.js tests/unit/components/rating.test.js tests/unit/components/command-palette.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the modules and macros**

`pageRange` is pure and must satisfy every case above, including the "no ellipsis for one page" rule. `pagination.njk` wraps the range in `<nav aria-label>` with an `<ul>`, marks the current page `aria-current="page"`, renders previous/next with accessible names, and disables them at the boundaries via `aria-disabled` on anchors.

The remaining components are markup plus styles. `progress` covers linear and circular, all six intents, striped, animated, labelled, and stacked, always with `role="progressbar"` and `aria-valuenow/min/max`. `spinner` covers six visual styles, all sizes, and always carries a visually-hidden "Loading" unless a caller supplies its own label. `timeline` covers left, right, centered, icon markers, avatar markers, and six intents.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/partials/ui/ theme1/src/styles/components/ theme1/src/scripts/components/ theme1/tests/unit/components/
git commit -m "feat(ui): pagination, progress, timeline, rating, command palette and the remaining base components"
```

---

### Task 8: Style guide page and the accessibility gate

**Files:**
- Create: `theme1/src/pages/ui-components.njk`
- Create: `theme1/src/pages/ui-typography.njk`
- Create: `theme1/src/pages/ui-colors.njk`
- Create: `theme1/src/pages/ui-icons.njk`
- Create: `theme1/tests/a11y/style-guide.test.js`
- Modify: `theme1/package.json`, `theme1/.github/workflows/ci.yml`, `theme1/src/data/navigation.json`

**Interfaces:**
- Consumes: every component above.
- Produces: the a11y gate every later phase reuses by adding its page to `PAGES`.

- [ ] **Step 1: Write the failing test**

Run `cd theme1 && npm install --save-dev axe-core jsdom` first (`axe-core` is MPL-2.0, permitted for dev-only by the audit rules).

Create `theme1/tests/a11y/style-guide.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { source as axeSource } from 'axe-core';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));

/** Pages checked by this gate. Later phases append their own. */
export const PAGES = ['ui-components.html', 'ui-typography.html', 'ui-colors.html', 'ui-icons.html', 'index.html'];

async function audit(file, theme) {
  const html = await readFile(path.join(distDir, file), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.document.documentElement.setAttribute('data-theme', theme);
  dom.window.eval(axeSource);
  const results = await dom.window.axe.run(dom.window.document, {
    resultTypes: ['violations'],
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  dom.window.close();
  return results.violations;
}

describe.each(PAGES)('%s', (file) => {
  it.each(['light', 'dark'])('has no critical or serious axe violations in %s theme', async (theme) => {
    const violations = await audit(file, theme);
    const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const report = blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}`).join('\n');
    expect(blocking, `\n${report}`).toHaveLength(0);
  }, 60_000);
});

describe('style guide structure', () => {
  let doc;

  beforeAll(async () => {
    const html = await readFile(path.join(distDir, 'ui-components.html'), 'utf8');
    doc = new JSDOM(html).window.document;
  });

  it('documents every component with a section and a heading', () => {
    const sections = doc.querySelectorAll('section[data-component]');
    expect(sections.length).toBeGreaterThanOrEqual(30);
    for (const section of sections) {
      expect(section.querySelector('h2, h3'), section.dataset.component).not.toBeNull();
    }
  });

  it('has exactly one h1', () => {
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
  });

  it('never skips a heading level', () => {
    const levels = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `jump at heading ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('gives every icon-only button an accessible name', () => {
    for (const button of doc.querySelectorAll('button')) {
      const hasText = button.textContent.trim().length > 0;
      const hasLabel = button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby');
      expect(hasText || hasLabel, button.outerHTML.slice(0, 120)).toBe(true);
    }
  });

  it('gives every form control a label', () => {
    for (const field of doc.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      const labelled =
        field.hasAttribute('aria-label') ||
        field.hasAttribute('aria-labelledby') ||
        (field.id && doc.querySelector(`label[for="${field.id}"]`)) ||
        field.closest('label');
      expect(Boolean(labelled), field.outerHTML.slice(0, 120)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/a11y/style-guide.test.js`
Expected: FAIL — `ui-components.html` does not exist.

- [ ] **Step 3: Write the four reference pages**

`ui-components.njk` — one `<section data-component="…">` per component, each with an `<h2>`, a one-line description, and a live rendering of **every** variant listed in spec §7. This page is the visual regression baseline and the a11y gate, so completeness matters more than brevity.

`ui-typography.njk` — the full scale, weights, line-heights, headings, body, lead, small, lists, blockquote, code, kbd, and a long-form specimen.

`ui-colors.njk` — every primitive ramp with its hex and its **measured** contrast against both surfaces, every semantic role, and the eight chart series in both themes. Compute the ratios at build time with `scripts/contrast.mjs` so the page cannot drift from reality.

`ui-icons.njk` — every icon in `ICON_SET`, searchable, with its name and a copy-to-clipboard control.

Add all four to `navigation.json` under "User Interface".

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/a11y/style-guide.test.js`
Expected: PASS — 10 page/theme audits plus 5 structural checks.

Fix any violation by changing the **component**, never by narrowing the rule set.

- [ ] **Step 5: Wire the gate into CI**

Add `"test:a11y": "vitest run tests/a11y"` to `package.json` and a CI step running it after `Build`.

- [ ] **Step 6: Full verification**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 7: Commit**

```bash
git add theme1/src/pages/ui-components.njk theme1/src/pages/ui-typography.njk theme1/src/pages/ui-colors.njk theme1/src/pages/ui-icons.njk theme1/src/data/navigation.json theme1/tests/a11y/style-guide.test.js theme1/package.json theme1/.github/workflows/ci.yml
git commit -m "feat(ui): style guide, colour and icon reference, axe gate"
```

---

## Phase exit checklist

- [ ] `npm run lint` exits 0.
- [ ] `npm run test` green, including every component module.
- [ ] `npm run test:a11y` reports 0 critical/serious violations on all four reference pages, in **both** themes.
- [ ] Every component in spec §7 has a macro, a stylesheet, states, and a style guide section.
- [ ] Every interactive component exports `init`, `destroy`, `defaults` and is registered.
- [ ] No component stylesheet contains a raw hex value or a physical `left`/`right` property.
- [ ] The icon sprite contains only icons in `ICON_SET`.
- [ ] `npm run check:budgets` passes.
- [ ] CI green.

**Unblocks:** Phases 04 (Forms), 05 (Data display), 06 (Artwork) — which may run in parallel.
