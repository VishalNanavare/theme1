# Phase 10 — Apps III: Invoice & User

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the five invoice pages and the three user pages, with invoice arithmetic that is exact by construction and a print stylesheet that produces a correct document on paper.

**Architecture:** All invoice maths lives in one pure module, `invoice.js`, operating on integer minor units — the list, preview, add, edit and print pages all read totals from it, so they cannot disagree. Print is a real `@media print` stylesheet over the same markup, not a separate page. User pages reuse the Phase 05 data table and the Phase 04 form system.

**Tech Stack:** Nunjucks · SCSS · vanilla ES modules · Vitest + jsdom

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
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **All money is integer minor units.**
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

---

### Task 1: Invoice arithmetic

**Files:**
- Create: `theme1/src/scripts/core/invoice.js`
- Create: `theme1/src/data/invoices.json`
- Test: `theme1/tests/unit/invoice.test.js`

**Interfaces:**
- Produces:
  - `lineTotal(line) => number` — `{ quantity, unitPrice, discount?, taxRate? }` → minor units
  - `computeInvoice(invoice) => { lines, subtotal, discountTotal, taxTotal, shipping, total, balanceDue, amountPaid }`
  - `invoiceStatus(invoice, now) => 'draft'|'sent'|'viewed'|'partial'|'paid'|'overdue'|'cancelled'`
  - `dueDate(issuedOn, terms) => string`
  - `nextInvoiceNumber(existing) => string`

Every returned figure is an integer in minor units. Tax is computed per line, then summed — computing tax on the summed subtotal gives a different, wrong answer whenever lines carry different rates.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/invoice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { lineTotal, computeInvoice, invoiceStatus, dueDate, nextInvoiceNumber } from '../../src/scripts/core/invoice.js';

describe('lineTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineTotal({ quantity: 3, unitPrice: 1999 })).toBe(5997);
  });
  it('is zero for zero quantity', () => {
    expect(lineTotal({ quantity: 0, unitPrice: 1999 })).toBe(0);
  });
  it('applies a percentage discount, rounded half-up', () => {
    // 5997 * 0.1 = 599.7 -> 600
    expect(lineTotal({ quantity: 3, unitPrice: 1999, discount: { type: 'percent', value: 0.1 } })).toBe(5397);
  });
  it('applies a fixed discount and never goes negative', () => {
    expect(lineTotal({ quantity: 1, unitPrice: 500, discount: { type: 'fixed', value: 900 } })).toBe(0);
  });
  it('handles a fractional quantity such as billable hours', () => {
    expect(lineTotal({ quantity: 1.5, unitPrice: 10000 })).toBe(15000);
  });
  it('returns an integer for any input combination', () => {
    expect(Number.isInteger(lineTotal({ quantity: 7, unitPrice: 333, discount: { type: 'percent', value: 0.175 } }))).toBe(true);
  });
});

describe('computeInvoice', () => {
  const invoice = {
    lines: [
      { id: 'l1', quantity: 3, unitPrice: 1999, taxRate: 0.2 },
      { id: 'l2', quantity: 1, unitPrice: 5000, taxRate: 0.05 },
    ],
    shipping: 599,
    payments: [],
  };

  it('sums line totals into the subtotal', () => {
    expect(computeInvoice(invoice).subtotal).toBe(5997 + 5000);
  });

  it('computes tax per line, not on the summed subtotal', () => {
    // per line: round(5997*0.2)=1199, round(5000*0.05)=250 -> 1449
    // on subtotal at a blended rate this would differ
    expect(computeInvoice(invoice).taxTotal).toBe(1449);
  });

  it('adds shipping to the total', () => {
    const result = computeInvoice(invoice);
    expect(result.total).toBe(result.subtotal + result.taxTotal + result.shipping - result.discountTotal);
  });

  it('subtracts payments to give the balance due', () => {
    const result = computeInvoice({ ...invoice, payments: [{ amount: 1000 }, { amount: 500 }] });
    expect(result.amountPaid).toBe(1500);
    expect(result.balanceDue).toBe(result.total - 1500);
  });

  it('never reports a negative balance due for an overpayment', () => {
    expect(computeInvoice({ ...invoice, payments: [{ amount: 999_999 }] }).balanceDue).toBe(0);
  });

  it('returns all zeros for an invoice with no lines', () => {
    const result = computeInvoice({ lines: [], payments: [] });
    expect(result).toMatchObject({ subtotal: 0, taxTotal: 0, total: 0, balanceDue: 0 });
  });

  it('keeps every returned figure an integer', () => {
    for (const [key, value] of Object.entries(computeInvoice(invoice))) {
      if (typeof value === 'number') expect(Number.isInteger(value), `${key} = ${value}`).toBe(true);
    }
  });

  it('sums 100 lines of 0.01 to exactly 1.00', () => {
    const lines = Array.from({ length: 100 }, (_, i) => ({ id: `l${i}`, quantity: 1, unitPrice: 1 }));
    expect(computeInvoice({ lines, payments: [] }).subtotal).toBe(100);
  });

  it('is deterministic — repeated computation gives the same result', () => {
    expect(computeInvoice(invoice)).toEqual(computeInvoice(invoice));
  });

  it('does not mutate the input invoice', () => {
    const copy = JSON.parse(JSON.stringify(invoice));
    computeInvoice(invoice);
    expect(invoice).toEqual(copy);
  });
});

describe('invoiceStatus', () => {
  const now = new Date('2026-08-18T00:00:00Z');
  const base = { issuedOn: '2026-07-01', dueOn: '2026-07-31', lines: [{ quantity: 1, unitPrice: 10000 }], payments: [] };

  it('reports draft when not issued', () => {
    expect(invoiceStatus({ ...base, issuedOn: null }, now)).toBe('draft');
  });
  it('reports paid when the balance is settled', () => {
    expect(invoiceStatus({ ...base, payments: [{ amount: 10000 }] }, now)).toBe('paid');
  });
  it('reports partial for an under-payment', () => {
    expect(invoiceStatus({ ...base, payments: [{ amount: 4000 }] }, now)).toBe('partial');
  });
  it('reports overdue past the due date with a balance', () => {
    expect(invoiceStatus(base, now)).toBe('overdue');
  });
  it('does not report overdue on the due date itself', () => {
    expect(invoiceStatus({ ...base, dueOn: '2026-08-18' }, now)).not.toBe('overdue');
  });
  it('prefers paid over overdue for a settled but late invoice', () => {
    expect(invoiceStatus({ ...base, payments: [{ amount: 10000 }] }, now)).toBe('paid');
  });
  it('reports cancelled regardless of payments', () => {
    expect(invoiceStatus({ ...base, cancelled: true, payments: [{ amount: 10000 }] }, now)).toBe('cancelled');
  });
});

describe('dueDate', () => {
  it.each([
    ['2026-08-18', 'net-7', '2026-08-25'],
    ['2026-08-18', 'net-15', '2026-09-02'],
    ['2026-08-18', 'net-30', '2026-09-17'],
    ['2026-08-18', 'due-on-receipt', '2026-08-18'],
  ])('adds %s + %s = %s', (issued, terms, expected) => {
    expect(dueDate(issued, terms)).toBe(expected);
  });
  it('crosses a month and year boundary correctly', () => {
    expect(dueDate('2026-12-20', 'net-30')).toBe('2027-01-19');
  });
  it('handles a leap day', () => {
    expect(dueDate('2028-01-30', 'net-30')).toBe('2028-02-29');
  });
});

describe('nextInvoiceNumber', () => {
  it('increments the highest existing number', () => {
    expect(nextInvoiceNumber(['INV-0001', 'INV-0007', 'INV-0003'])).toBe('INV-0008');
  });
  it('starts from one when there are none', () => {
    expect(nextInvoiceNumber([])).toBe('INV-0001');
  });
  it('ignores malformed entries', () => {
    expect(nextInvoiceNumber(['INV-0001', 'draft', ''])).toBe('INV-0002');
  });
  it('widens the padding past four digits', () => {
    expect(nextInvoiceNumber(['INV-9999'])).toBe('INV-10000');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/invoice.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `invoice.js` and author `invoices.json`**

Fractional quantities are the one place a non-integer enters: multiply and round once at the line level, then stay integral. Date arithmetic uses UTC-anchored `Date` construction to avoid a local-timezone shift moving a due date by a day.

`invoices.json` carries 20 invoices spanning every status, including: a zero-line draft, a heavily discounted invoice, one with mixed tax rates, one overpaid, one cancelled, one with a very long client name, and one dated in a different year.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/invoice.test.js`
Expected: PASS — 31 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/scripts/core/invoice.js theme1/src/data/invoices.json theme1/tests/unit/invoice.test.js
git commit -m "feat(invoice): exact per-line invoice arithmetic in minor units"
```

---

### Task 2: Invoice list and preview

**Files:**
- Create: `theme1/src/pages/app-invoice-list.njk`, `app-invoice-preview.njk`
- Create: `theme1/src/scripts/pages/app-invoice-list.js`
- Create: `theme1/src/styles/pages/_invoice.scss`
- Test: `theme1/tests/unit/apps/invoice-list.test.js`

**List anatomy.** A Phase 05 data table with: select-all, an ID column linking to the preview, a status column rendered as an icon badge whose tooltip states status, balance and issue date, client with avatar and email, total, issue date, balance, and a row action menu (send, preview, edit, download, duplicate, delete). Above it: search, a status filter, and a date-range filter. Below: page size and pagination.

**Preview anatomy.** A document card with logo, invoice number, issue and due dates, from/to blocks, the line-item table, totals block, notes, and payment details. Beside it, an action sidebar: send, download, print, edit, add payment.

- [ ] **Step 1: Write the failing test**

Cover the list's pure logic: `filterInvoices` by status, by search across id/client/email, by date range inclusive at both ends, and combined; sorting by total and by date; and `statusBadge(status)` returning both an intent and a **text** label, so status is never conveyed by colour alone.

Assert in the DOM that the status column's accessible name includes the status word, and that the tooltip is not the only place the status appears.

- [ ] **Step 2: Run the test to verify it fails, build both pages, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/invoice-list.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-invoice-list.njk theme1/src/pages/app-invoice-preview.njk theme1/src/scripts/pages/app-invoice-list.js theme1/src/styles/pages/_invoice.scss theme1/tests/unit/apps/invoice-list.test.js
git commit -m "feat(invoice): list with filters and document preview"
```

---

### Task 3: Invoice add and edit

**Files:**
- Create: `theme1/src/pages/app-invoice-add.njk`, `app-invoice-edit.njk`
- Create: `theme1/src/scripts/pages/app-invoice.js`
- Test: `theme1/tests/unit/apps/invoice-editor.test.js`

**Anatomy.** Header with logo, invoice number, issue date, due date. Client selector with an add-new-client option. A repeatable line-item table (Phase 04's repeater): description, quantity, unit price, discount, tax rate, and a live line total, with add and remove. A totals block recomputed on every change. A notes field. A sidebar: send, save draft, preview, payment terms, client currency toggle, and a payment-method note.

**The requirement that matters:** the totals block must update from `computeInvoice()` on every keystroke, and must never show a stale or float-derived figure.

- [ ] **Step 1: Write the failing test**

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { init, destroy, readInvoiceFromForm, renderTotals } from '../../../src/scripts/pages/app-invoice.js';

const MARKUP = `
<form data-t-invoice novalidate>
  <table data-t-invoice-lines>
    <tbody>
      <tr data-t-invoice-line data-line-id="l1">
        <td><input name="lines[0][description]" value="Design" /></td>
        <td><input name="lines[0][quantity]" type="number" value="3" /></td>
        <td><input name="lines[0][unitPrice]" type="text" value="19.99" /></td>
        <td><input name="lines[0][taxRate]" type="number" value="20" /></td>
        <td><output data-t-line-total></output></td>
      </tr>
    </tbody>
  </table>
  <input name="shipping" value="5.99" />
  <output data-t-total="subtotal"></output>
  <output data-t-total="taxTotal"></output>
  <output data-t-total="total"></output>
</form>`;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  init(document.querySelector('[data-t-invoice]'));
});

describe('readInvoiceFromForm', () => {
  it('converts decimal inputs to integer minor units', () => {
    const invoice = readInvoiceFromForm(document.querySelector('[data-t-invoice]'));
    expect(invoice.lines[0].unitPrice).toBe(1999);
    expect(invoice.shipping).toBe(599);
  });

  it('converts a percentage tax rate to a fraction', () => {
    expect(readInvoiceFromForm(document.querySelector('[data-t-invoice]')).lines[0].taxRate).toBe(0.2);
  });

  it('treats an empty numeric field as zero rather than NaN', () => {
    document.querySelector('[name="lines[0][quantity]"]').value = '';
    expect(readInvoiceFromForm(document.querySelector('[data-t-invoice]')).lines[0].quantity).toBe(0);
  });

  it('ignores a non-numeric price rather than producing NaN', () => {
    document.querySelector('[name="lines[0][unitPrice]"]').value = 'abc';
    expect(readInvoiceFromForm(document.querySelector('[data-t-invoice]')).lines[0].unitPrice).toBe(0);
  });

  it('accepts a comma decimal separator', () => {
    document.querySelector('[name="lines[0][unitPrice]"]').value = '19,99';
    expect(readInvoiceFromForm(document.querySelector('[data-t-invoice]')).lines[0].unitPrice).toBe(1999);
  });
});

describe('live totals', () => {
  it('renders totals on init', () => {
    expect(document.querySelector('[data-t-total="subtotal"]').textContent).toContain('59.97');
    expect(document.querySelector('[data-t-total="taxTotal"]').textContent).toContain('11.99');
  });

  it('recomputes when a quantity changes', () => {
    const input = document.querySelector('[name="lines[0][quantity]"]');
    input.value = '6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-t-total="subtotal"]').textContent).toContain('119.94');
  });

  it('shows a zero total when every line is emptied, not an empty string', () => {
    const input = document.querySelector('[name="lines[0][quantity]"]');
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[name="shipping"]').value = '0';
    document.querySelector('[name="shipping"]').dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-t-total="total"]').textContent).toMatch(/0\.00/);
  });

  it('never renders a float artefact such as 59.969999999', () => {
    for (const el of document.querySelectorAll('[data-t-total], [data-t-line-total]')) {
      expect(el.textContent).not.toMatch(/\d\.\d{3,}/);
    }
  });

  it('announces total changes politely', () => {
    expect(document.querySelector('[data-t-total="total"]').getAttribute('aria-live')).toBe('polite');
  });

  it('destroy() stops recomputation', () => {
    destroy(document.querySelector('[data-t-invoice]'));
    const before = document.querySelector('[data-t-total="subtotal"]').textContent;
    const input = document.querySelector('[name="lines[0][quantity]"]');
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-t-total="subtotal"]').textContent).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, build both pages, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/invoice-editor.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-invoice-add.njk theme1/src/pages/app-invoice-edit.njk theme1/src/scripts/pages/app-invoice.js theme1/tests/unit/apps/invoice-editor.test.js
git commit -m "feat(invoice): add and edit with live exact totals"
```

---

### Task 4: Print

**Files:**
- Create: `theme1/src/pages/app-invoice-print.njk`
- Create: `theme1/src/styles/base/_print.scss`
- Test: `theme1/tests/unit/print-styles.test.js`

**Interfaces:**
- Produces: a print stylesheet that applies to the invoice preview, blog detail, and any page, not just the print page.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fg from 'fast-glob';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
let printCss;

beforeAll(async () => {
  const [cssFile] = await fg('assets/*.css', { cwd: distDir, absolute: true });
  const css = await readFile(cssFile, 'utf8');
  printCss = [...css.matchAll(/@media\s+print\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
});

describe('print stylesheet', () => {
  it('exists', () => {
    expect(printCss.length).toBeGreaterThan(0);
  });

  it('hides the shell chrome', () => {
    for (const selector of ['t-sidebar', 't-navbar', 't-customizer', 't-shell__footer', 't-skip-link']) {
      expect(printCss, `must hide .${selector}`).toContain(selector);
    }
  });

  it('forces a light colour scheme regardless of the screen theme', () => {
    expect(printCss).toMatch(/color-scheme:\s*light|print-color-adjust/);
  });

  it('sets a page size and margins', () => {
    expect(printCss).toMatch(/@page/);
  });

  it('avoids breaking a table row or a card across pages', () => {
    expect(printCss).toMatch(/break-inside:\s*avoid/);
  });

  it('repeats the table header on each page', () => {
    expect(printCss).toMatch(/display:\s*table-header-group/);
  });

  it('expands link URLs so a printed page is usable', () => {
    expect(printCss).toMatch(/content:\s*" \("\s*attr\(href\)/);
  });

  it('does not print decorative artwork', () => {
    expect(printCss).toContain('t-illustration');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/unit/print-styles.test.js`
Expected: FAIL — no print stylesheet.

- [ ] **Step 3: Write `_print.scss` and the print page**

The print page uses `layouts/print.njk` — no shell at all — and auto-triggers `window.print()` behind a user-visible button rather than on load, since printing without asking is hostile.

- [ ] **Step 4: Verify on paper**

Print `app-invoice-preview.html` to PDF from Chrome and from Firefox. Confirm: no navigation chrome; the totals match the screen exactly; the line table's header repeats on page two of a long invoice; nothing is clipped at the margin; and it is legible in greyscale.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/pages/app-invoice-print.njk theme1/src/styles/base/_print.scss theme1/src/layouts/print.njk theme1/tests/unit/print-styles.test.js
git commit -m "feat(invoice): print layout and a global print stylesheet"
```

---

### Task 5: User pages

**Files:**
- Create: `theme1/src/pages/app-user-list.njk`, `app-user-view.njk`, `app-user-edit.njk`
- Create: `theme1/src/scripts/pages/app-user-list.js`
- Create: `theme1/src/data/users.json`
- Create: `theme1/src/styles/pages/_user.scss`
- Test: `theme1/tests/unit/apps/user.test.js`

**Anatomy.**

- **List** — four stat tiles across the top, then a data table with select-all, avatar + name + handle, email, role with icon, plan, billing, status badge, and an action menu. Filters for role, plan and status; search; page size.
- **View** — a profile header card (generated avatar, name, role, joined date, actions), a plan card with usage meters and upgrade, tabs for Account / Security / Billing / Notifications / Connections, a permissions table with checkboxes, an invoice list, and an activity timeline.
- **Edit** — tabs for Account / Information / Social, with an avatar upload that generates a preview, and a delete-account panel gated behind a typed confirmation.

- [ ] **Step 1: Write the failing test**

Cover: `filterUsers` by role, plan, status, and search across name/email/handle, combined conjunctively; `permissionMatrix(role)` returning the same shape for every role and defaulting unknown roles to no permissions; and the delete-confirmation gate — the delete button stays disabled until the typed text matches exactly, is case-sensitive, and re-disables if the text is then changed.

Assert in the DOM: the permissions table uses real checkboxes with row and column headers linked by `scope`; the status badge carries text, not just colour; the plan usage meter is a `role="progressbar"` with an accessible name; and the avatar upload has a labelled file input, not a bare clickable image.

- [ ] **Step 2: Run the test to verify it fails, build the three pages, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/user.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-user-*.njk theme1/src/scripts/pages/app-user-list.js theme1/src/data/users.json theme1/src/styles/pages/_user.scss theme1/tests/unit/apps/user.test.js
git commit -m "feat(user): list, view and edit with a gated delete confirmation"
```

---

### Task 6: Phase gate

**Files:**
- Create: `theme1/tests/unit/apps/invoice-consistency.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/src/data/navigation.json`

- [ ] **Step 1: Write the cross-page consistency gate**

The phase's key test: every page that shows an invoice total must show the **same** total, derived from `computeInvoice`.

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeInvoice } from '../../../src/scripts/core/invoice.js';

const rootDir = fileURLToPath(new URL('../../..', import.meta.url));

describe('invoice consistency', () => {
  it('shows the same total on the list and the preview for the same invoice', async () => {
    const invoices = JSON.parse(await readFile(path.join(rootDir, 'src/data/invoices.json'), 'utf8'));
    const listDoc = new JSDOM(await readFile(path.join(rootDir, 'dist/app-invoice-list.html'), 'utf8')).window.document;
    const previewDoc = new JSDOM(await readFile(path.join(rootDir, 'dist/app-invoice-preview.html'), 'utf8')).window.document;

    const previewId = previewDoc.querySelector('[data-t-invoice-id]')?.getAttribute('data-t-invoice-id');
    expect(previewId, 'preview must declare which invoice it shows').toBeTruthy();

    const listCell = listDoc.querySelector(`[data-t-invoice-row="${previewId}"] [data-t-total="total"]`);
    const previewCell = previewDoc.querySelector('[data-t-total="total"]');
    expect(listCell.getAttribute('data-t-price')).toBe(previewCell.getAttribute('data-t-price'));

    const source = invoices.find((i) => i.id === previewId);
    expect(Number(previewCell.getAttribute('data-t-price'))).toBe(computeInvoice(source).total);
  });

  it('renders every money figure as an integer in minor units on the element', async () => {
    for (const file of ['app-invoice-list.html', 'app-invoice-preview.html', 'app-invoice-print.html']) {
      const doc = new JSDOM(await readFile(path.join(rootDir, 'dist', file), 'utf8')).window.document;
      for (const el of doc.querySelectorAll('[data-t-price]')) {
        expect(Number.isInteger(Number(el.getAttribute('data-t-price'))), `${file}: ${el.outerHTML.slice(0, 80)}`).toBe(true);
      }
    }
  });

  it('shows no float artefact anywhere', async () => {
    for (const file of ['app-invoice-list.html', 'app-invoice-preview.html', 'app-invoice-print.html', 'app-invoice-add.html']) {
      const html = await readFile(path.join(rootDir, 'dist', file), 'utf8');
      expect(html, file).not.toMatch(/\d\.\d{6,}/);
    }
  });
});
```

- [ ] **Step 2: Run it, fix failures at source, extend the axe gate and navigation**

Add all eight pages to `PAGES` and to `navigation.json` under "Apps → Invoice" and "Apps → User".

- [ ] **Step 3: Run everything**

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/ theme1/src/data/navigation.json
git commit -m "test(invoice): cross-page total consistency gate"
```

---

## Phase exit checklist

- [ ] All eight pages build, appear in the navigation, and pass axe in both themes.
- [ ] Tax is computed per line; 100 lines of 0.01 sum to exactly 1.00; no figure is ever a non-integer.
- [ ] An overpayment reports a zero balance, never a negative one.
- [ ] Due-date arithmetic crosses month, year and leap-day boundaries correctly.
- [ ] `nextInvoiceNumber` widens past four digits and ignores malformed entries.
- [ ] The editor recomputes totals on every keystroke and renders no float artefact.
- [ ] The list and preview show the identical total for the same invoice, matching `computeInvoice`.
- [ ] Printing the preview from Chrome and Firefox yields a correct document: no chrome, repeated table header, nothing clipped, legible in greyscale.
- [ ] Status is conveyed by text as well as colour everywhere.
- [ ] Account deletion is gated behind an exact typed confirmation.
- [ ] CI green.
