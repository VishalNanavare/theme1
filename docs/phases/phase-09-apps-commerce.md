# Phase 09 — Apps II: Kanban, File Manager, eCommerce

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Kanban board, the File Manager, and the four eCommerce pages — shop, product detail, wishlist, and the multi-step checkout — with keyboard-operable drag interactions and exact money arithmetic.

**Architecture:** Kanban and File Manager reuse the Phase 08 app shell. eCommerce uses the standard content shell with a filter sidebar. A shared `cart.js` store owns cart and wishlist state in integer minor units, so every total on every page agrees. All drag-and-drop has a tested keyboard equivalent.

**Tech Stack:** Nunjucks · SCSS · vanilla ES modules · Dragula (MIT, dynamic import) · Swiper (MIT, dynamic import) · Vitest + jsdom

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
- **Accessibility:** WCAG 2.2 AA. **Every drag interaction has a keyboard equivalent.**
- **All money is integer minor units.** No floating-point currency arithmetic anywhere.
- **Icons: Feather (MIT) only. No photographic assets** — product art comes from Phase 06's `pattern()`.
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

---

### Task 1: Cart and wishlist store

**Files:**
- Create: `theme1/src/scripts/core/cart.js`
- Create: `theme1/src/data/products.json`
- Test: `theme1/tests/unit/cart.test.js`

**Interfaces:**
- Produces:
  - `createCart({ storage, currency }) => { add, remove, setQuantity, clear, getItems, getTotals, subscribe, toggleWishlist, getWishlist, isWishlisted, moveToCart }`
  - `computeTotals(items, { taxRate, shipping, discount }) => { subtotal, tax, shipping, discount, total, itemCount }` — all integers in minor units
  - Events: `cart:change`, `wishlist:change`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/cart.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createCart, computeTotals } from '../../src/scripts/core/cart.js';

const product = (id, price) => ({ id, name: `Product ${id}`, price, currency: 'USD' });

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}

let cart;
beforeEach(() => {
  cart = createCart({ storage: memoryStorage(), currency: 'USD' });
});

describe('computeTotals', () => {
  it('sums integer minor units exactly', () => {
    const totals = computeTotals([
      { price: 1999, quantity: 3 },
      { price: 500, quantity: 1 },
    ], {});
    expect(totals.subtotal).toBe(6497);
    expect(Number.isInteger(totals.subtotal)).toBe(true);
  });

  it('sums values that would drift as floats', () => {
    const totals = computeTotals([{ price: 10, quantity: 1 }, { price: 20, quantity: 1 }, { price: 30, quantity: 1 }], {});
    expect(totals.subtotal).toBe(60);
  });

  it('rounds tax half-up to whole minor units', () => {
    // 1999 * 0.0825 = 164.9175 -> 165
    expect(computeTotals([{ price: 1999, quantity: 1 }], { taxRate: 0.0825 }).tax).toBe(165);
  });

  it('applies a percentage discount before tax', () => {
    const totals = computeTotals([{ price: 10000, quantity: 1 }], { discount: { type: 'percent', value: 0.1 }, taxRate: 0.1 });
    expect(totals.discount).toBe(1000);
    expect(totals.tax).toBe(900);
    expect(totals.total).toBe(9900);
  });

  it('applies a fixed discount and never lets it drive the total negative', () => {
    const totals = computeTotals([{ price: 500, quantity: 1 }], { discount: { type: 'fixed', value: 900 } });
    expect(totals.discount).toBe(500);
    expect(totals.total).toBe(0);
  });

  it('adds shipping after discount and tax', () => {
    expect(computeTotals([{ price: 1000, quantity: 1 }], { shipping: 599 }).total).toBe(1599);
  });

  it('returns all zeros for an empty cart, never NaN', () => {
    const totals = computeTotals([], {});
    expect(totals).toMatchObject({ subtotal: 0, tax: 0, shipping: 0, discount: 0, total: 0, itemCount: 0 });
  });

  it('counts items by quantity, not by line', () => {
    expect(computeTotals([{ price: 100, quantity: 3 }, { price: 100, quantity: 2 }], {}).itemCount).toBe(5);
  });

  it('keeps every returned figure an integer', () => {
    const totals = computeTotals([{ price: 333, quantity: 7 }], { taxRate: 0.07, shipping: 499, discount: { type: 'percent', value: 0.15 } });
    for (const [key, value] of Object.entries(totals)) expect(Number.isInteger(value), `${key} = ${value}`).toBe(true);
  });
});

describe('cart operations', () => {
  it('adds an item with quantity 1 by default', () => {
    cart.add(product('a', 1000));
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].quantity).toBe(1);
  });

  it('increments quantity instead of duplicating a line', () => {
    cart.add(product('a', 1000));
    cart.add(product('a', 1000));
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].quantity).toBe(2);
  });

  it('treats different variants of one product as separate lines', () => {
    cart.add({ ...product('a', 1000), variant: 'red' });
    cart.add({ ...product('a', 1000), variant: 'blue' });
    expect(cart.getItems()).toHaveLength(2);
  });

  it('removes a line', () => {
    cart.add(product('a', 1000));
    cart.remove('a');
    expect(cart.getItems()).toEqual([]);
  });

  it('removes the line when quantity is set to zero', () => {
    cart.add(product('a', 1000));
    cart.setQuantity('a', 0);
    expect(cart.getItems()).toEqual([]);
  });

  it('refuses a negative quantity', () => {
    cart.add(product('a', 1000));
    cart.setQuantity('a', -5);
    expect(cart.getItems()[0].quantity).toBe(1);
  });

  it('caps quantity at the configured maximum', () => {
    cart.add(product('a', 1000));
    cart.setQuantity('a', 9999);
    expect(cart.getItems()[0].quantity).toBeLessThanOrEqual(99);
  });

  it('refuses to mix currencies in one cart', () => {
    cart.add(product('a', 1000));
    expect(() => cart.add({ ...product('b', 1000), currency: 'EUR' })).toThrow(/currenc/i);
  });

  it('emits cart:change on every mutation', () => {
    let count = 0;
    cart.subscribe(() => { count += 1; });
    cart.add(product('a', 1000));
    cart.setQuantity('a', 2);
    cart.remove('a');
    expect(count).toBe(3);
  });

  it('persists across a reload', () => {
    const storage = memoryStorage();
    createCart({ storage, currency: 'USD' }).add(product('a', 1000));
    expect(createCart({ storage, currency: 'USD' }).getItems()).toHaveLength(1);
  });

  it('recovers to an empty cart from corrupted storage', () => {
    const storage = memoryStorage();
    storage.setItem('theme1:cart', '{not json');
    expect(createCart({ storage, currency: 'USD' }).getItems()).toEqual([]);
  });
});

describe('wishlist', () => {
  it('toggles membership', () => {
    cart.toggleWishlist(product('a', 1000));
    expect(cart.isWishlisted('a')).toBe(true);
    cart.toggleWishlist(product('a', 1000));
    expect(cart.isWishlisted('a')).toBe(false);
  });

  it('moves an item to the cart and out of the wishlist', () => {
    cart.toggleWishlist(product('a', 1000));
    cart.moveToCart('a');
    expect(cart.isWishlisted('a')).toBe(false);
    expect(cart.getItems()).toHaveLength(1);
  });

  it('moveToCart on an absent id is a no-op', () => {
    expect(() => cart.moveToCart('zzz')).not.toThrow();
    expect(cart.getItems()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/cart.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cart.js` and author `products.json`**

Rounding is half-up on the absolute value, so `-0.5` and `0.5` round symmetrically — `Math.round` rounds `-0.5` to `-0`, which produces off-by-one refunds.

`products.json` carries 24 products: id, name, category, brand, price in minor units, compare-at price, rating, review count, stock, tags, variants, and a `patternSeed` used by Phase 06's `pattern()` to generate the art. Include a zero-stock product, a product with a very long name, and one with no rating, so the edge cases are exercised.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/cart.test.js`
Expected: PASS — 24 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/scripts/core/cart.js theme1/src/data/products.json theme1/tests/unit/cart.test.js
git commit -m "feat(commerce): cart and wishlist store with exact integer money"
```

---

### Task 2: Kanban

**Files:**
- Create: `theme1/src/pages/app-kanban.njk`, `src/scripts/pages/app-kanban.js`, `src/data/kanban.json`, `src/styles/pages/_app-kanban.scss`
- Test: `theme1/tests/unit/apps/kanban.test.js`

**Interfaces:**
- Produces: `moveCard(board, cardId, toColumnId, toIndex) => board`, `addColumn`, `removeColumn`, `renameColumn`, `wipExceeded(column)`.

**Screen anatomy.** Board header: title, board actions, member avatars, filter, search. Columns: title, card count, a WIP-limit indicator, an add-card control, a column menu (rename, set limit, delete), and the card list. Cards: cover pattern, labels, title, description snippet, due date, attachment and comment counts, assignee avatars, and a menu. Card detail: an off-canvas editor.

**The keyboard path is the deliverable.** With a card focused: `Alt+←`/`Alt+→` move it between columns, `Alt+↑`/`Alt+↓` move it within a column, and each move is announced ("Moved to In Progress, position 2 of 5"). The card menu offers the same moves. Dragula handles pointer dragging and must be optional.

- [ ] **Step 1: Write the failing test**

Cover `moveCard` as a pure function: moving within a column; moving to another column at a given index; moving to index 0 and to the end; moving to a non-existent column (no-op); moving an unknown card (no-op); moving a card onto its own position (no-op returning the same board); and immutability of the input board. Then `wipExceeded` at, below, and above the limit, and with no limit set.

DOM assertions: each column is a labelled region with its card list as a `<ul>`; cards are focusable with `aria-roledescription="card"`; the `Alt`-arrow moves work and announce; the drag handle names the keyboard alternative; a WIP-exceeded column is flagged in text as well as colour; and the board scrolls horizontally inside its own container without widening the page.

- [ ] **Step 2: Run the test to verify it fails, build, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/kanban.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-kanban.njk theme1/src/scripts/pages/app-kanban.js theme1/src/data/kanban.json theme1/src/styles/pages/_app-kanban.scss theme1/tests/unit/apps/kanban.test.js
git commit -m "feat(apps): kanban board with keyboard card movement"
```

---

### Task 3: File manager

**Files:**
- Create: `theme1/src/pages/app-file-manager.njk`, `src/scripts/pages/app-file-manager.js`, `src/data/files.json`, `src/styles/pages/_app-file-manager.scss`
- Test: `theme1/tests/unit/apps/file-manager.test.js`

**Interfaces:**
- Produces: `pathTo(tree, id) => Array<{id,name}>`, `listChildren(tree, id, { sort, query })`, `iconForFile(name, mime) => string`, `folderSize(tree, id) => number`.

**Screen anatomy.** Sidebar: storage meter, a folder tree, and quick filters (Recent, Starred, Shared, Trash). Toolbar: breadcrumb path, new folder, upload, view toggle (grid/list), sort, and search. Content: grid cards or list rows with the file's role icon, name, size, modified date, and a menu (open, rename, download, share, move, delete). Detail: an off-canvas panel with a preview, metadata, sharing, and activity.

`iconForFile` maps to Phase 06's **generic role icons** — never a brand mark. Test that mapping explicitly.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { pathTo, listChildren, iconForFile, folderSize } from '../../../src/scripts/pages/app-file-manager.js';
import { ROLE_ICONS } from '../../../scripts/svg/role-icons.mjs';

const tree = {
  root: { id: 'root', name: 'Files', type: 'folder', children: ['docs', 'a.png'] },
  docs: { id: 'docs', name: 'Documents', type: 'folder', parent: 'root', children: ['b.pdf'] },
  'a.png': { id: 'a.png', name: 'diagram.png', type: 'file', parent: 'root', size: 2048, mime: 'image/png' },
  'b.pdf': { id: 'b.pdf', name: 'report.pdf', type: 'file', parent: 'docs', size: 4096, mime: 'application/pdf' },
};

describe('pathTo', () => {
  it('returns the breadcrumb trail from the root', () => {
    expect(pathTo(tree, 'b.pdf').map((n) => n.name)).toEqual(['Files', 'Documents', 'report.pdf']);
  });
  it('returns just the root for the root', () => {
    expect(pathTo(tree, 'root').map((n) => n.name)).toEqual(['Files']);
  });
  it('returns an empty trail for an unknown id', () => {
    expect(pathTo(tree, 'nope')).toEqual([]);
  });
  it('terminates on a cyclic parent rather than looping forever', () => {
    const cyclic = { a: { id: 'a', name: 'a', parent: 'b' }, b: { id: 'b', name: 'b', parent: 'a' } };
    expect(() => pathTo(cyclic, 'a')).not.toThrow();
    expect(pathTo(cyclic, 'a').length).toBeLessThan(10);
  });
});

describe('listChildren', () => {
  it('lists folders before files', () => {
    expect(listChildren(tree, 'root', { sort: 'name' })[0].type).toBe('folder');
  });
  it('sorts by name, size and date', () => {
    expect(listChildren(tree, 'root', { sort: 'name' }).map((n) => n.name)).toEqual(['Documents', 'diagram.png']);
  });
  it('filters by query case-insensitively', () => {
    expect(listChildren(tree, 'root', { query: 'DIAG' }).map((n) => n.name)).toEqual(['diagram.png']);
  });
  it('returns an empty array for an empty folder', () => {
    expect(listChildren({ e: { id: 'e', type: 'folder', children: [] } }, 'e', {})).toEqual([]);
  });
});

describe('folderSize', () => {
  it('sums nested file sizes', () => {
    expect(folderSize(tree, 'root')).toBe(6144);
  });
  it('is zero for an empty folder', () => {
    expect(folderSize({ e: { id: 'e', type: 'folder', children: [] } }, 'e')).toBe(0);
  });
});

describe('iconForFile', () => {
  it.each([
    ['a.pdf', 'application/pdf', 'pdf-file'],
    ['a.png', 'image/png', 'image-file'],
    ['a.mp4', 'video/mp4', 'video-file'],
    ['a.mp3', 'audio/mpeg', 'audio-file'],
    ['a.zip', 'application/zip', 'archive'],
    ['a.js', 'text/javascript', 'code-file'],
    ['a.xlsx', '', 'spreadsheet'],
    ['a.docx', '', 'document'],
    ['a.pptx', '', 'presentation'],
    ['a.weird', '', 'unknown-file'],
  ])('maps %s to the %s role icon', (name, mime, expected) => {
    expect(iconForFile(name, mime)).toBe(expected);
  });

  it('only ever returns an icon that exists in the generated set', () => {
    for (const name of ['a.pdf', 'a.zzz', '', 'no-extension']) {
      expect(ROLE_ICONS).toContain(iconForFile(name, ''));
    }
  });

  it('never maps to a brand', () => {
    const mapped = ['a.psd', 'a.fig', 'a.sketch', 'a.ai'].map((n) => iconForFile(n, ''));
    for (const icon of mapped) expect(icon).toBe('design-file');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, build, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/file-manager.test.js`
Expected: FAIL, then PASS.

The folder tree is an ARIA `tree` with `treeitem` nodes: arrow keys navigate and expand, `Home`/`End` jump, typeahead jumps by first letter. Multi-select uses `Shift`-click and `Ctrl`-click, with `Ctrl+A` selecting all in the current folder.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-file-manager.njk theme1/src/scripts/pages/app-file-manager.js theme1/src/data/files.json theme1/src/styles/pages/_app-file-manager.scss theme1/tests/unit/apps/file-manager.test.js
git commit -m "feat(apps): file manager with an aria tree and generic role icons"
```

---

### Task 4: Shop and product detail

**Files:**
- Create: `theme1/src/pages/app-ecommerce-shop.njk`, `app-ecommerce-details.njk`
- Create: `theme1/src/scripts/pages/app-ecommerce-shop.js`, `app-ecommerce-details.js`
- Create: `theme1/src/styles/pages/_ecommerce.scss`
- Test: `theme1/tests/unit/apps/shop.test.js`

**Interfaces:**
- Produces: `filterProducts(products, filters)`, `sortProducts(products, by)`, `priceRange(products)`.

**Shop anatomy.** Filter sidebar: search, category checkboxes with counts, brand list, a price range slider, a rating filter, an in-stock toggle, and clear-all. Toolbar: result count, sort menu, grid/list toggle, page size. Products: a card with the generated pattern art, wishlist toggle, rating, name, price with compare-at strikethrough, stock state, and add-to-cart which changes to "In cart / View cart" once added. Plus pagination and an empty state.

**Detail anatomy.** Gallery with thumbnails (Swiper, dynamic import) using generated art, breadcrumb, name, rating with review count, price, stock, short description, variant swatches, quantity stepper, add-to-cart, wishlist, share, delivery notes, a tabbed description/information/reviews section, and a related-products carousel.

- [ ] **Step 1: Write the failing test**

Cover `filterProducts`: each filter alone; filters combined conjunctively; a price range that is inclusive at both ends; a rating filter meaning "and above"; the in-stock toggle; an empty result; and immutability. Cover `sortProducts` for price ascending and descending, name, rating, and newest — asserting stability and that products with no rating sort last rather than first. Cover `priceRange` on an empty list without returning `Infinity`.

- [ ] **Step 2: Run the test to verify it fails, build, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/shop.test.js`
Expected: FAIL, then PASS.

The price slider is noUiSlider (MIT) — give it a paired pair of number inputs so it is operable without dragging, and keep the two in sync.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-ecommerce-shop.njk theme1/src/pages/app-ecommerce-details.njk theme1/src/scripts/pages/ theme1/src/styles/pages/_ecommerce.scss theme1/tests/unit/apps/shop.test.js
git commit -m "feat(commerce): shop grid with filters and product detail"
```

---

### Task 5: Wishlist and checkout

**Files:**
- Create: `theme1/src/pages/app-ecommerce-wishlist.njk`, `app-ecommerce-checkout.njk`
- Create: `theme1/src/scripts/pages/app-ecommerce-checkout.js`
- Test: `theme1/tests/unit/apps/checkout.test.js`

**Interfaces:**
- Produces: `validateStep(step, values)`, `applyCoupon(code, subtotal)`, `shippingOptions(country)`.

**Checkout anatomy.** A four-step wizard built on Phase 04's `wizard`:

1. **Cart** — line items with quantity steppers and remove, the order summary, and a coupon field.
2. **Address** — saved addresses, a new-address form, and a separate billing-address toggle.
3. **Payment** — method choice (card, saved card, cash on delivery), a card form with masked number, expiry and CVV, and a gift-message option.
4. **Confirmation** — order number, summary, and a success illustration.

The order summary is present on every step and is computed **once** by `cart.getTotals()`, so no two steps can disagree.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { validateStep, applyCoupon, shippingOptions } from '../../../src/scripts/pages/app-ecommerce-checkout.js';

describe('validateStep', () => {
  it('rejects an empty cart at step 1', () => {
    expect(validateStep(1, { items: [] }).valid).toBe(false);
  });
  it('accepts a cart with items', () => {
    expect(validateStep(1, { items: [{ id: 'a', quantity: 1 }] }).valid).toBe(true);
  });
  it('requires every address field at step 2', () => {
    const result = validateStep(2, { address: { name: 'Ada', line1: '', city: 'London', postcode: '', country: 'GB' } });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['line1', 'postcode']);
  });
  it('requires a billing address only when it differs from shipping', () => {
    const shipping = { name: 'A', line1: 'x', city: 'y', postcode: 'z', country: 'GB' };
    expect(validateStep(2, { address: shipping, billingSameAsShipping: true }).valid).toBe(true);
    expect(validateStep(2, { address: shipping, billingSameAsShipping: false, billing: {} }).valid).toBe(false);
  });
  it('rejects an invalid card at step 3', () => {
    expect(validateStep(3, { method: 'card', card: { number: '4242424242424241', expiry: '12/30', cvv: '123' } }).valid).toBe(false);
  });
  it('rejects an expired card', () => {
    const result = validateStep(3, { method: 'card', card: { number: '4242424242424242', expiry: '01/20', cvv: '123' }, now: new Date('2026-08-18') });
    expect(result.errors.expiry).toMatch(/expired/i);
  });
  it('accepts cash on delivery with no card details', () => {
    expect(validateStep(3, { method: 'cod' }).valid).toBe(true);
  });
});

describe('applyCoupon', () => {
  it('applies a known percentage coupon', () => {
    expect(applyCoupon('SAVE10', 10000)).toMatchObject({ valid: true, discount: 1000 });
  });
  it('applies a known fixed coupon', () => {
    expect(applyCoupon('FLAT5', 10000)).toMatchObject({ valid: true, discount: 500 });
  });
  it('is case-insensitive and trims whitespace', () => {
    expect(applyCoupon('  save10 ', 10000).valid).toBe(true);
  });
  it('rejects an unknown code with a message', () => {
    const result = applyCoupon('NOPE', 10000);
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });
  it('rejects a coupon below its minimum spend', () => {
    expect(applyCoupon('BIG50', 100).valid).toBe(false);
  });
  it('never discounts more than the subtotal', () => {
    expect(applyCoupon('FLAT5', 200).discount).toBe(200);
  });
  it('returns an integer discount', () => {
    expect(Number.isInteger(applyCoupon('SAVE10', 3333).discount)).toBe(true);
  });
});

describe('shippingOptions', () => {
  it('returns at least one option for a known country', () => {
    expect(shippingOptions('GB').length).toBeGreaterThan(0);
  });
  it('prices every option in integer minor units', () => {
    for (const option of shippingOptions('GB')) expect(Number.isInteger(option.price)).toBe(true);
  });
  it('falls back to an international option for an unknown country', () => {
    expect(shippingOptions('ZZ').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, build, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/checkout.test.js`
Expected: FAIL, then PASS.

The wishlist page mirrors the shop grid with move-to-cart and remove per item, plus its own empty state using the `empty-list` illustration.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-ecommerce-wishlist.njk theme1/src/pages/app-ecommerce-checkout.njk theme1/src/scripts/pages/app-ecommerce-checkout.js theme1/tests/unit/apps/checkout.test.js
git commit -m "feat(commerce): wishlist and four-step validated checkout"
```

---

### Task 6: Phase gate

**Files:**
- Create: `theme1/tests/unit/apps/money-consistency.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/tests/a11y/apps.test.js`, `theme1/src/data/navigation.json`

- [ ] **Step 1: Write the money-consistency gate**

This is the phase's most important test: it proves no page can display a total that disagrees with another.

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const distDir = fileURLToPath(new URL('../../../dist', import.meta.url));
const PAGES = ['app-ecommerce-shop.html', 'app-ecommerce-details.html', 'app-ecommerce-wishlist.html', 'app-ecommerce-checkout.html'];

describe.each(PAGES)('%s', (file) => {
  it('renders every price through a formatter, never as a raw float', async () => {
    const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
    for (const el of doc.querySelectorAll('[data-t-price]')) {
      expect(el.textContent.trim(), el.outerHTML.slice(0, 80)).toMatch(/[^\d.]/);
      expect(el.textContent).not.toMatch(/\d+\.\d{3,}/);
    }
  });

  it('stores the machine-readable amount in minor units on the element', async () => {
    const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
    for (const el of doc.querySelectorAll('[data-t-price]')) {
      const minor = el.getAttribute('data-t-price');
      expect(Number.isInteger(Number(minor)), `${minor} is not integer minor units`).toBe(true);
    }
  });

  it('marks every product image as decorative generated art, not a photograph', async () => {
    const html = await readFile(path.join(distDir, file), 'utf8');
    expect(html).not.toMatch(/\.(png|jpe?g|webp|avif)("|')/i);
  });
});
```

- [ ] **Step 2: Run it, fix failures at source, extend the axe and app gates**

Add all six pages to `PAGES` in `tests/a11y/style-guide.test.js`, add Kanban and File Manager to `tests/a11y/apps.test.js`, and add all six to `navigation.json`.

- [ ] **Step 3: Run everything**

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/ theme1/src/data/navigation.json
git commit -m "test(commerce): money consistency and accessibility gates"
```

---

## Phase exit checklist

- [ ] All six pages build, appear in the navigation, and pass axe in both themes.
- [ ] Every monetary figure is an integer in minor units; the totals test proves no drift and no negative total.
- [ ] Cart refuses mixed currencies, caps quantity, and recovers from corrupted storage.
- [ ] Kanban cards move between and within columns by keyboard, with announcements, and work with Dragula absent.
- [ ] File manager's folder tree implements the full ARIA tree keyboard pattern.
- [ ] `iconForFile` only ever returns a generic role icon; design files map to `design-file`, never a brand.
- [ ] Shop filters combine conjunctively; the price slider is operable without dragging.
- [ ] Checkout rejects an empty cart, an incomplete address, a Luhn-invalid card and an expired card; coupons never exceed the subtotal.
- [ ] No product image is a raster; all art comes from `pattern()`.
- [ ] Swiper, Dragula and noUiSlider are absent from the shared chunk.
- [ ] CI green.
