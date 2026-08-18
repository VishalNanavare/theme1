# Phase 05 — Data Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tables, data tables, charts, and maps — with a theme-aware chart layer that recolours on theme change, a table shell that stays accessible at 500 rows, and every heavy library lazy-loaded.

**Architecture:** A `table()` macro owns semantic table markup; a `dataTable` adapter layers sorting, filtering, paging, selection, and export on top of it. Charts go through one `chartTheme()` module that reads our CSS custom properties at runtime and rebuilds the palette on `theme:change`, so charts are never hard-coded to a colour. ApexCharts, Chart.js, ag-Grid, DataTables, and Leaflet are all dynamic imports.

**Tech Stack:** ApexCharts (MIT) · Chart.js (MIT) · DataTables (MIT) · ag-Grid Community (MIT) · Leaflet (BSD-2-Clause) · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery** — this is the constraint that forces a DataTables decision; see Task 3.
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. **ag-Grid (935 KB), ApexCharts, Chart.js and Leaflet must never enter the shared chunk.**
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/partials/ui/table.njk` | Semantic table markup macro |
| `src/scripts/components/table-sort.js` | Client-side column sorting |
| `src/scripts/components/table-select.js` | Row selection with a header tri-state box |
| `src/scripts/components/data-table.js` | The full data-table controller |
| `src/scripts/core/format.js` | Locale-aware number, currency, date, and relative-time formatting |
| `src/scripts/core/export.js` | CSV / JSON export, and print |
| `src/scripts/charts/chart-theme.js` | Token-derived palette, rebuilt on `theme:change` |
| `src/scripts/charts/apex.js`, `chartjs.js` | Chart adapters |
| `src/scripts/components/map.js` | Leaflet adapter |
| `src/styles/components/_table.scss`, `_data-table.scss`, `_chart.scss`, `_map.scss` | Styling |
| `src/pages/table-*.njk`, `chart-*.njk`, `maps-leaflet.njk` | The 8 demo pages |

---

### Task 1: Formatting utilities

**Files:**
- Create: `theme1/src/scripts/core/format.js`
- Test: `theme1/tests/unit/format.test.js`

**Interfaces:**
- Produces:
  - `formatNumber(value, { locale, decimals, compact }) => string`
  - `formatCurrency(minorUnits: number, { currency, locale }) => string` — **takes minor units (cents)**, never floats
  - `formatPercent(fraction, { locale, decimals }) => string`
  - `formatDate(value, { locale, style, timeZone }) => string`
  - `formatRelative(value, { locale, now }) => string`
  - `formatBytes(n) => string` — **moved here** from `components/file-upload.js`, where Phase 04 first defined it. Phases 04 and 05 can run in parallel, so whichever lands second performs the move: delete the copy in `file-upload.js`, re-export from `format.js`, update the import, and re-run `tests/unit/components/file-upload.test.js` unchanged.
  - `toMinorUnits(amount: string|number, currency) => number`, `fromMinorUnits(minor, currency) => number`

Currency is handled in integer minor units throughout the theme, because invoice totals computed in floats drift — this is the spec's §10 "data correctness" requirement made concrete.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/format.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, formatPercent, formatDate, formatRelative, toMinorUnits, fromMinorUnits } from '../../src/scripts/core/format.js';

describe('formatNumber', () => {
  it('groups thousands for the locale', () => {
    expect(formatNumber(1234567, { locale: 'en-US' })).toBe('1,234,567');
    expect(formatNumber(1234567, { locale: 'de-DE' })).toBe('1.234.567');
  });
  it('formats zero and negatives', () => {
    expect(formatNumber(0, { locale: 'en-US' })).toBe('0');
    expect(formatNumber(-42, { locale: 'en-US' })).toBe('-42');
  });
  it('compacts large values', () => {
    expect(formatNumber(1500, { locale: 'en-US', compact: true })).toBe('1.5K');
    expect(formatNumber(2400000, { locale: 'en-US', compact: true })).toBe('2.4M');
  });
  it('returns an em dash for null and undefined rather than "NaN"', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });
  it('handles the very large number the spec calls out', () => {
    expect(formatNumber(999999999, { locale: 'en-US' })).toBe('999,999,999');
  });
});

describe('minor units', () => {
  it('converts a decimal string to integer cents without drift', () => {
    expect(toMinorUnits('19.99', 'USD')).toBe(1999);
    expect(toMinorUnits('0.1', 'USD')).toBe(10);
    expect(toMinorUnits(1.005, 'USD')).toBe(101);
  });
  it('respects zero-decimal currencies', () => {
    expect(toMinorUnits('1500', 'JPY')).toBe(1500);
    expect(fromMinorUnits(1500, 'JPY')).toBe(1500);
  });
  it('round-trips', () => {
    expect(fromMinorUnits(toMinorUnits('123.45', 'USD'), 'USD')).toBe(123.45);
  });
  it('sums exactly where floats would not', () => {
    const items = ['0.10', '0.20', '0.30'].map((v) => toMinorUnits(v, 'USD'));
    expect(items.reduce((a, b) => a + b, 0)).toBe(60);
    expect(fromMinorUnits(60, 'USD')).toBe(0.6);
  });
});

describe('formatCurrency', () => {
  it('formats minor units in the locale currency', () => {
    expect(formatCurrency(199900, { currency: 'USD', locale: 'en-US' })).toBe('$1,999.00');
  });
  it('formats zero-decimal currencies without decimals', () => {
    expect(formatCurrency(1500, { currency: 'JPY', locale: 'ja-JP' })).toContain('1,500');
  });
  it('formats negatives', () => {
    expect(formatCurrency(-500, { currency: 'USD', locale: 'en-US' })).toContain('5.00');
  });
  it('returns an em dash for null', () => {
    expect(formatCurrency(null, { currency: 'USD' })).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats a fraction, not a whole number', () => {
    expect(formatPercent(0.124, { locale: 'en-US', decimals: 1 })).toBe('12.4%');
  });
  it('formats zero and values above one', () => {
    expect(formatPercent(0, { locale: 'en-US' })).toBe('0%');
    expect(formatPercent(1.5, { locale: 'en-US' })).toBe('150%');
  });
});

describe('formatDate', () => {
  it('formats in the requested time zone, not the runner\'s', () => {
    const utcMidnight = '2026-08-18T00:30:00Z';
    expect(formatDate(utcMidnight, { locale: 'en-US', style: 'short', timeZone: 'UTC' })).toContain('8/18/2026');
    expect(formatDate(utcMidnight, { locale: 'en-US', style: 'short', timeZone: 'America/Los_Angeles' })).toContain('8/17/2026');
  });
  it('returns an em dash for an invalid date instead of "Invalid Date"', () => {
    expect(formatDate('not a date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-08-18T12:00:00Z');
  it.each([
    ['2026-08-18T11:59:30Z', 'seconds'],
    ['2026-08-18T11:30:00Z', 'minutes'],
    ['2026-08-18T09:00:00Z', 'hours'],
    ['2026-08-15T12:00:00Z', 'days'],
  ])('describes %s in %s', (value, unit) => {
    expect(formatRelative(value, { locale: 'en-US', now })).toMatch(new RegExp(unit.slice(0, -1)));
  });
  it('handles the future', () => {
    expect(formatRelative('2026-08-19T12:00:00Z', { locale: 'en-US', now })).toMatch(/tomorrow|in 1 day/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/format.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scripts/core/format.js`**

Build on `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat`. Cache formatter instances in a `Map` keyed by their options — constructing an `Intl` formatter per table cell is the single easiest way to make a 500-row table slow.

`toMinorUnits` derives the exponent from `Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits`, then scales through a string to avoid `1.005 * 100 === 100.49999999999999`.

Every formatter returns `'—'` for `null`, `undefined`, `NaN`, and invalid dates.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/format.test.js`
Expected: PASS — 22 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/scripts/core/format.js theme1/tests/unit/format.test.js
git commit -m "feat(data): locale-aware formatting with integer currency arithmetic"
```

---

### Task 2: Table macro, sorting, and selection

**Files:**
- Create: `theme1/src/partials/ui/table.njk`
- Create: `theme1/src/styles/components/_table.scss`
- Create: `theme1/src/scripts/components/table-sort.js`, `table-select.js`
- Create: `theme1/src/pages/table-bootstrap.njk`
- Test: `theme1/tests/unit/components/table-sort.test.js`, `table-select.test.js`

**Interfaces:**
- Produces:
  - `table(opts)` — `{ caption, captionVisible, columns, rows, density, striped, bordered, hover, stickyHeader, responsive, selectable, emptyMessage }`
  - `compareValues(a, b, type) => number` and `sortRows(rows, index, direction, type)` from `table-sort.js`
  - `getSelection(el)`, `setSelection(el, ids)`, `selectAll(el)`, `clearSelection(el)` from `table-select.js`; event `table:selection`

- [ ] **Step 1: Write the failing tests**

`table-sort.test.js` tests the comparator directly:

```js
import { describe, it, expect } from 'vitest';
import { compareValues, sortRows } from '../../../src/scripts/components/table-sort.js';

describe('compareValues', () => {
  it('sorts text case-insensitively and locale-aware', () => {
    expect(compareValues('apple', 'Banana', 'text')).toBeLessThan(0);
    expect(compareValues('Ä', 'B', 'text')).toBeLessThan(0);
  });
  it('sorts numbers numerically, not lexically', () => {
    expect(compareValues('9', '10', 'number')).toBeLessThan(0);
    expect(compareValues('-5', '3', 'number')).toBeLessThan(0);
  });
  it('sorts currency strings by value', () => {
    expect(compareValues('$1,200.00', '$900.00', 'currency')).toBeGreaterThan(0);
  });
  it('sorts dates chronologically', () => {
    expect(compareValues('2026-01-02', '2026-01-10', 'date')).toBeLessThan(0);
  });
  it('sorts empty values last regardless of direction', () => {
    expect(compareValues('', 'a', 'text')).toBeGreaterThan(0);
    expect(compareValues('—', 'a', 'text')).toBeGreaterThan(0);
  });
  it('returns 0 for equal values so the sort stays stable', () => {
    expect(compareValues('a', 'a', 'text')).toBe(0);
  });
});

describe('sortRows', () => {
  const rows = [
    ['b', '2', '2026-01-02'],
    ['a', '10', '2026-01-01'],
    ['c', '1', '2026-01-03'],
  ];
  it('sorts ascending and descending', () => {
    expect(sortRows(rows, 0, 'asc', 'text').map((r) => r[0])).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, 0, 'desc', 'text').map((r) => r[0])).toEqual(['c', 'b', 'a']);
  });
  it('sorts numbers correctly', () => {
    expect(sortRows(rows, 1, 'asc', 'number').map((r) => r[1])).toEqual(['1', '2', '10']);
  });
  it('does not mutate the input', () => {
    const copy = rows.map((r) => [...r]);
    sortRows(rows, 0, 'asc', 'text');
    expect(rows).toEqual(copy);
  });
  it('is stable for equal keys', () => {
    const ties = [['a', 'first'], ['a', 'second'], ['a', 'third']];
    expect(sortRows(ties, 0, 'asc', 'text').map((r) => r[1])).toEqual(['first', 'second', 'third']);
  });
  it('handles an empty row set', () => {
    expect(sortRows([], 0, 'asc', 'text')).toEqual([]);
  });
});
```

`table-select.test.js` covers the tri-state header checkbox: unchecked with nothing selected; checked with everything selected; **indeterminate** with a partial selection; clicking it selects all then clears all; `Shift`-clicking a row checkbox selects the contiguous range; the selection count is announced in a live region; and the selection survives a sort but is cleared by a filter that removes selected rows.

The sort DOM tests must also assert the ARIA contract: sortable headers are `<th scope="col">` containing a `<button>`; `aria-sort` is `none`/`ascending`/`descending` and only **one** header carries a non-`none` value; and the sort change is announced.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/table-sort.test.js tests/unit/components/table-select.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both modules**

`compareValues` uses `Intl.Collator` with `{ numeric: true, sensitivity: 'base' }` for text, strips currency symbols and grouping separators before `Number()` for currency, and `Date.parse` for dates. Empty values sort last by returning a fixed sign independent of direction, then the caller flips only non-empty comparisons.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS.

- [ ] **Step 5: Write the macro, styles, and demo page**

`table.njk` always emits a `<caption>` — visually hidden unless `captionVisible` — because a table without one is unnavigable by screen reader. Column headers are `<th scope="col">`; a designated row-header column is `<th scope="row">`. `responsive` wraps the table in a `tabindex="0"` scroll container with `role="region"` and an `aria-label`, so keyboard users can scroll it.

`_table.scss` covers striped, bordered, borderless, hover, three densities, coloured rows and cells for all six intents, sticky header (`position: sticky` with a background so rows do not show through), the checkbox column, the actions column pinned to the inline-end edge, and the empty state row spanning all columns.

`table-bootstrap.njk` shows every static variant, plus tables containing avatars, badges, progress bars, sparklines, and action menus.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/ui/table.njk theme1/src/styles/components/_table.scss theme1/src/scripts/components/table-sort.js theme1/src/scripts/components/table-select.js theme1/src/pages/table-bootstrap.njk theme1/tests/unit/components/
git commit -m "feat(data): accessible table macro with sorting and tri-state selection"
```

---

### Task 3: Data table controller

**Files:**
- Create: `theme1/src/scripts/components/data-table.js`
- Create: `theme1/src/scripts/core/export.js`
- Create: `theme1/src/styles/components/_data-table.scss`
- Create: `theme1/src/pages/table-datatable-basic.njk`, `table-datatable-advanced.njk`
- Test: `theme1/tests/unit/components/data-table.test.js`, `tests/unit/export.test.js`

**Decision to record:** DataTables' Bootstrap integration is jQuery-bound, and jQuery is banned. **Build the data table in-house** on Task 2's sorting and selection plus the pagination component from Phase 03. It is ~400 lines, it removes 250 KB of dependency, and it gives us the ARIA contract DataTables does not. DataTables is therefore **dropped**, not merely deferred; record this in `docs/architecture.md`.

**Interfaces:**
- Produces:
  - `dataTable` — `init`, `destroy`, `defaults`, plus `getState(el)`, `setState(el, partial)`, `reload(el)`
  - Pure helpers, tested directly: `filterRows(rows, query, columns)`, `paginate(rows, page, pageSize) => { rows, page, pageCount, from, to, total }`
  - `toCsv(columns, rows) => string`, `download(filename, mime, text)` from `export.js`
  - Events: `datatable:change`, `datatable:selection`

- [ ] **Step 1: Write the failing tests**

`data-table.test.js` covers the pure helpers first — pagination boundaries are exactly where the spec's §10 edge cases live:

```js
import { describe, it, expect } from 'vitest';
import { filterRows, paginate } from '../../../src/scripts/components/data-table.js';

const rows = Array.from({ length: 23 }, (_, i) => [`Item ${i + 1}`, String(i + 1)]);

describe('paginate', () => {
  it('returns the first page', () => {
    const result = paginate(rows, 1, 10);
    expect(result.rows).toHaveLength(10);
    expect(result).toMatchObject({ page: 1, pageCount: 3, from: 1, to: 10, total: 23 });
  });
  it('returns a partial last page', () => {
    expect(paginate(rows, 3, 10)).toMatchObject({ from: 21, to: 23, pageCount: 3 });
  });
  it('clamps a page beyond the end', () => {
    expect(paginate(rows, 99, 10).page).toBe(3);
  });
  it('clamps a page below one', () => {
    expect(paginate(rows, 0, 10).page).toBe(1);
  });
  it('handles an empty set without dividing by zero', () => {
    expect(paginate([], 1, 10)).toMatchObject({ rows: [], page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
  });
  it('handles a single page exactly filling the size', () => {
    expect(paginate(rows.slice(0, 10), 1, 10)).toMatchObject({ pageCount: 1, from: 1, to: 10 });
  });
  it('treats pageSize 0 or "all" as one page', () => {
    expect(paginate(rows, 1, 0).rows).toHaveLength(23);
    expect(paginate(rows, 1, 'all').pageCount).toBe(1);
  });
});

describe('filterRows', () => {
  it('matches case-insensitively across all columns', () => {
    expect(filterRows(rows, 'item 5', [0, 1])).toHaveLength(1);
  });
  it('returns everything for an empty query', () => {
    expect(filterRows(rows, '', [0, 1])).toHaveLength(23);
    expect(filterRows(rows, '   ', [0, 1])).toHaveLength(23);
  });
  it('returns nothing when nothing matches', () => {
    expect(filterRows(rows, 'zzz', [0, 1])).toEqual([]);
  });
  it('searches only the named columns', () => {
    expect(filterRows([['hide', 'find']], 'find', [0])).toEqual([]);
  });
  it('treats the query literally, not as a regex', () => {
    expect(() => filterRows([['a.b']], '.*', [0])).not.toThrow();
    expect(filterRows([['a.b']], '.*', [0])).toEqual([]);
  });
  it('is diacritic-insensitive so "jose" finds "José"', () => {
    expect(filterRows([['José']], 'jose', [0])).toHaveLength(1);
  });
});
```

The DOM half asserts: the empty-results state renders with the shared `emptyState` component and the search term echoed; the row count is announced via `aria-live`; changing page size returns to page 1; state is reflected in the URL query string so a filtered view is shareable and survives reload; `Escape` clears the search box; and 500 rows render in under 100 ms (measured with `performance.now()` around the render call).

`export.test.js` covers `toCsv`: header row included; commas, quotes, and newlines inside values escaped per RFC 4180; `null` rendered as empty; a leading `=`, `+`, `-`, or `@` prefixed with an apostrophe to defuse spreadsheet formula injection; and a UTF-8 BOM so Excel reads accents correctly.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/data-table.test.js tests/unit/export.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `data-table.js` and `export.js`**

The controller composes: search (debounced 200 ms) → column filters → sort → paginate → render. Rendering rebuilds only `<tbody>`, reusing row elements where the row identity is unchanged. Selection is keyed by a stable row id, not by index, so it survives sorting.

Export produces CSV and JSON in-house. **PDF and Excel export are dropped**: `pdfmake` plus `vfs_fonts` is 2 MB and `jszip` is dual MIT/GPL, which the licence audit rejects. Print-to-PDF via the browser covers the same need — implement `print(el)` which opens a print-styled view. Record this decision in `docs/architecture.md`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/data-table.test.js tests/unit/export.test.js`
Expected: PASS.

- [ ] **Step 5: Build the two demo pages**

`table-datatable-basic.njk`: search, page size, sorting, pagination, row count.
`table-datatable-advanced.njk`: column visibility, per-column filters, row grouping, selection with a bulk-action bar, expandable child rows, CSV/JSON export, print, a simulated server-side mode with a loading skeleton, and the empty state.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/components/data-table.js theme1/src/scripts/core/export.js theme1/src/styles/components/_data-table.scss theme1/src/pages/table-datatable-basic.njk theme1/src/pages/table-datatable-advanced.njk theme1/docs/architecture.md theme1/tests/unit/
git commit -m "feat(data): in-house data table, replacing jquery datatables"
```

---

### Task 4: ag-Grid page

**Files:**
- Create: `theme1/src/scripts/pages/table-ag-grid.js`
- Create: `theme1/src/styles/components/_ag-grid.scss`
- Create: `theme1/src/pages/table-ag-grid.njk`
- Test: `theme1/tests/build/lazy-chunks.test.js`

**Interfaces:**
- Consumes: `ag-grid-community` (MIT), dynamically imported.
- Produces: the proof that heavy libraries stay out of the shared chunk.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/build/lazy-chunks.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fg from 'fast-glob';
import { gzipSync } from 'node:zlib';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
const HEAVY = ['ag-grid', 'apexcharts', 'chart.js', 'quill', 'leaflet', 'plyr', 'dropzone', 'flatpickr', 'tom-select'];
let sharedJs = '';

beforeAll(async () => {
  const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const entries = [...html.matchAll(/<script[^>]+src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  for (const entry of entries) sharedJs += await readFile(path.join(distDir, entry), 'utf8');
}, 120_000);

describe('lazy loading', () => {
  it.each(HEAVY)('keeps %s out of the dashboard entry chunk', (lib) => {
    expect(sharedJs.toLowerCase()).not.toContain(lib.toLowerCase());
  });

  it('keeps the shared entry inside a strict budget', () => {
    expect(gzipSync(Buffer.from(sharedJs)).length).toBeLessThan(80 * 1024);
  });

  it('emits ag-grid as its own chunk, loaded only by its page', async () => {
    const chunks = await fg('assets/*.js', { cwd: distDir });
    const agChunks = [];
    for (const chunk of chunks) {
      const text = await readFile(path.join(distDir, chunk), 'utf8');
      if (text.includes('ag-grid') || text.includes('agGrid')) agChunks.push(chunk);
    }
    expect(agChunks.length).toBeGreaterThan(0);

    const gridPage = await readFile(path.join(distDir, 'table-ag-grid.html'), 'utf8');
    const otherPage = await readFile(path.join(distDir, 'form-input.html'), 'utf8');
    for (const chunk of agChunks) {
      expect(otherPage, `${chunk} must not be referenced by an unrelated page`).not.toContain(chunk);
    }
    expect(gridPage.length).toBeGreaterThan(0);
  });

  it('never ships a jQuery build', async () => {
    const chunks = await fg('assets/*.js', { cwd: distDir, absolute: true });
    for (const chunk of chunks) {
      const text = await readFile(chunk, 'utf8');
      expect(text, path.basename(chunk)).not.toMatch(/jQuery JavaScript Library|jquery\.min\.js/i);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/build/lazy-chunks.test.js`
Expected: FAIL — `table-ag-grid.html` does not exist.

- [ ] **Step 3: Build the page**

Install `ag-grid-community`, audit the licence, and load it in `table-ag-grid.js` via `await import()` inside an `IntersectionObserver` so the 935 KB arrives only when the grid scrolls into view. Restyle the grid from our tokens through ag-Grid's CSS variables, in both themes. Give the page a plain-table fallback and a note explaining the trade-off.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/build/lazy-chunks.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/pages/table-ag-grid.njk theme1/src/scripts/pages/table-ag-grid.js theme1/src/styles/components/_ag-grid.scss theme1/package.json theme1/tests/build/lazy-chunks.test.js
git commit -m "feat(data): ag-grid page with intersection-triggered lazy load"
```

---

### Task 5: Theme-aware chart layer

**Files:**
- Create: `theme1/src/scripts/charts/chart-theme.js`
- Create: `theme1/src/scripts/charts/apex.js`, `chartjs.js`
- Create: `theme1/src/styles/components/_chart.scss`
- Create: `theme1/src/pages/chart-apex.njk`, `chart-chartjs.njk`
- Test: `theme1/tests/unit/chart-theme.test.js`

**Interfaces:**
- Produces:
  - `readTokens(el = document.documentElement) => { series: string[8], text, textMuted, grid, surface, tooltipBg, tooltipFg }`
  - `apexBase(tokens) => object` — shared ApexCharts options
  - `chartjsBase(tokens) => object` — shared Chart.js options
  - `createChart(el, { type, data, options }) => instance` — registers for `theme:change` and rebuilds the palette
  - `destroyChart(el)`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/chart-theme.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readTokens, apexBase, chartjsBase } from '../../src/scripts/charts/chart-theme.js';

beforeEach(() => {
  const style = document.createElement('style');
  style.textContent = `:root {
    --t-chart-1:#3d5afe; --t-chart-2:#059669; --t-chart-3:#d97706; --t-chart-4:#ef4444;
    --t-chart-5:#0891b2; --t-chart-6:#202c8e; --t-chart-7:#065f46; --t-chart-8:#6b7280;
    --t-content-primary:#111827; --t-content-muted:#9ca3af;
    --t-border-subtle:#edeff2; --t-surface-raised:#ffffff; --t-font-sans:Inter,sans-serif;
  }`;
  document.head.append(style);
});

describe('readTokens', () => {
  it('reads all eight series colours in order', () => {
    const tokens = readTokens();
    expect(tokens.series).toHaveLength(8);
    expect(tokens.series[0]).toBe('#3d5afe');
    expect(tokens.series[7]).toBe('#6b7280');
  });

  it('reads text, grid and surface colours', () => {
    const tokens = readTokens();
    expect(tokens.text).toBe('#111827');
    expect(tokens.grid).toBe('#edeff2');
    expect(tokens.surface).toBe('#ffffff');
  });

  it('never returns an empty string, so charts cannot render invisible', () => {
    document.head.querySelector('style').remove();
    for (const value of Object.values(readTokens()).flat()) {
      expect(value).toBeTruthy();
    }
  });
});

describe('apexBase', () => {
  const tokens = { series: ['#a', '#b'], text: '#111', textMuted: '#999', grid: '#eee', surface: '#fff', tooltipBg: '#000', tooltipFg: '#fff', font: 'Inter' };

  it('uses the token palette for series colours', () => {
    expect(apexBase(tokens).colors).toEqual(tokens.series);
  });

  it('disables the vendor toolbar and animations we do not want', () => {
    const base = apexBase(tokens);
    expect(base.chart.toolbar.show).toBe(false);
  });

  it('honours prefers-reduced-motion by disabling animation', () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    expect(apexBase(tokens).chart.animations.enabled).toBe(false);
  });

  it('sets the font family from tokens rather than hard-coding', () => {
    expect(apexBase(tokens).chart.fontFamily).toContain('Inter');
  });
});

describe('chartjsBase', () => {
  const tokens = { series: ['#a', '#b'], text: '#111', textMuted: '#999', grid: '#eee', surface: '#fff', tooltipBg: '#000', tooltipFg: '#fff', font: 'Inter' };

  it('is responsive without preserving aspect ratio, so it fills its card', () => {
    const base = chartjsBase(tokens);
    expect(base.responsive).toBe(true);
    expect(base.maintainAspectRatio).toBe(false);
  });

  it('colours ticks, grid and legend from tokens', () => {
    const base = chartjsBase(tokens);
    expect(base.scales.x.ticks.color).toBe('#999');
    expect(base.scales.y.grid.color).toBe('#eee');
    expect(base.plugins.legend.labels.color).toBe('#111');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/chart-theme.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the chart layer**

`readTokens` uses `getComputedStyle(el).getPropertyValue(name).trim()` with a hard-coded safe fallback per token, so a missing variable can never yield an invisible chart.

`createChart` keeps a registry of live instances and subscribes once to `theme:change`; on change it re-reads tokens and calls the vendor's update method (`updateOptions` for Apex, mutate `options` + `update('none')` for Chart.js) rather than destroying and rebuilding — rebuilding loses zoom and selection state.

Every chart gets an accessible fallback: a visually-hidden `<table>` of the same data, referenced by `aria-describedby`. A canvas alone is invisible to screen readers, and this is the single most common a11y failure in dashboard templates.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/chart-theme.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Build the two chart pages**

`chart-apex.njk`: line, area, spline, column, stacked column, bar, mixed, candlestick, heatmap, radial bar, radar, donut, pie, scatter, bubble, timeline, and sparkline — each in a card, each with the hidden data table.

`chart-chartjs.njk`: line, bar, horizontal bar, radar, doughnut, pie, polar area, bubble, scatter, and a mixed chart.

Verify by hand that switching theme in the customizer recolours **every** chart on both pages without a reload.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/charts/ theme1/src/styles/components/_chart.scss theme1/src/pages/chart-apex.njk theme1/src/pages/chart-chartjs.njk theme1/package.json theme1/tests/unit/chart-theme.test.js
git commit -m "feat(data): token-driven chart layer that recolours on theme change"
```

---

### Task 6: Maps and the phase gate

**Files:**
- Create: `theme1/src/scripts/components/map.js`
- Create: `theme1/src/styles/components/_map.scss`
- Create: `theme1/src/pages/maps-leaflet.njk`
- Create: `theme1/tests/perf/table-render.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/src/data/navigation.json`

**Interfaces:**
- Consumes: Leaflet (BSD-2-Clause), dynamically imported.
- Produces: the phase's performance and a11y gates.

- [ ] **Step 1: Write the failing performance test**

Create `theme1/tests/perf/table-render.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { paginate, filterRows } from '../../src/scripts/components/data-table.js';
import { sortRows } from '../../src/scripts/components/table-sort.js';

const rows = Array.from({ length: 500 }, (_, i) => [
  `Customer ${i}`,
  `customer${i}@example.com`,
  String((i * 37) % 1000),
  `2026-0${(i % 9) + 1}-15`,
]);

describe('500-row performance', () => {
  it('sorts in under 50 ms', () => {
    const start = performance.now();
    sortRows(rows, 2, 'asc', 'number');
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('filters in under 50 ms', () => {
    const start = performance.now();
    filterRows(rows, 'customer 4', [0, 1]);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('paginates in under 10 ms', () => {
    const start = performance.now();
    paginate(rows, 5, 25);
    expect(performance.now() - start).toBeLessThan(10);
  });

  it('sorts, filters and paginates together in under 100 ms', () => {
    const start = performance.now();
    paginate(sortRows(filterRows(rows, 'customer', [0, 1]), 0, 'asc', 'text'), 1, 25);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or passes**

Run: `cd theme1 && npx vitest run tests/perf/table-render.test.js`
Expected: PASS if Task 3 was implemented efficiently. If it fails, the usual cause is constructing an `Intl` formatter or a regex per row — hoist them.

- [ ] **Step 3: Build the map page**

`map.js` imports Leaflet dynamically. Requirements: the map container has `role="application"` and an `aria-label`; keyboard panning and zooming work; markers are focusable with accessible names; popups trap focus and close on `Escape`; the tile layer attribution is present and correct — Leaflet is BSD-2 but **tile providers have their own terms**, so use a provider whose terms permit this use and state it on the page; and a static fallback renders when JavaScript is off.

Demonstrate: base map, markers, custom marker icons drawn from our SVG set, popups, tooltips, a circle and a polygon, a marker cluster, a GeoJSON layer, and a theme-aware tile filter so the map is not blinding in dark mode.

- [ ] **Step 4: Extend the gates**

Add all 8 data-display pages to `PAGES` in `tests/a11y/style-guide.test.js` and to `navigation.json`. Add `"test:perf": "vitest run tests/perf"` to `package.json` and a CI step.

- [ ] **Step 5: Run the full gate**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:perf && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/components/map.js theme1/src/styles/components/_map.scss theme1/src/pages/maps-leaflet.njk theme1/tests/perf/table-render.test.js theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json theme1/package.json theme1/.github/workflows/ci.yml
git commit -m "feat(data): leaflet map page, perf gate and a11y coverage"
```

---

## Phase exit checklist

- [ ] All 8 data-display pages build and appear in the navigation.
- [ ] Currency arithmetic uses integer minor units everywhere; the float-drift test passes.
- [ ] Every table has a caption, `scope` on its headers, and a single `aria-sort`.
- [ ] Pagination is correct at page 1, the last page, a single page, and zero rows.
- [ ] CSV export escapes RFC 4180 correctly and defuses formula injection.
- [ ] Every chart has a visually-hidden data table and recolours on `theme:change` without a reload.
- [ ] ag-Grid, ApexCharts, Chart.js, Leaflet, Quill, Dropzone, Flatpickr and Tom Select are **absent** from the shared entry chunk.
- [ ] No jQuery build appears in any emitted chunk.
- [ ] 500-row sort + filter + paginate completes in under 100 ms.
- [ ] `npm run test:a11y` clean on all 8 pages in both themes.
- [ ] Decisions to drop DataTables, pdfmake, JSZip and Excel export are recorded in `docs/architecture.md`.
- [ ] CI green.

**Unblocks:** Phases 07–12.
