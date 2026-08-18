# Phase 12 — Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 13 extension pages on permissively-licensed, jQuery-free libraries — replacing the seven jQuery-bound plugins the source template used with in-house modules, and wrapping the six that survive.

**Architecture:** Every extension is a thin adapter over a vendor library, or an in-house module where no acceptable vendor exists. Adapters follow the Phase 03 component contract, dynamically import their library, and degrade to something usable if that import fails. Nothing on these pages depends on jQuery, and nothing pulls a vendor into the shared chunk.

**Tech Stack:** SweetAlert2 · Swiper · noUiSlider · Shepherd · jsTree · Dragula · Plyr · i18next — all MIT — plus five in-house replacements.

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. Every vendor here is a dynamic import.
- **Accessibility:** WCAG 2.2 AA. Every extension must be keyboard-operable.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Replacement decisions

| Source plugin | Licence problem | theme1 |
|---|---|---|
| Toastr | jQuery-bound | **In-house** — already built in Phase 03 |
| BlockUI | **dual MIT/GPL** — ambiguous | **In-house** overlay |
| jQuery contextMenu | jQuery-bound | **In-house** menu |
| RateYo | jQuery-bound | **In-house** rating — already built in Phase 03 |
| clipboard.js | fine, but unnecessary | **In-house** on the async Clipboard API |
| SweetAlert2 | MIT ✓ | keep |
| Swiper | MIT ✓ | keep |
| noUiSlider | MIT ✓ | keep |
| Shepherd | MIT ✓ | keep |
| jsTree | MIT but jQuery-bound | **In-house** tree on the ARIA tree pattern |
| Dragula | MIT ✓ | keep, with a keyboard alternative |
| Plyr | MIT ✓ | keep |
| i18next | MIT ✓ | keep |

Five in-house replacements, eight vendor keeps. Record this table in `docs/architecture.md`.

---

### Task 1: In-house replacements — overlay, context menu, clipboard

**Files:**
- Create: `theme1/src/scripts/components/overlay.js`, `context-menu.js`, `clipboard.js`
- Create: `theme1/src/styles/components/_overlay.scss`, `_context-menu.scss`
- Create: `theme1/src/pages/ext-component-blockui.njk`, `ext-component-context-menu.njk`, `ext-component-clipboard.njk`
- Test: `theme1/tests/unit/components/overlay.test.js`, `context-menu.test.js`, `clipboard.test.js`

**Interfaces:**
- `overlay` — `block(target, { message, spinner }) => release`, `unblock(target)`, `isBlocked(target)`
- `contextMenu` — `init`, `destroy`, `open(x, y, items)`, `close()`
- `clipboard` — `copy(text) => Promise<boolean>`, `init`, `destroy`

- [ ] **Step 1: Write the failing tests**

`overlay.test.js` must cover: blocking sets `aria-busy="true"` on the target and inserts a labelled overlay; the overlay traps focus so tabbing cannot reach the blocked content; `release()` restores focus to where it was and removes `aria-busy`; blocking twice returns two releases and the overlay lifts only when both have run; blocking the whole document locks page scroll and unlocks it on release; `isBlocked` reports correctly; and the message is rendered with `textContent`.

`context-menu.test.js` must cover: right-click opens the menu at the pointer; the menu is `role="menu"` with `role="menuitem"` children; arrow keys move, `Home`/`End` jump, typeahead selects by first letter; `Escape` closes and restores focus to the trigger; clicking outside closes; the menu flips when it would overflow the viewport edge, and flips on the **inline** axis correctly under RTL; the `ContextMenu` **key** and `Shift+F10` open it at the focused element — without which the feature is mouse-only; disabled items are skipped; and separators are `role="separator"` and not focusable.

`clipboard.test.js` must cover: `copy` resolves `true` on success; falls back to a hidden `textarea` + `execCommand` when `navigator.clipboard` is absent; resolves `false` rather than throwing when both fail; a copy button announces success in a live region and reverts its label after a timeout; and the copied text is read from a data attribute or a target element, never from `innerHTML`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/overlay.test.js tests/unit/components/context-menu.test.js tests/unit/components/clipboard.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three modules and build the three pages**

The reference-counted `block`/`release` pair is what makes the overlay safe under concurrent async work; a boolean flag would let the first completion unblock while the second is still running.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/scripts/components/overlay.js theme1/src/scripts/components/context-menu.js theme1/src/scripts/components/clipboard.js theme1/src/styles/components/ theme1/src/pages/ext-component-blockui.njk theme1/src/pages/ext-component-context-menu.njk theme1/src/pages/ext-component-clipboard.njk theme1/tests/unit/components/
git commit -m "feat(ext): in-house overlay, context menu and clipboard replacing jquery plugins"
```

---

### Task 2: In-house tree

**Files:**
- Create: `theme1/src/scripts/components/tree.js`
- Create: `theme1/src/styles/components/_tree.scss`
- Create: `theme1/src/pages/ext-component-tree.njk`
- Test: `theme1/tests/unit/components/tree.test.js`

**Interfaces:**
- Produces: `init`, `destroy`, `expand(id)`, `collapse(id)`, `select(ids)`, `getSelection()`, `getState()`, `setState(state)`; events `tree:select`, `tree:expand`, `tree:collapse`, `tree:move`.

jsTree is MIT but jQuery-bound, so this is built in-house on the ARIA tree pattern. The Phase 09 file manager already needs one; this task generalises that implementation and the file manager switches to it.

- [ ] **Step 1: Write the failing test**

Cover the full ARIA tree keyboard contract, because a partially-implemented tree is worse than a list:

- Roles: container `role="tree"`, nodes `role="treeitem"`, groups `role="group"`.
- `aria-expanded` only on nodes with children; `aria-selected` on selectable nodes; `aria-level`, `aria-setsize`, `aria-posinset` correct at every depth.
- Roving tabindex: exactly one node has `tabindex="0"`.
- `↓` moves to the next visible node, including into an expanded child group; `↑` to the previous.
- `→` on a collapsed node expands it; on an expanded node moves to its first child; on a leaf does nothing.
- `←` on an expanded node collapses it; on a collapsed or leaf node moves to its parent; at the root does nothing.
- `Home`/`End` move to the first and last visible node.
- Typeahead moves to the next node starting with the typed characters, wrapping.
- `Enter`/`Space` select; `Ctrl`-click toggles in multi-select; `Shift`-click selects a contiguous range of **visible** nodes.
- Checkbox mode: a parent shows indeterminate when some descendants are checked, and checking a parent checks every descendant.
- Collapsing a node containing the focused node moves focus to that node.
- `getState`/`setState` round-trip expansion and selection.
- Under RTL, `→` and `←` swap meaning.

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/tree.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Switch the file manager to the shared tree and re-run its tests**

Run: `cd theme1 && npx vitest run tests/unit/apps/file-manager.test.js`
Expected: PASS — unchanged behaviour, one implementation.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/scripts/components/tree.js theme1/src/styles/components/_tree.scss theme1/src/pages/ext-component-tree.njk theme1/src/scripts/pages/app-file-manager.js theme1/tests/unit/components/tree.test.js
git commit -m "feat(ext): in-house aria tree replacing jstree, shared with the file manager"
```

---

### Task 3: Vendor adapters — alerts, toasts, sliders, ratings

**Files:**
- Create: `theme1/src/scripts/components/alert-dialog.js`
- Create: `theme1/src/scripts/components/range-slider.js`
- Create: `theme1/src/pages/ext-component-sweet-alerts.njk`, `ext-component-toastr.njk`, `ext-component-sliders.njk`, `ext-component-ratings.njk`
- Test: `theme1/tests/unit/components/range-slider.test.js`

**Interfaces:**
- `alertDialog` — `confirm(opts) => Promise<boolean>`, `prompt(opts) => Promise<string|null>`, `alert(opts) => Promise<void>`, `toastNotice(opts)`
- `rangeSlider` — `init`, `destroy`, `getValue(el)`, `setValue(el, value)`; pure helper `snapToStep(value, min, max, step) => number`

- [ ] **Step 1: Write the failing test**

`range-slider.test.js` covers `snapToStep` exhaustively — a slider that lands between steps is the classic bug:

```js
import { describe, it, expect } from 'vitest';
import { snapToStep } from '../../../src/scripts/components/range-slider.js';

describe('snapToStep', () => {
  it('snaps to the nearest step', () => {
    expect(snapToStep(7, 0, 100, 5)).toBe(5);
    expect(snapToStep(8, 0, 100, 5)).toBe(10);
  });
  it('snaps upward exactly at the midpoint', () => {
    expect(snapToStep(7.5, 0, 100, 5)).toBe(10);
  });
  it('clamps to the bounds', () => {
    expect(snapToStep(-10, 0, 100, 5)).toBe(0);
    expect(snapToStep(200, 0, 100, 5)).toBe(100);
  });
  it('respects a non-zero minimum when computing steps', () => {
    expect(snapToStep(12, 10, 100, 5)).toBe(10);
    expect(snapToStep(13, 10, 100, 5)).toBe(15);
  });
  it('handles a decimal step without floating-point drift', () => {
    expect(snapToStep(0.35, 0, 1, 0.1)).toBe(0.4);
    expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
  });
  it('returns the value unchanged when step is 0', () => {
    expect(snapToStep(7.3, 0, 100, 0)).toBe(7.3);
  });
  it('never exceeds the maximum even when the max is not on a step boundary', () => {
    expect(snapToStep(99, 0, 99, 10)).toBeLessThanOrEqual(99);
  });
  it('returns the minimum for a non-numeric value', () => {
    expect(snapToStep(NaN, 10, 100, 5)).toBe(10);
  });
});
```

Plus DOM assertions: the slider exposes `role="slider"` with `aria-valuenow/min/max/text`; arrow keys step, `PageUp`/`PageDown` step by ten, `Home`/`End` jump; a range slider's two handles are separately focusable and cannot cross; the handles' arrow directions reverse under RTL; and the paired number inputs stay in sync both ways.

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/range-slider.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Build the four pages**

`ext-component-sweet-alerts.njk` — every SweetAlert2 variant: basic, title+text, six intent icons, custom icon, HTML content (built with DOM methods, not raw HTML), confirm/cancel with custom labels, input types (text, email, password, textarea, select, radio, checkbox, file, range), chained dialogs, a timer with a progress bar, a position set, and a custom-animation variant. Restyle SweetAlert entirely from our tokens and confirm focus returns to the trigger after every dialog closes.

`ext-component-toastr.njk` — the Phase 03 toast in every intent, position, timeout, with and without a progress bar and close button, stacked, and with a maximum reached.

`ext-component-sliders.njk` — single, range, vertical, stepped, with tooltips, with pips, with a formatted value, connected, disabled, and a price-range slider paired with number inputs.

`ext-component-ratings.njk` — the Phase 03 rating in every size, with half values, read-only, custom icons, all six intents, and inside a form so its value submits.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/scripts/components/alert-dialog.js theme1/src/scripts/components/range-slider.js theme1/src/pages/ext-component-{sweet-alerts,toastr,sliders,ratings}.njk theme1/package.json theme1/tests/unit/components/range-slider.test.js
git commit -m "feat(ext): alert dialogs, toasts, sliders and ratings"
```

---

### Task 4: Swiper, drag-and-drop, tour, media player

**Files:**
- Create: `theme1/src/scripts/components/carousel-swiper.js`, `drag-drop.js`, `tour.js`, `media-player.js`
- Create: `theme1/src/pages/ext-component-swiper.njk`, `ext-component-drag-drop.njk`, `ext-component-tour.njk`, `ext-component-media-player.njk`
- Test: `theme1/tests/unit/components/drag-drop.test.js`

**Interfaces:**
- `dragDrop` — `init`, `destroy`, `moveItem(listEl, itemEl, direction)`, `getOrder(listEl)`; events `dragdrop:change`

- [ ] **Step 1: Write the failing test**

The point of this task is that **every drag interaction has a keyboard equivalent**, so the test targets that:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { init, destroy, moveItem, getOrder } from '../../../src/scripts/components/drag-drop.js';

const MARKUP = `
<div data-t-dragdrop>
  <ul data-t-dragdrop-list id="a">
    <li data-t-dragdrop-item id="i1" tabindex="0">One</li>
    <li data-t-dragdrop-item id="i2" tabindex="0">Two</li>
    <li data-t-dragdrop-item id="i3" tabindex="0">Three</li>
  </ul>
  <ul data-t-dragdrop-list id="b"></ul>
  <div data-t-dragdrop-status aria-live="polite"></div>
</div>`;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  init(document.querySelector('[data-t-dragdrop]'));
});

describe('keyboard reordering', () => {
  it('moves an item down with Alt+ArrowDown', () => {
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('a'))).toEqual(['i2', 'i1', 'i3']);
  });

  it('moves an item up with Alt+ArrowUp', () => {
    const item = document.getElementById('i3');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('a'))).toEqual(['i1', 'i3', 'i2']);
  });

  it('does nothing at the top and bottom boundaries', () => {
    const first = document.getElementById('i1');
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('a'))).toEqual(['i1', 'i2', 'i3']);
  });

  it('keeps focus on the moved item', () => {
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(document.activeElement.id).toBe('i1');
  });

  it('moves between lists with Alt+ArrowRight', () => {
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('b'))).toEqual(['i1']);
  });

  it('reverses the between-list direction under RTL', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('b'))).toEqual(['i1']);
    document.documentElement.setAttribute('dir', 'ltr');
  });

  it('announces every move in the live region', () => {
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    const status = document.querySelector('[data-t-dragdrop-status]').textContent;
    expect(status).toMatch(/2 of 3|position 2/i);
  });

  it('emits dragdrop:change with the new order', () => {
    let detail;
    document.querySelector('[data-t-dragdrop]').addEventListener('dragdrop:change', (e) => { detail = e.detail; });
    moveItem(document.getElementById('a'), document.getElementById('i1'), 'down');
    expect(detail.order).toEqual(['i2', 'i1', 'i3']);
  });

  it('gives every item an accessible description of the keyboard shortcut', () => {
    for (const item of document.querySelectorAll('[data-t-dragdrop-item]')) {
      expect(item.getAttribute('aria-describedby') || item.getAttribute('aria-roledescription')).toBeTruthy();
    }
  });

  it('works with the pointer library absent', () => {
    // init() must not have required Dragula to bind keyboard handling.
    expect(getOrder(document.getElementById('a'))).toEqual(['i1', 'i2', 'i3']);
    const item = document.getElementById('i2');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('a'))).toEqual(['i1', 'i3', 'i2']);
  });

  it('destroy() unbinds keyboard handling', () => {
    destroy(document.querySelector('[data-t-dragdrop]'));
    const item = document.getElementById('i1');
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(getOrder(document.getElementById('a'))).toEqual(['i1', 'i2', 'i3']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/drag-drop.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Build the four pages**

`ext-component-swiper.njk` — default, navigation, every pagination type (bullets, dynamic bullets, fraction, progress, custom), autoplay with pause-on-hover **and** pause-on-focus, effects (fade, cube, coverflow, flip, cards), thumbs gallery, responsive breakpoints, lazy loading, virtual slides, centered, multi-row, and vertical. All slide content is generated pattern art. Every carousel must be operable by keyboard and must expose `aria-roledescription="carousel"` with slide position announced.

`ext-component-drag-drop.njk` — copy, move-between-lists, handles only, revert on invalid drop, sortable list, and a grid. Every demo shows its keyboard shortcut in visible text.

`ext-component-tour.njk` — a Shepherd tour with step anatomy, positioning on all four sides, progress indicator, skip and back buttons, a step attached to a scrolled-offscreen element, and a modal overlay variant. The tour must trap focus in the step, restore it on exit, and be dismissible with `Escape`.

`ext-component-media-player.njk` — Plyr with audio, video, and a playlist. **No YouTube or Vimeo embeds** — they load third-party trackers and violate the no-external-request constraint. Use a locally-hosted, freely-licensed sample or a generated silent test clip, and say so on the page. Captions track included, since a video player demo without captions models the wrong thing.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/scripts/components/ theme1/src/pages/ext-component-{swiper,drag-drop,tour,media-player}.njk theme1/package.json theme1/tests/unit/components/drag-drop.test.js
git commit -m "feat(ext): swiper, keyboard-capable drag-drop, tour and media player"
```

---

### Task 5: Internationalisation demo

**Files:**
- Create: `theme1/src/scripts/components/i18n-demo.js`
- Create: `theme1/src/pages/ext-component-i18n.njk`
- Test: `theme1/tests/unit/components/i18n-demo.test.js`

This page demonstrates the mechanism; Phase 13 builds the real system across the whole theme.

- [ ] **Step 1: Write the failing test**

Cover: switching language re-renders every `[data-i18n]` node using `textContent`; a missing key renders the key itself rather than `undefined`; interpolation escapes its values; pluralisation picks the right form for 0, 1 and many in English and in a language with more plural forms; switching to an RTL language sets `dir="rtl"`; and the choice persists.

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/i18n-demo.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/scripts/components/i18n-demo.js theme1/src/pages/ext-component-i18n.njk theme1/src/data/locales/ theme1/tests/unit/components/i18n-demo.test.js
git commit -m "feat(ext): i18n demonstration page"
```

---

### Task 6: Phase gate

**Files:**
- Create: `theme1/tests/build/no-jquery.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/src/data/navigation.json`, `theme1/docs/architecture.md`

- [ ] **Step 1: Write the jQuery-absence gate**

```js
import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

describe('no jQuery', () => {
  it('is absent from every emitted chunk', async () => {
    const files = await fg('assets/**/*.js', { cwd: path.join(rootDir, 'dist'), absolute: true });
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      expect(text, path.basename(file)).not.toMatch(/jQuery JavaScript Library|jquery\.fn\.jquery|\$\.fn\.extend/);
    }
  });

  it('is absent from the dependency tree', async () => {
    const pkg = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((n) => /jquery/i.test(n))).toEqual([]);
  });

  it('is absent from the lockfile, including transitively', async () => {
    const lock = await readFile(path.join(rootDir, 'package-lock.json'), 'utf8');
    expect(lock).not.toMatch(/"node_modules\/jquery"/);
  });

  it('appears in no built HTML page', async () => {
    const pages = await fg('*.html', { cwd: path.join(rootDir, 'dist'), absolute: true });
    for (const page of pages) {
      const html = await readFile(page, 'utf8');
      expect(html, path.basename(page)).not.toMatch(/jquery/i);
    }
  });
});
```

- [ ] **Step 2: Run it, fix any failure by removing the dependency**

Run: `cd theme1 && npm run build && npx vitest run tests/build/no-jquery.test.js`
Expected: PASS. If a vendor pulls jQuery transitively, replace that vendor — do not weaken the test.

- [ ] **Step 3: Record the replacement table and extend the gates**

Write the replacement decisions table into `docs/architecture.md`. Add all 13 extension pages to `PAGES` in `tests/a11y/style-guide.test.js` and to `navigation.json` under "User Interface → Extensions".

- [ ] **Step 4: Run everything**

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add theme1/tests/build/no-jquery.test.js theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json theme1/docs/architecture.md
git commit -m "test(ext): jquery-absence gate and a11y coverage for all 13 extension pages"
```

---

## Phase exit checklist

- [ ] All 13 extension pages build, appear in the navigation, and pass axe in both themes.
- [ ] jQuery is absent from every chunk, every page, `package.json`, and the lockfile — including transitively.
- [ ] The five in-house replacements (overlay, context menu, clipboard, tree, rating) are complete and tested.
- [ ] The overlay is reference-counted and lifts only when every blocker has released.
- [ ] The context menu opens by keyboard (`ContextMenu` key and `Shift+F10`), not just by right-click.
- [ ] The tree implements the full ARIA tree keyboard pattern, including RTL arrow reversal, and is shared with the file manager.
- [ ] `snapToStep` never lands off a step and never exceeds the bounds.
- [ ] Every drag interaction has a tested keyboard equivalent that works with the pointer library absent.
- [ ] The media player uses local media only — no YouTube or Vimeo embed, no external request.
- [ ] Every vendor library is dynamically imported and absent from the shared chunk.
- [ ] CI green.
