# Phase 14 — Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the theme from "builds and passes its own tests" to "would survive an external audit" — accessibility across all 122 pages, a real performance budget measured in a browser, a CSP-clean security posture, and verified cross-browser behaviour.

**Architecture:** Everything in this phase is a gate, not a feature. Playwright drives a real browser for the checks jsdom cannot make — computed contrast, focus visibility, layout overflow, and Lighthouse. Each gate lands in CI as it is built, so nothing regresses afterwards.

**Tech Stack:** Playwright (Apache-2.0) · axe-core (MPL-2.0, dev-only) · Lighthouse (Apache-2.0) · Vitest

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes, all locales.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

---

### Task 1: Browser test harness

**Files:**
- Create: `theme1/playwright.config.js`
- Create: `theme1/tests/e2e/fixtures.js`
- Modify: `theme1/package.json`
- Test: `theme1/tests/e2e/smoke.spec.js`

**Interfaces:**
- Produces: `allPages(): string[]` — every file in `dist/*.html`; `withTheme(page, theme)`, `withDirection(page, dir)`, `setViewport(page, name)` helpers used by every later task.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/e2e/smoke.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { allPages } from './fixtures.js';

const pages = allPages();

test('the build produced every expected page', () => {
  expect(pages.length).toBeGreaterThanOrEqual(122);
});

test.describe('every page loads cleanly', () => {
  for (const file of pages) {
    test(file, async ({ page }) => {
      const consoleErrors = [];
      const failedRequests = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('requestfailed', (req) => failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`));
      page.on('pageerror', (error) => consoleErrors.push(String(error)));

      const response = await page.goto(`/${file}`, { waitUntil: 'networkidle' });
      expect(response.status(), file).toBe(200);

      expect(consoleErrors, `${file} console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
      expect(failedRequests, `${file} failed requests:\n${failedRequests.join('\n')}`).toEqual([]);

      // Nothing may reach outside the origin at runtime.
      const external = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((e) => e.name).filter((url) => !url.startsWith(location.origin)),
      );
      expect(external, `${file} loaded external resources`).toEqual([]);

      // The page must have painted something.
      await expect(page.locator('#main')).toBeVisible();
    });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm install --save-dev @playwright/test && npx playwright install --with-deps chromium firefox webkit && npx playwright test tests/e2e/smoke.spec.js`
Expected: FAIL — no config.

- [ ] **Step 3: Write the config and fixtures**

`playwright.config.js` serves `dist/` with the built-in web server, runs Chromium, Firefox and WebKit, retries once in CI, and writes an HTML report. Add `"test:e2e": "playwright test"` and a CI step that runs it after `Build`.

- [ ] **Step 4: Run the test and fix every console error**

Run: `cd theme1 && npm run build && npm run test:e2e -- tests/e2e/smoke.spec.js`

Expect real findings here — a page-entry script referencing a missing element, a dynamic import that 404s, an icon id with no symbol. Fix each at source. A console error on a demo page is a bug a buyer will hit on day one.

- [ ] **Step 5: Commit**

```bash
git add theme1/playwright.config.js theme1/tests/e2e/ theme1/package.json theme1/.github/workflows/ci.yml theme1/src/
git commit -m "test(e2e): browser smoke test across all pages, zero console errors"
```

---

### Task 2: Accessibility across every page

**Files:**
- Create: `theme1/tests/e2e/a11y.spec.js`
- Modify: source as findings require

**Interfaces:**
- Consumes: `@axe-core/playwright` (MPL-2.0, dev-only).
- Produces: the full-coverage a11y gate, superseding the jsdom-based one for completeness while keeping it for speed.

- [ ] **Step 1: Write the failing test**

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { allPages } from './fixtures.js';

const MODES = [
  { theme: 'light', dir: 'ltr', lang: 'en' },
  { theme: 'dark', dir: 'ltr', lang: 'en' },
  { theme: 'dark', dir: 'rtl', lang: 'ar' },
];

for (const file of allPages()) {
  for (const mode of MODES) {
    test(`${file} — ${mode.theme}/${mode.dir}`, async ({ page }) => {
      await page.goto(`/${file}`);
      await page.evaluate((m) => {
        document.documentElement.setAttribute('data-theme', m.theme);
        document.documentElement.setAttribute('dir', m.dir);
        document.documentElement.setAttribute('lang', m.lang);
      }, mode);
      await page.waitForTimeout(150);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const blocking = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
      const report = blocking
        .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}\n  ${v.help}\n  ${v.nodes[0]?.html?.slice(0, 160)}`)
        .join('\n\n');
      expect(blocking, `\n${report}`).toHaveLength(0);
    });
  }
}
```

- [ ] **Step 2: Run it and fix every finding at source**

Run: `cd theme1 && npm run test:e2e -- tests/e2e/a11y.spec.js`

Fix the **component**, never the rule set, and never by adding `aria-hidden` to silence a warning. Common findings to expect and how to fix them properly:

| Finding | Correct fix |
|---|---|
| `color-contrast` in dark mode | Adjust the semantic token, then re-run the Phase 01 contrast test |
| `aria-required-children` | The role is wrong for the markup — change the markup, not the role |
| `nested-interactive` | A button inside a link, or a control inside a `label` that already wraps one |
| `landmark-unique` | Two `<nav>` elements with no distinguishing `aria-label` |
| `heading-order` | A widget hard-coding `<h3>`; use its `headingLevel` option |
| `scrollable-region-focusable` | A scroll container without `tabindex="0"` |

- [ ] **Step 3: Commit**

```bash
git add theme1/tests/e2e/a11y.spec.js theme1/src/
git commit -m "a11y: zero critical or serious violations across all pages in three modes"
```

---

### Task 3: Keyboard and focus

**Files:**
- Create: `theme1/tests/e2e/keyboard.spec.js`

- [ ] **Step 1: Write the failing test**

Cover what axe cannot see — that the page is actually operable:

```js
import { test, expect } from '@playwright/test';

const PAGES = ['index.html', 'app-email.html', 'app-kanban.html', 'form-wizard.html', 'table-datatable-advanced.html', 'app-ecommerce-checkout.html', 'ui-components.html'];

for (const file of PAGES) {
  test.describe(file, () => {
    test('the first Tab reaches the skip link, and it works', async ({ page }) => {
      await page.goto(`/${file}`);
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.className ?? '');
      expect(focused).toContain('t-skip-link');

      await page.keyboard.press('Enter');
      const target = await page.evaluate(() => document.activeElement?.id ?? location.hash);
      expect(String(target)).toContain('main');
    });

    test('every focusable element has a visible focus indicator', async ({ page }) => {
      await page.goto(`/${file}`);
      const invisible = await page.evaluate(() => {
        const selector = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
        const bad = [];
        for (const el of document.querySelectorAll(selector)) {
          if (el.offsetParent === null) continue;
          el.focus();
          const style = getComputedStyle(el);
          const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
          const hasShadow = style.boxShadow !== 'none';
          if (!hasOutline && !hasShadow) bad.push(el.outerHTML.slice(0, 100));
        }
        return bad;
      });
      expect(invisible, invisible.join('\n')).toEqual([]);
    });

    test('no focusable element is hidden from view', async ({ page }) => {
      await page.goto(`/${file}`);
      const offscreen = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('a[href],button,input,select,textarea')) {
          if (el.offsetParent === null) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) bad.push(el.outerHTML.slice(0, 80));
        }
        return bad;
      });
      expect(offscreen, offscreen.join('\n')).toEqual([]);
    });

    test('tab order does not jump backwards up the page', async ({ page }) => {
      await page.goto(`/${file}`);
      const positions = [];
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Tab');
        positions.push(await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const r = el.getBoundingClientRect();
          return Math.round(r.top) * 10000 + Math.round(r.left);
        }));
      }
      const real = positions.filter((p) => p !== null);
      const regressions = real.filter((p, i) => i > 0 && p < real[i - 1] - 200000).length;
      expect(regressions, 'tab order jumps far back up the page').toBeLessThanOrEqual(1);
    });

    test('no positive tabindex is used', async ({ page }) => {
      await page.goto(`/${file}`);
      const positive = await page.$$eval('[tabindex]', (els) =>
        els.filter((el) => Number(el.getAttribute('tabindex')) > 0).map((el) => el.outerHTML.slice(0, 80)));
      expect(positive).toEqual([]);
    });
  });
}

test('a modal traps focus and restores it on close', async ({ page }) => {
  await page.goto('/ui-components.html');
  const trigger = page.locator('[data-bs-toggle="modal"]').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  for (let i = 0; i < 20; i += 1) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('.modal')));
  expect(inside, 'focus escaped the modal').toBe(true);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const restored = await page.evaluate(() => document.activeElement?.getAttribute('data-bs-toggle'));
  expect(restored).toBe('modal');
});
```

- [ ] **Step 2: Run it and fix every finding**

Run: `cd theme1 && npm run test:e2e -- tests/e2e/keyboard.spec.js`

- [ ] **Step 3: Commit**

```bash
git add theme1/tests/e2e/keyboard.spec.js theme1/src/
git commit -m "a11y: verified keyboard operability and focus management"
```

---

### Task 4: Layout robustness

**Files:**
- Create: `theme1/tests/e2e/layout.spec.js`

- [ ] **Step 1: Write the failing test**

The single highest-value browser check is horizontal overflow — it is invisible in jsdom and obvious to a user:

```js
import { test, expect } from '@playwright/test';
import { allPages } from './fixtures.js';

const VIEWPORTS = [
  { name: '320', width: 320, height: 640 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '2560', width: 2560, height: 1440 },
];

for (const file of allPages()) {
  for (const viewport of VIEWPORTS) {
    test(`${file} @ ${viewport.name} does not scroll horizontally`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${file}`, { waitUntil: 'networkidle' });

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= docWidth + 1) return [];
        const culprits = [];
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect();
          if (rect.right > docWidth + 1 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll') {
            culprits.push(`${el.tagName}.${el.className}`.slice(0, 100));
          }
        }
        return [...new Set(culprits)].slice(0, 5);
      });
      expect(overflow, `overflow caused by: ${overflow.join(', ')}`).toEqual([]);
    });
  }
}

test.describe('zoom and reduced motion', () => {
  test('remains usable at 200% zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/index.html');
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);
  });

  test('honours prefers-reduced-motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/index.html');
    const animated = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        return parseFloat(s.transitionDuration) > 0.05 || parseFloat(s.animationDuration) > 0.05;
      }).length,
    );
    expect(animated, 'animations still running under reduced motion').toBe(0);
    await context.close();
  });

  test('text remains readable when only the font size is enlarged', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', '125'));
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('.t-btn, .t-badge, .t-sidebar__link')].filter((el) => el.scrollWidth > el.clientWidth + 2).length,
    );
    expect(clipped, 'controls clip their label at 125% font scale').toBe(0);
  });
});
```

- [ ] **Step 2: Run it and fix every overflow at source**

Run: `cd theme1 && npm run test:e2e -- tests/e2e/layout.spec.js`

The usual causes: a table without a scroll container, a long unbroken string without `overflow-wrap: anywhere`, a fixed `inline-size` on a control, or a chart with a hard-coded pixel width.

- [ ] **Step 3: Commit**

```bash
git add theme1/tests/e2e/layout.spec.js theme1/src/styles/
git commit -m "fix(layout): no horizontal overflow at any viewport, zoom or font scale"
```

---

### Task 5: Performance

**Files:**
- Create: `theme1/tests/e2e/performance.spec.js`
- Create: `theme1/scripts/lighthouse.mjs`
- Modify: `theme1/scripts/check-budgets.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test, expect } from '@playwright/test';

const PAGES = ['index.html', 'dashboard-analytics.html', 'app-email.html', 'table-datatable-advanced.html', 'ui-components.html'];

for (const file of PAGES) {
  test(`${file} meets the runtime budget`, async ({ page }) => {
    await page.goto(`/${file}`, { waitUntil: 'networkidle' });

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const sum = (type) => resources.filter((r) => r.initiatorType === type).reduce((n, r) => n + (r.transferSize || 0), 0);
      return {
        requests: resources.length,
        js: sum('script'),
        css: sum('link'),
        domContentLoaded: nav.domContentLoadedEventEnd,
        domNodes: document.querySelectorAll('*').length,
      };
    });

    expect(metrics.requests, `${file} makes too many requests`).toBeLessThan(30);
    expect(metrics.js, `${file} ships too much JS`).toBeLessThan(400 * 1024);
    expect(metrics.css, `${file} ships too much CSS`).toBeLessThan(150 * 1024);
    expect(metrics.domContentLoaded, `${file} DOMContentLoaded too slow`).toBeLessThan(2000);
    expect(metrics.domNodes, `${file} DOM is too large`).toBeLessThan(3000);
  });

  test(`${file} has no layout shift after load`, async ({ page }) => {
    await page.goto(`/${file}`, { waitUntil: 'networkidle' });
    const cls = await page.evaluate(() => new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve(total), 1000);
    }));
    expect(cls, `${file} cumulative layout shift`).toBeLessThan(0.1);
  });
}

test('the theme applies before first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme1:layout', JSON.stringify({ theme: 'dark' })));
  await page.goto('/index.html');
  const themeAtFirstPaint = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(themeAtFirstPaint).toBe('dark');
});

test('fonts do not block first paint', async ({ page }) => {
  await page.goto('/index.html');
  const display = await page.evaluate(() => [...document.fonts].map((f) => f.display));
  expect(display.every((d) => d === 'swap' || d === 'optional')).toBe(true);
});
```

- [ ] **Step 2: Run it and fix what fails**

Run: `cd theme1 && npm run test:e2e -- tests/e2e/performance.spec.js`

Typical fixes: split an over-large page entry chunk, defer a non-critical import behind an `IntersectionObserver`, reserve space for charts and images to remove layout shift, and inline the critical CSS for the shell.

- [ ] **Step 3: Add the Lighthouse gate**

`scripts/lighthouse.mjs` runs Lighthouse against `dist/index.html` and `dashboard-analytics.html` and fails below **95 performance, 100 accessibility, 100 best-practices**. Add `"test:lighthouse": "node scripts/lighthouse.mjs"` and a CI step.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/e2e/performance.spec.js theme1/scripts/lighthouse.mjs theme1/package.json theme1/.github/workflows/ci.yml theme1/src/
git commit -m "perf: runtime budgets, zero layout shift and a lighthouse gate"
```

---

### Task 6: Security review

**Files:**
- Create: `theme1/tests/security/csp.spec.js`
- Create: `theme1/tests/security/static-analysis.test.js`
- Create: `theme1/docs/security.md`

- [ ] **Step 1: Write the static-analysis gate**

```js
import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

async function sourceFiles(pattern) {
  return fg(pattern, { cwd: rootDir, absolute: true, ignore: ['**/node_modules/**', 'dist/**', 'src/*.html'] });
}

describe('dangerous APIs', () => {
  it('uses no innerHTML, outerHTML or insertAdjacentHTML with dynamic data', async () => {
    const offenders = [];
    for (const file of await sourceFiles('src/scripts/**/*.js')) {
      const text = await readFile(file, 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        if (/\.(innerHTML|outerHTML)\s*=/.test(line) || /insertAdjacentHTML\s*\(/.test(line)) {
          if (!line.includes('// safe:')) offenders.push(`${path.relative(rootDir, file)}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('uses no eval, Function constructor, or timer-with-string', async () => {
    const offenders = [];
    for (const file of await sourceFiles('src/scripts/**/*.js')) {
      const text = await readFile(file, 'utf8');
      if (/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"]/.test(text)) offenders.push(path.relative(rootDir, file));
    }
    expect(offenders).toEqual([]);
  });

  it('uses no document.write', async () => {
    for (const file of await sourceFiles('src/**/*.{js,njk}')) {
      expect(await readFile(file, 'utf8'), path.relative(rootDir, file)).not.toContain('document.write');
    }
  });
});

describe('built output', () => {
  it('has no inline event handler attribute', async () => {
    const offenders = [];
    for (const file of await fg('*.html', { cwd: path.join(rootDir, 'dist'), absolute: true })) {
      const html = await readFile(file, 'utf8');
      const matches = html.match(/\son(click|load|error|mouseover|focus|submit|change|input)\s*=/gi);
      if (matches) offenders.push(`${path.basename(file)}: ${[...new Set(matches)].join(', ')}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('gives every target="_blank" link rel="noopener noreferrer"', async () => {
    const offenders = [];
    for (const file of await fg('*.html', { cwd: path.join(rootDir, 'dist'), absolute: true })) {
      const html = await readFile(file, 'utf8');
      for (const tag of html.match(/<a[^>]+target=["']_blank["'][^>]*>/gi) ?? []) {
        if (!/rel=["'][^"']*noopener/.test(tag) || !/rel=["'][^"']*noreferrer/.test(tag)) {
          offenders.push(`${path.basename(file)}: ${tag.slice(0, 100)}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('contains exactly one inline script — the theme boot snippet', async () => {
    for (const file of await fg('*.html', { cwd: path.join(rootDir, 'dist'), absolute: true })) {
      const inline = (await readFile(file, 'utf8')).match(/<script(?![^>]*\ssrc=)[^>]*>/gi) ?? [];
      expect(inline.length, path.basename(file)).toBeLessThanOrEqual(1);
    }
  });

  it('ships no server-side code', async () => {
    expect(await fg('**/*.{php,asp,aspx,jsp,cgi}', { cwd: path.join(rootDir, 'dist') })).toEqual([]);
  });

  it('leaks no secret-looking string', async () => {
    const patterns = [/AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /(?:api[_-]?key|secret|password)["'\s:=]+[A-Za-z0-9_\-]{24,}/i];
    for (const file of await fg('**/*.{js,html,json,css}', { cwd: path.join(rootDir, 'dist'), absolute: true })) {
      const text = await readFile(file, 'utf8');
      for (const pattern of patterns) expect(pattern.test(text), `${path.basename(file)} matches ${pattern}`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Write the CSP browser gate**

`csp.spec.js` serves each page with a strict header and asserts zero violations:

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'sha256-<boot hash>';
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
```

The test listens for `securitypolicyviolation` events and fails on any. Note that `img-src data:` is needed only if avatar data URIs are used; prefer inline SVG so it can be dropped.

- [ ] **Step 3: Run both, fix findings, and write `docs/security.md`**

Run: `cd theme1 && npx vitest run tests/security && npm run test:e2e -- tests/security/csp.spec.js`

`docs/security.md` records: the recommended CSP with the boot-snippet hash, the recommended `Permissions-Policy`, `Referrer-Policy` and `X-Content-Type-Options` headers, the threat model (a static theme has no server, so the risks are XSS via integrator-supplied data and supply-chain), and explicit guidance for integrators — where user data enters, which helpers escape, and that the theme never uses `innerHTML`.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/security/ theme1/docs/security.md theme1/src/ theme1/.github/workflows/ci.yml
git commit -m "security: csp-clean output, static analysis gate and integrator guidance"
```

---

### Task 7: Cross-browser and final sweep

**Files:**
- Modify: `theme1/playwright.config.js`, `theme1/.github/workflows/ci.yml`
- Create: `theme1/docs/browser-support.md`

- [ ] **Step 1: Run the whole suite in all three engines**

Run: `cd theme1 && npm run test:e2e`
Expected: green in Chromium, Firefox and WebKit.

WebKit is where the real findings appear — `:has()` support, `inert`, dialog behaviour, and `scrollbar-gutter`. Fix with progressive enhancement, never by user-agent sniffing.

- [ ] **Step 2: Record support and add a `.browserslistrc`**

`docs/browser-support.md` states the target — last two versions of Chrome, Edge, Firefox and Safari, plus iOS Safari 16+ — lists the modern features relied on (CSS logical properties, custom properties, `:focus-visible`, container-free grid `auto-fit`, `dvh`, ES modules, dynamic import, `Intl.Segmenter`), and names the graceful degradation for each.

- [ ] **Step 3: Full gate**

```bash
cd theme1 && npm run lint && npm run i18n:check && npm run build && npm run test && npm run test:a11y && npm run test:rtl && npm run test:assets && npm run test:e2e && npm run test:lighthouse && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add theme1/playwright.config.js theme1/docs/browser-support.md theme1/.github/workflows/ci.yml theme1/src/
git commit -m "test: cross-browser verification in chromium, firefox and webkit"
```

---

## Phase exit checklist

- [ ] Every one of the 122 pages loads with **zero** console errors and zero failed requests.
- [ ] No page makes a single external request at runtime.
- [ ] axe reports zero critical or serious violations on every page in light, dark, and Arabic RTL.
- [ ] The first Tab reaches a working skip link on every page; every focusable element has a visible indicator; no positive `tabindex` exists.
- [ ] Modals trap focus and restore it on close.
- [ ] No page scrolls horizontally at 320, 768, 1280 or 2560 px, at 200% zoom, or at 125% font scale.
- [ ] Animations stop under `prefers-reduced-motion`.
- [ ] Every measured page: under 30 requests, under 400 KB JS, under 2 s DOMContentLoaded, CLS under 0.1.
- [ ] Lighthouse ≥ 95 performance, 100 accessibility, 100 best practices.
- [ ] The dark theme applies before first paint with no flash.
- [ ] Zero `innerHTML`/`eval`/`document.write`; zero inline handlers; one inline script per page; every `_blank` link has `noopener noreferrer`.
- [ ] Every page runs clean under a strict CSP with no `unsafe-inline`.
- [ ] No server-side code and no secret-looking string in `dist/`.
- [ ] Green in Chromium, Firefox and WebKit.
- [ ] CI green.

**Unblocks:** Phase 15 (Release).
