# Phase 07 — Dashboards & Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two dashboards and the five card demo pages, with every widget from the source template's capability set, driven by JSON fixtures rather than markup, and correct from 320 px to 3840 px.

**Architecture:** Every widget is a Nunjucks macro in `src/partials/widgets/` taking a data object. All demo data lives in `src/data/dashboard-*.json`, so a widget's data shape is explicit and a consumer can swap in real data by matching the shape. Widget macros compose Phase 03 components — they introduce no new base components.

**Tech Stack:** Nunjucks · SCSS · ApexCharts via the Phase 05 chart layer · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. ApexCharts stays dynamically imported.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Widget catalogue

Twenty-four widgets, covering the source template's dashboard and card surface.

| Group | Widgets |
|---|---|
| **Stats** | `stat-tile` · `stat-delta` · `stat-sparkline` · `stat-progress` · `stat-group` |
| **Charts** | `chart-card` · `revenue-report` · `goal-radial` · `sales-by-region` · `session-donut` · `growth-area` |
| **Lists** | `transaction-list` · `activity-feed` · `top-products` · `browser-table` · `order-table` |
| **People** | `greeting-card` · `medal-card` · `team-card` · `support-tracker` · `meetup-card` |
| **Misc** | `timeline-card` · `upgrade-card` · `quick-actions` |

Every widget has: a defined data shape, an **empty** state, a **loading** (skeleton) state, an **error** state, and a documented responsive behaviour.

## File Structure

| Path | Responsibility |
|---|---|
| `src/partials/widgets/*.njk` | One macro per widget |
| `src/data/dashboard-analytics.json`, `dashboard-ecommerce.json` | Demo fixtures |
| `src/data/cards-*.json` | Card page fixtures |
| `src/scripts/pages/dashboard-analytics.js`, `dashboard-ecommerce.js` | Chart wiring only |
| `src/styles/pages/_dashboard.scss` | Dashboard grid |
| `src/pages/dashboard-analytics.njk`, `dashboard-ecommerce.njk`, `index.njk` | Dashboards |
| `src/pages/card-basic.njk`, `card-advance.njk`, `card-statistics.njk`, `card-analytics.njk`, `card-actions.njk` | Card demos |
| `tests/unit/widgets.test.js`, `tests/layout/responsive.test.js` | Gates |

---

### Task 1: Dashboard data fixtures

**Files:**
- Create: `theme1/src/data/dashboard-analytics.json`, `dashboard-ecommerce.json`
- Create: `theme1/src/data/_schema/dashboard.md`
- Test: `theme1/tests/unit/dashboard-data.test.js`

**Interfaces:**
- Produces: the fixture shapes every widget macro consumes.

```jsonc
{
  "stats": [
    { "id": "revenue", "label": "Revenue", "value": 4829000, "unit": "currency", "currency": "USD",
      "delta": 0.124, "deltaPeriod": "vs last month", "icon": "trending-up", "intent": "success",
      "sparkline": [12, 19, 14, 22, 18, 27, 25] }
  ],
  "series": [
    { "id": "revenue-report", "name": "Revenue", "type": "area",
      "categories": ["Jan", "Feb", "Mar"], "data": [4400, 5500, 4100] }
  ],
  "tables": [
    { "id": "top-products", "columns": [...], "rows": [...] }
  ],
  "people": [
    { "id": "u-01", "name": "Ada Lovelace", "role": "Engineering", "status": "online" }
  ]
}
```

Currency values are **integer minor units**, matching Phase 05's `format.js`. Deltas are fractions, not percentages.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/dashboard-data.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dataDir = fileURLToPath(new URL('../../src/data', import.meta.url));
const files = ['dashboard-analytics.json', 'dashboard-ecommerce.json'];
const data = {};

beforeAll(async () => {
  for (const file of files) data[file] = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
});

describe.each(files)('%s', (file) => {
  it('defines stats, series, tables and people', () => {
    for (const key of ['stats', 'series', 'tables', 'people']) {
      expect(Array.isArray(data[file][key]), key).toBe(true);
    }
  });

  it('gives every entity a unique id', () => {
    for (const key of ['stats', 'series', 'tables', 'people']) {
      const ids = data[file][key].map((entity) => entity.id);
      expect(ids.filter(Boolean)).toHaveLength(ids.length);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('stores currency stats as integers, so no float drift reaches a total', () => {
    for (const stat of data[file].stats.filter((s) => s.unit === 'currency')) {
      expect(Number.isInteger(stat.value), `${stat.id} = ${stat.value}`).toBe(true);
      expect(stat.currency, stat.id).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('stores deltas as fractions between -1 and 10, not percentages', () => {
    for (const stat of data[file].stats.filter((s) => s.delta !== undefined)) {
      expect(Math.abs(stat.delta), `${stat.id} delta ${stat.delta} looks like a percentage`).toBeLessThan(10);
    }
  });

  it('matches each series data length to its categories', () => {
    for (const series of data[file].series) {
      if (series.categories) expect(series.data, series.id).toHaveLength(series.categories.length);
    }
  });

  it('exercises the edge cases the spec calls out', () => {
    const values = data[file].stats.map((s) => s.value);
    expect(values, 'include a zero value').toContain(0);
    expect(data[file].stats.some((s) => s.delta < 0), 'include a negative delta').toBe(true);
    expect(values.some((v) => v > 900_000_000), 'include a very large value').toBe(true);
  });

  it('includes a long label to prove text truncation is handled', () => {
    const labels = [...data[file].stats.map((s) => s.label), ...data[file].people.map((p) => p.name)];
    expect(labels.some((l) => l.length > 40), 'include a >40 character label').toBe(true);
  });

  it('includes a null cell so empty rendering is exercised', () => {
    const cells = data[file].tables.flatMap((t) => t.rows.flat());
    expect(cells.some((c) => c === null), 'include a null cell').toBe(true);
  });

  it('references no real company or person', () => {
    const text = JSON.stringify(data[file]).toLowerCase();
    for (const brand of ['google', 'apple', 'microsoft', 'amazon', 'facebook', 'chrome', 'safari', 'firefox', 'dropbox', 'figma']) {
      expect(text, `must not reference ${brand}`).not.toContain(brand);
    }
  });

  it('references no external URL', () => {
    expect(JSON.stringify(data[file])).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/dashboard-data.test.js`
Expected: FAIL — fixtures do not exist.

- [ ] **Step 3: Author the fixtures and the shape documentation**

Write both JSON files satisfying every assertion, and document each shape in `src/data/_schema/dashboard.md` so a consumer swapping in real data knows the contract. Use invented company and person names — nothing real.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/dashboard-data.test.js`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/data/dashboard-analytics.json theme1/src/data/dashboard-ecommerce.json theme1/src/data/_schema/dashboard.md theme1/tests/unit/dashboard-data.test.js
git commit -m "feat(dashboard): demo fixtures with documented shapes and edge cases"
```

---

### Task 2: Stat widgets

**Files:**
- Create: `theme1/src/partials/widgets/stat-tile.njk`, `stat-delta.njk`, `stat-sparkline.njk`, `stat-progress.njk`, `stat-group.njk`
- Create: `theme1/src/styles/components/_stat.scss`
- Create: `theme1/src/scripts/components/sparkline.js`
- Test: `theme1/tests/unit/widgets/stat.test.js`, `tests/unit/components/sparkline.test.js`

**Interfaces:**
- Produces: `statTile(stat, opts)`, `statDelta(delta, period)`, `statSparkline(points, opts)`, `statProgress(stat)`, `statGroup(stats, opts)`; `sparklinePath(points, width, height) => string` from `sparkline.js`.

Sparklines are drawn as inline SVG by us — pulling ApexCharts into a 60 × 20 tile would cost 130 KB for a polyline.

- [ ] **Step 1: Write the failing test**

`sparkline.test.js` tests the path maths directly:

```js
import { describe, it, expect } from 'vitest';
import { sparklinePath } from '../../../src/scripts/components/sparkline.js';

describe('sparklinePath', () => {
  it('maps the first and last points to the horizontal extremes', () => {
    const d = sparklinePath([0, 10], 100, 20);
    expect(d).toMatch(/^M0[, ]/);
    expect(d).toContain('100');
  });
  it('draws the maximum at the top and the minimum at the bottom', () => {
    const d = sparklinePath([0, 10], 100, 20);
    expect(d).toContain('20');
    expect(d).toContain('0');
  });
  it('draws a flat line through the middle when every value is equal', () => {
    const d = sparklinePath([5, 5, 5], 100, 20);
    expect(d).toMatch(/10/);
    expect(d).not.toContain('NaN');
  });
  it('handles a single point without dividing by zero', () => {
    expect(sparklinePath([5], 100, 20)).not.toContain('NaN');
  });
  it('returns an empty path for no points', () => {
    expect(sparklinePath([], 100, 20)).toBe('');
  });
  it('handles negative values', () => {
    expect(sparklinePath([-10, 0, 10], 100, 20)).not.toContain('NaN');
  });
  it('ignores null entries rather than emitting NaN', () => {
    expect(sparklinePath([1, null, 3], 100, 20)).not.toContain('NaN');
  });
  it('is deterministic', () => {
    expect(sparklinePath([1, 2, 3], 100, 20)).toBe(sparklinePath([1, 2, 3], 100, 20));
  });
});
```

`stat.test.js` asserts the rendered widget: the value is formatted through `format.js`; a currency stat renders its symbol; a zero value renders `0`, not an em dash; a positive delta gets the success tokens and an up arrow, a negative delta the danger tokens and a down arrow, and a zero delta a neutral treatment; the delta's meaning is in text for screen readers, not only in colour and glyph; a long label truncates with `text-overflow` while the full text stays in a `title`; the loading state renders skeletons; and the empty state renders when `value` is `null`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/sparkline.test.js tests/unit/widgets/stat.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`sparklinePath` normalises to the min/max range, guarding the zero-range case by drawing through the vertical centre.

The delta must never rely on colour alone — render an arrow icon **and** a visually-hidden "increased by" / "decreased by" so the direction survives both colour-blindness and a screen reader.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/sparkline.test.js tests/unit/widgets/stat.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/partials/widgets/ theme1/src/styles/components/_stat.scss theme1/src/scripts/components/sparkline.js theme1/tests/unit/
git commit -m "feat(dashboard): stat tiles, deltas and in-house sparklines"
```

---

### Task 3: Chart, list and people widgets

**Files:**
- Create: the remaining 19 widget macros in `theme1/src/partials/widgets/`
- Create: `theme1/src/styles/components/_widget.scss`
- Test: `theme1/tests/unit/widgets/widget-contract.test.js`

**Interfaces:**
- Consumes: `chart-card`, `table()`, `avatar()`, `timeline()`, `emptyState()`, `skeleton()`.
- Produces: the full catalogue listed above.

- [ ] **Step 1: Write the failing test**

Create a **contract test** that runs over every widget rather than one test per widget — this is what keeps 24 widgets honest without 24 near-identical files:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { JSDOM } from 'jsdom';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = fileURLToPath(new URL('../../../src', import.meta.url));
const env = nunjucks.configure([srcDir], { autoescape: true, noCache: true });

const widgets = (await readdir(path.join(srcDir, 'partials/widgets'))).filter((f) => f.endsWith('.njk'));

const camel = (file) => path.basename(file, '.njk').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Minimal but valid data for every widget, keyed by file name. */
const FIXTURES = {
  /* filled in as each widget lands; a widget with no fixture fails the first test */
};

describe('widget catalogue', () => {
  it('has exactly the twenty-four catalogued widgets', () => {
    expect(widgets).toHaveLength(24);
  });

  it('has a fixture for every widget', () => {
    expect(widgets.filter((w) => !(w in FIXTURES))).toEqual([]);
  });
});

describe.each(widgets)('%s', (file) => {
  const render = (data) =>
    new JSDOM(
      `<body>${env.renderString(`{% from "partials/widgets/${file}" import ${camel(file)} %}{{ ${camel(file)}(data, opts) }}`, { data, opts: {} })}</body>`,
    ).window.document;

  it('renders with valid data', () => {
    expect(render(FIXTURES[file]).body.children.length).toBeGreaterThan(0);
  });

  it('renders an empty state rather than blank output for empty data', () => {
    const doc = render(FIXTURES[`${file}:empty`] ?? {});
    expect(doc.body.textContent.trim().length, 'empty data must still say something').toBeGreaterThan(0);
  });

  it('starts with a heading, so the dashboard has an outline', () => {
    const doc = render(FIXTURES[file]);
    expect(doc.querySelector('h2, h3, h4, [role="heading"]')).not.toBeNull();
  });

  it('escapes text content', () => {
    const hostile = JSON.parse(JSON.stringify(FIXTURES[file]).replaceAll(/"([A-Za-z ]{4,})"/g, '"<img src=x>"'));
    expect(render(hostile).querySelector('img')).toBeNull();
  });

  it('gives every icon-only control an accessible name', () => {
    for (const button of render(FIXTURES[file]).querySelectorAll('button')) {
      const named = button.textContent.trim() || button.getAttribute('aria-label');
      expect(named, button.outerHTML.slice(0, 100)).toBeTruthy();
    }
  });

  it('uses no inline style with a hard-coded colour', () => {
    const html = render(FIXTURES[file]).body.innerHTML;
    expect(html).not.toMatch(/style="[^"]*#[0-9a-f]{3,6}/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/widgets/widget-contract.test.js`
Expected: FAIL — the catalogue is incomplete.

- [ ] **Step 3: Build the widgets, adding a fixture as each lands**

Work through the catalogue. Notable requirements:

- `chart-card` renders a `<figure>` with a `<figcaption>`, the chart container, and the visually-hidden data table from Phase 05.
- `goal-radial` exposes its value through `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and an `aria-label`.
- `transaction-list` and `activity-feed` use `<ol>`, since order is meaningful, with a relative timestamp in a `<time datetime>` element.
- `browser-table` and `top-products` use the Phase 05 `table()` macro with the generic role icons from Phase 06 — **not** browser logos.
- `team-card` uses `avatarGroup` with an overflow counter.
- `support-tracker` combines a radial with three stat rows and must stay legible at 320 px.
- `upgrade-card` and `meetup-card` use Phase 06 illustrations.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/widgets/`
Expected: PASS — 2 + 24 × 6 = 146 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/partials/widgets/ theme1/src/styles/components/_widget.scss theme1/tests/unit/widgets/
git commit -m "feat(dashboard): the full twenty-four widget catalogue"
```

---

### Task 4: The two dashboards

**Files:**
- Create: `theme1/src/pages/dashboard-analytics.njk`, `dashboard-ecommerce.njk`
- Modify: `theme1/src/pages/index.njk`
- Create: `theme1/src/scripts/pages/dashboard-analytics.js`, `dashboard-ecommerce.js`
- Create: `theme1/src/styles/pages/_dashboard.scss`
- Test: `theme1/tests/layout/responsive.test.js`

**Interfaces:**
- Consumes: fixtures and widgets.
- Produces: the responsive gate.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/layout/responsive.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
const PAGES = ['dashboard-analytics.html', 'dashboard-ecommerce.html', 'index.html'];

describe.each(PAGES)('%s', (file) => {
  it('lays widgets out on a grid rather than fixed columns', async () => {
    const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
    expect(doc.querySelector('.t-dashboard, .t-dashboard__grid')).not.toBeNull();
  });

  it('declares no fixed pixel width in an inline style', async () => {
    const html = await readFile(path.join(distDir, file), 'utf8');
    expect(html).not.toMatch(/style="[^"]*width:\s*\d{3,}px/);
  });

  it('has exactly one h1 and never skips a heading level', async () => {
    const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    const levels = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('gives every chart container an accessible fallback table', async () => {
    const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
    for (const chart of doc.querySelectorAll('[data-t-chart]')) {
      const describedBy = chart.getAttribute('aria-describedby');
      expect(describedBy, chart.outerHTML.slice(0, 100)).toBeTruthy();
      expect(doc.getElementById(describedBy)).not.toBeNull();
    }
  });

  it('references no raster image', async () => {
    const html = await readFile(path.join(distDir, file), 'utf8');
    expect(html).not.toMatch(/\.(png|jpe?g|gif|webp|avif)("|')/i);
  });
});

describe('dashboard grid CSS', () => {
  it('uses auto-fit minmax so it reflows at every width without breakpoint stacking', async () => {
    const fg = (await import('fast-glob')).default;
    const [cssFile] = await fg('assets/*.css', { cwd: distDir, absolute: true });
    const css = await readFile(cssFile, 'utf8');
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/layout/responsive.test.js`
Expected: FAIL — the dashboards do not exist.

- [ ] **Step 3: Build the dashboards**

`dashboard-analytics.njk`: greeting card, four stat tiles, a support tracker, an area chart of sessions, a donut of sessions by device, a radial goal, a browser/source table, a timeline, and a team card.

`dashboard-ecommerce.njk`: congratulations card, a stat group of six, a revenue report combining a column and line series, an order/profit pair, sales by region, a top-products table, a transactions list, and an upgrade card.

`index.njk` extends `dashboard-ecommerce.njk` and adds a canonical link to it — the source template shipped a byte-level duplicate; we emit an alias instead.

`_dashboard.scss` uses `grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr))` with `grid-column: span N` modifiers, so widgets reflow continuously rather than snapping at breakpoints. This is what makes the 320 px → 3840 px requirement achievable without a breakpoint per widget.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/layout/responsive.test.js`
Expected: PASS.

- [ ] **Step 5: Manual responsive sweep**

Open each dashboard and step the viewport through 320, 375, 414, 768, 1024, 1280, 1440, 1920, 2560 and 3840 px, in both themes and both directions. Confirm: nothing overflows horizontally; no text is clipped; charts resize; tables scroll inside their own container rather than pushing the page wide; and the 3840 px view does not stretch a single widget across the whole screen.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/pages/dashboard-analytics.njk theme1/src/pages/dashboard-ecommerce.njk theme1/src/pages/index.njk theme1/src/scripts/pages/ theme1/src/styles/pages/_dashboard.scss theme1/tests/layout/responsive.test.js
git commit -m "feat(dashboard): analytics and ecommerce dashboards on a fluid grid"
```

---

### Task 5: The five card pages and the phase gate

**Files:**
- Create: `theme1/src/pages/card-basic.njk`, `card-advance.njk`, `card-statistics.njk`, `card-analytics.njk`, `card-actions.njk`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/src/data/navigation.json`

- [ ] **Step 1: Build the five pages**

| Page | Contents |
|---|---|
| `card-basic` | Every structural variant: header/footer, image top, image overlay, deck, group, columns, masonry, coloured headers × 6, no-padding, bordered, elevated, link card |
| `card-advance` | Composite widgets: transactions, activity, meetup, support tracker, team, upgrade, timeline |
| `card-statistics` | Every stat tile shape, icon placements, sparkline tiles, progress tiles, and a stat group |
| `card-analytics` | Every chart-embedded card, including the radial goal and region map card |
| `card-actions` | Collapse, refresh, fullscreen, remove — individually and combined, plus a card whose remove is cancelled by a listener |

- [ ] **Step 2: Verify the interactive card actions by hand**

On `card-actions.html`: collapse and expand a card; refresh one and confirm the busy overlay clears; enter and leave fullscreen with both the button and `Escape`; remove a card and confirm focus lands somewhere sensible rather than on `<body>`; and confirm the cancel-on-remove card stays put.

- [ ] **Step 3: Extend the gates**

Add all seven pages to `PAGES` in `tests/a11y/style-guide.test.js` and to `navigation.json` under "Dashboards" and "User Interface → Card".

- [ ] **Step 4: Run the full gate**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run check:budgets
```

Expected: every command exits 0. If the budget fails, confirm ApexCharts is still dynamically imported and is not pulled in by a widget macro's inline script.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/pages/card-*.njk theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json
git commit -m "feat(dashboard): five card demo pages"
```

---

## Phase exit checklist

- [ ] Both dashboards and all five card pages build and appear in the navigation.
- [ ] All 24 widgets pass the contract test: render, empty state, heading, escaping, named controls, no inline hex.
- [ ] Every chart has an accessible fallback table wired through `aria-describedby`.
- [ ] Stat deltas convey direction through icon and text, never colour alone.
- [ ] Fixtures include a zero, a negative delta, a value above 900 million, a >40-character label, and a null cell — and all render correctly.
- [ ] The dashboard grid reflows continuously from 320 px to 3840 px with no horizontal overflow.
- [ ] Sparklines are inline SVG; ApexCharts is not in the shared chunk.
- [ ] No raster image is referenced by any dashboard or card page.
- [ ] `npm run test:a11y` clean on all seven pages in both themes.
- [ ] CI green.

**Unblocks:** nothing directly — Phases 08–12 run in parallel with this one.
