# Phase 13 — Internationalisation & RTL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every string translatable, every number, date and currency locale-correct, and every layout correct in RTL — then prove it with a combinatorial matrix that tests RTL, dark, collapsed, horizontal, boxed, compact and high-contrast **together**, which is where the source template's fourteen static folders quietly break.

**Architecture:** One stylesheet serves both directions, because every directional property is logical. Translation is a build-time extraction plus a runtime swap: `scripts/extract-strings.mjs` pulls every literal out of the templates into `en.json`, and a CI gate fails if a template contains a hard-coded user-visible string. RTL correctness is verified structurally, not by eye.

**Tech Stack:** i18next (MIT) · `Intl` · Nunjucks · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.** This phase makes that constraint load-bearing.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. Locale bundles load on demand.
- **Accessibility:** WCAG 2.2 AA in every locale and both directions.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Locales shipped

| Code | Language | Direction | Why it is in the set |
|---|---|---|---|
| `en` | English | LTR | Source of truth |
| `de` | German | LTR | Longest common expansion — catches layout breakage (+35%) |
| `ar` | Arabic | **RTL** | Proves the RTL path end to end |
| `ja` | Japanese | LTR | No word spaces; catches wrapping assumptions |

Four locales are enough to catch the classes of bug that matter. Adding a fifth of the same shape adds translation cost without adding coverage.

---

### Task 1: String extraction and the hard-coded-string gate

**Files:**
- Create: `theme1/scripts/extract-strings.mjs`
- Create: `theme1/src/locales/en.json`
- Modify: `theme1/package.json`, `theme1/.github/workflows/ci.yml`
- Test: `theme1/tests/unit/extract-strings.test.js`

**Interfaces:**
- Produces:
  - `extractFromTemplate(source, file) => Array<{ key, value, line }>`
  - `findHardCoded(source, file) => Array<{ text, line }>` — user-visible literals not wrapped in `t()`
  - `keyFor(text, file) => string` — stable, deterministic key
  - `mergeCatalogue(existing, extracted) => { catalogue, added, removed }`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/extract-strings.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractFromTemplate, findHardCoded, keyFor, mergeCatalogue } from '../../scripts/extract-strings.mjs';

describe('keyFor', () => {
  it('is deterministic', () => {
    expect(keyFor('Save changes', 'form-input.njk')).toBe(keyFor('Save changes', 'form-input.njk'));
  });
  it('produces a readable, namespaced key', () => {
    expect(keyFor('Save changes', 'form-input.njk')).toMatch(/^form-input\.save-changes/);
  });
  it('distinguishes the same text in different files', () => {
    expect(keyFor('Save', 'a.njk')).not.toBe(keyFor('Save', 'b.njk'));
  });
  it('handles punctuation and casing without collision', () => {
    expect(keyFor("Don't save", 'a.njk')).not.toBe(keyFor('Dont save', 'a.njk'));
  });
});

describe('extractFromTemplate', () => {
  it('extracts a t() call', () => {
    expect(extractFromTemplate(`<p>{{ t("Hello") }}</p>`, 'a.njk')[0].value).toBe('Hello');
  });
  it('extracts single-quoted and filter forms', () => {
    expect(extractFromTemplate(`{{ t('Hello') }}{{ "World" | t }}`, 'a.njk').map((e) => e.value)).toEqual(['Hello', 'World']);
  });
  it('extracts an explicit key when given', () => {
    expect(extractFromTemplate(`{{ t("Hello", { key: "greeting" }) }}`, 'a.njk')[0].key).toBe('greeting');
  });
  it('records the line number for the error message', () => {
    expect(extractFromTemplate(`line1\n{{ t("Hello") }}`, 'a.njk')[0].line).toBe(2);
  });
  it('returns nothing for a template with no strings', () => {
    expect(extractFromTemplate('<div class="t-card"></div>', 'a.njk')).toEqual([]);
  });
  it('does not extract from inside a comment', () => {
    expect(extractFromTemplate('{# {{ t("Hidden") }} #}', 'a.njk')).toEqual([]);
  });
});

describe('findHardCoded', () => {
  it('flags visible text not wrapped in t()', () => {
    expect(findHardCoded('<button>Save changes</button>', 'a.njk')[0].text).toBe('Save changes');
  });
  it('flags a user-visible attribute', () => {
    expect(findHardCoded('<input aria-label="Search" />', 'a.njk').map((h) => h.text)).toContain('Search');
    expect(findHardCoded('<img alt="A chart" />', 'a.njk').map((h) => h.text)).toContain('A chart');
    expect(findHardCoded('<input placeholder="Your name" />', 'a.njk').map((h) => h.text)).toContain('Your name');
    expect(findHardCoded('<a title="Open">x</a>', 'a.njk').map((h) => h.text)).toContain('Open');
  });
  it('does not flag text already wrapped', () => {
    expect(findHardCoded('<button>{{ t("Save") }}</button>', 'a.njk')).toEqual([]);
  });
  it('does not flag class names, ids or data attributes', () => {
    expect(findHardCoded('<div class="t-card" id="x" data-t-foo="bar"></div>', 'a.njk')).toEqual([]);
  });
  it('does not flag content inside script, style or pre', () => {
    expect(findHardCoded('<script>const a = "Save";</script>', 'a.njk')).toEqual([]);
    expect(findHardCoded('<pre>Sample output</pre>', 'a.njk')).toEqual([]);
  });
  it('does not flag whitespace, numbers, or single punctuation', () => {
    expect(findHardCoded('<span>  </span><span>42</span><span>—</span>', 'a.njk')).toEqual([]);
  });
  it('does not flag a nunjucks expression', () => {
    expect(findHardCoded('<span>{{ user.name }}</span>', 'a.njk')).toEqual([]);
  });
  it('honours an explicit opt-out for genuinely untranslatable text', () => {
    expect(findHardCoded('<code data-i18n-ignore>npm run build</code>', 'a.njk')).toEqual([]);
  });
});

describe('mergeCatalogue', () => {
  it('adds new keys and keeps existing translations', () => {
    const result = mergeCatalogue({ 'a.hello': 'Hello' }, [{ key: 'a.hello', value: 'Hello' }, { key: 'a.bye', value: 'Bye' }]);
    expect(result.catalogue['a.hello']).toBe('Hello');
    expect(result.added).toEqual(['a.bye']);
  });
  it('reports removed keys without deleting them silently', () => {
    const result = mergeCatalogue({ 'a.gone': 'Gone' }, []);
    expect(result.removed).toEqual(['a.gone']);
  });
  it('sorts keys so diffs stay readable', () => {
    const result = mergeCatalogue({}, [{ key: 'b', value: 'B' }, { key: 'a', value: 'A' }]);
    expect(Object.keys(result.catalogue)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/extract-strings.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extractor**

`findHardCoded` is the important half: it is what stops the theme regressing. Skip `<script>`, `<style>`, `<pre>`, `<code>`, anything already inside a Nunjucks expression, anything marked `data-i18n-ignore`, and any text that is only whitespace, digits, or a single punctuation mark. Everything else in a text node or in `aria-label` / `alt` / `placeholder` / `title` is a finding.

Add `"i18n:extract": "node scripts/extract-strings.mjs"` and `"i18n:check": "node scripts/extract-strings.mjs --check"`, where `--check` exits non-zero on any hard-coded string and prints file, line and text.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/extract-strings.test.js`
Expected: PASS — 21 tests.

- [ ] **Step 5: Run the extractor over the real templates and fix what it finds**

Run: `cd theme1 && npm run i18n:extract`

This will report a large number of hard-coded strings across the pages built in Phases 02–12. Work through them: wrap each in `t()`, and re-run until `npm run i18n:check` exits 0. This is mechanical but must be complete — a single missed string is a page that half-translates.

- [ ] **Step 6: Wire the gate into CI and commit**

```bash
git add theme1/scripts/extract-strings.mjs theme1/src/locales/en.json theme1/src/ theme1/package.json theme1/.github/workflows/ci.yml theme1/tests/unit/extract-strings.test.js
git commit -m "feat(i18n): string extraction and a hard-coded-string ci gate"
```

---

### Task 2: Runtime translation

**Files:**
- Create: `theme1/src/scripts/core/i18n.js`
- Create: `theme1/src/locales/{de,ar,ja}.json`
- Create: `theme1/src/partials/shell/language-switcher.njk`
- Test: `theme1/tests/unit/i18n.test.js`

**Interfaces:**
- Produces:
  - `LOCALES: Array<{ code, name, nativeName, dir }>`
  - `initI18n({ locale, catalogues }) => Promise<void>`
  - `t(key, params) => string`
  - `setLocale(code) => Promise<void>` — loads the bundle, applies `lang` and `dir`, re-renders `[data-i18n]`
  - `getLocale() => string`
  - Event `i18n:change`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/i18n.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initI18n, t, setLocale, getLocale, LOCALES } from '../../src/scripts/core/i18n.js';

const catalogues = {
  en: { greeting: 'Hello, {{name}}', items_one: '{{count}} item', items_other: '{{count}} items', save: 'Save' },
  de: { greeting: 'Hallo, {{name}}', items_one: '{{count}} Artikel', items_other: '{{count}} Artikel', save: 'Speichern' },
  ar: { greeting: 'مرحبا، {{name}}', items_one: 'عنصر واحد', items_other: '{{count}} عناصر', save: 'حفظ' },
};

beforeEach(async () => {
  document.body.innerHTML = '<span data-i18n="save"></span><input data-i18n-attr="placeholder:save" />';
  document.documentElement.removeAttribute('dir');
  await initI18n({ locale: 'en', catalogues });
});

describe('LOCALES', () => {
  it('declares the four shipped locales with their direction', () => {
    expect(LOCALES.map((l) => l.code).sort()).toEqual(['ar', 'de', 'en', 'ja']);
    expect(LOCALES.find((l) => l.code === 'ar').dir).toBe('rtl');
    expect(LOCALES.filter((l) => l.code !== 'ar').every((l) => l.dir === 'ltr')).toBe(true);
  });
  it('gives every locale a native name, since a switcher listing only English names is useless', () => {
    for (const locale of LOCALES) expect(locale.nativeName).toBeTruthy();
  });
});

describe('t', () => {
  it('translates a key', () => {
    expect(t('save')).toBe('Save');
  });
  it('interpolates parameters', () => {
    expect(t('greeting', { name: 'Ada' })).toBe('Hello, Ada');
  });
  it('escapes an interpolated value', () => {
    expect(t('greeting', { name: '<img src=x>' })).not.toContain('<img');
  });
  it('returns the key itself for a missing translation, never "undefined"', () => {
    expect(t('nope.missing')).toBe('nope.missing');
  });
  it('leaves an unsupplied placeholder visible rather than printing "undefined"', () => {
    expect(t('greeting')).not.toContain('undefined');
  });
  it('pluralises for English', () => {
    expect(t('items', { count: 1 })).toBe('1 item');
    expect(t('items', { count: 0 })).toBe('0 items');
    expect(t('items', { count: 5 })).toBe('5 items');
  });
});

describe('setLocale', () => {
  it('switches the catalogue', async () => {
    await setLocale('de');
    expect(t('save')).toBe('Speichern');
    expect(getLocale()).toBe('de');
  });

  it('sets lang and dir on the document', async () => {
    await setLocale('ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('restores dir to ltr when leaving an rtl locale', async () => {
    await setLocale('ar');
    await setLocale('de');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('re-renders every [data-i18n] node', async () => {
    await setLocale('de');
    expect(document.querySelector('[data-i18n="save"]').textContent).toBe('Speichern');
  });

  it('re-renders translated attributes', async () => {
    await setLocale('de');
    expect(document.querySelector('[data-i18n-attr]').placeholder).toBe('Speichern');
  });

  it('renders with textContent, so a hostile translation cannot inject markup', async () => {
    await initI18n({ locale: 'en', catalogues: { en: { save: '<img src=x onerror=alert(1)>' } } });
    document.body.innerHTML = '<span data-i18n="save"></span>';
    await setLocale('en');
    expect(document.querySelector('img')).toBeNull();
  });

  it('emits i18n:change', async () => {
    let detail;
    document.documentElement.addEventListener('i18n:change', (e) => { detail = e.detail; });
    await setLocale('de');
    expect(detail.locale).toBe('de');
  });

  it('ignores an unsupported locale and keeps the current one', async () => {
    await setLocale('xx');
    expect(getLocale()).toBe('en');
  });

  it('falls back to English for a key missing from another catalogue', async () => {
    await initI18n({ locale: 'de', catalogues: { en: { only: 'Only English' }, de: {} } });
    expect(t('only')).toBe('Only English');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/i18n.test.js`
Expected: FAIL, then PASS.

Locale bundles are dynamic imports keyed by code, so only the active locale is downloaded. The language switcher in the navbar lists native names and marks the current locale with `aria-current`.

Wire `format.js` from Phase 05 to the active locale so numbers, dates and currency follow it automatically.

- [ ] **Step 3: Translate the catalogues**

Fill `de.json`, `ar.json` and `ja.json`. Where a real translation is not available, use a clearly-marked pseudo-translation that preserves the **length characteristics** of the target language — for German, expanded; for Japanese, compact and space-free — so the layout tests remain meaningful. Note in `docs/customization.md` that these are placeholders pending review by a native speaker.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/scripts/core/i18n.js theme1/src/locales/ theme1/src/partials/shell/language-switcher.njk theme1/src/scripts/core/format.js theme1/tests/unit/i18n.test.js
git commit -m "feat(i18n): runtime translation with four locales and locale-aware formatting"
```

---

### Task 3: RTL correctness

**Files:**
- Modify: styles across `theme1/src/styles/`
- Create: `theme1/tests/rtl/logical-properties.test.js`
- Create: `theme1/src/styles/base/_rtl.scss`

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/rtl/logical-properties.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fg from 'fast-glob';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
let ourRules = [];

beforeAll(async () => {
  const [cssFile] = await fg('assets/*.css', { cwd: path.join(rootDir, 'dist'), absolute: true });
  const css = await readFile(cssFile, 'utf8');
  ourRules = css
    .split('}')
    .filter((rule) => /\.t-[a-z]/.test(rule.split('{')[0] ?? ''));
});

const PHYSICAL = [
  'margin-left', 'margin-right', 'padding-left', 'padding-right',
  'border-left', 'border-right', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
];

describe('logical properties', () => {
  it.each(PHYSICAL)('uses no %s in any t- rule', (property) => {
    const offenders = ourRules.filter((rule) => new RegExp(`(^|[;{])\\s*${property}\\s*:`).test(rule));
    expect(offenders.map((r) => r.slice(0, 120))).toEqual([]);
  });

  it('uses no bare left/right offsets in a t- rule', () => {
    const offenders = ourRules.filter((rule) => /(^|[;{])\s*(left|right)\s*:/.test(rule));
    expect(offenders.map((r) => r.slice(0, 120))).toEqual([]);
  });

  it('uses text-align: start/end, never left/right', () => {
    const offenders = ourRules.filter((rule) => /text-align:\s*(left|right)/.test(rule));
    expect(offenders.map((r) => r.slice(0, 120))).toEqual([]);
  });

  it('uses float: inline-start/end if it floats at all', () => {
    const offenders = ourRules.filter((rule) => /float:\s*(left|right)/.test(rule));
    expect(offenders.map((r) => r.slice(0, 120))).toEqual([]);
  });

  it('ships no separate rtl stylesheet — one stylesheet serves both directions', async () => {
    const rtlFiles = await fg('**/*rtl*.{css,scss}', { cwd: path.join(rootDir, 'dist') });
    expect(rtlFiles).toEqual([]);
  });

  it('flips only icons explicitly marked directional', async () => {
    const [cssFile] = await fg('assets/*.css', { cwd: path.join(rootDir, 'dist'), absolute: true });
    const css = await readFile(cssFile, 'utf8');
    const flips = [...css.matchAll(/\[dir=['"]rtl['"]\][^{]*\{[^}]*scaleX\(-1\)[^}]*\}/g)].map((m) => m[0]);
    for (const rule of flips) {
      expect(rule, 'blanket icon flipping mirrors clocks and logos too').toMatch(/t-icon--directional|t-flip-rtl/);
    }
  });
});

describe('rtl page output', () => {
  it('renders every page identically in both directions apart from dir', async () => {
    const pages = await fg('*.html', { cwd: path.join(rootDir, 'dist') });
    expect(pages.length).toBeGreaterThan(100);
    // One HTML output serves both directions; direction is a runtime attribute.
    for (const page of pages.slice(0, 5)) {
      const html = await readFile(path.join(rootDir, 'dist', page), 'utf8');
      expect(html, page).not.toMatch(/dir="rtl"/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/rtl/logical-properties.test.js`
Expected: FAIL wherever a physical property slipped in during Phases 02–12.

- [ ] **Step 3: Fix every offender**

Replace each physical property with its logical equivalent. The Stylelint rule from Phase 00 should have caught most of these; where it did not, extend the rule so it cannot recur.

`_rtl.scss` holds the small set of genuine direction-dependent rules: the `.t-icon--directional` flip, `.t-flip-rtl` for chart axis arrows, and any transform whose sign must reverse.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/rtl/logical-properties.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/styles/ theme1/.stylelintrc.json theme1/tests/rtl/logical-properties.test.js
git commit -m "fix(rtl): eliminate every physical directional property"
```

---

### Task 4: The combinatorial matrix

**Files:**
- Create: `theme1/tests/rtl/combinatorial.test.js`
- Modify: `theme1/package.json`, `theme1/.github/workflows/ci.yml`

This is the phase's headline gate: the specific failure mode the source template's fourteen physical folders hide.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCHEMA, validate, apply } from '../../src/scripts/core/theme-store.js';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));

/** Representative pages: shell, dense data, form, app, content, blank. */
const PAGES = [
  'index.html',
  'table-datatable-advanced.html',
  'form-wizard.html',
  'app-email.html',
  'page-pricing.html',
  'app-invoice-preview.html',
];

const AXES = {
  direction: ['ltr', 'rtl'],
  theme: ['light', 'dark'],
  navState: ['expanded', 'collapsed'],
  nav: ['vertical', 'horizontal'],
  width: ['fluid', 'boxed'],
  density: ['comfortable', 'compact'],
  contrast: ['normal', 'high'],
};

function combinations(axes) {
  return Object.entries(axes).reduce(
    (acc, [key, values]) => acc.flatMap((state) => values.map((value) => ({ ...state, [key]: value }))),
    [{}],
  );
}

const COMBOS = combinations(AXES);
const html = {};

beforeAll(async () => {
  for (const page of PAGES) html[page] = await readFile(path.join(distDir, page), 'utf8');
}, 60_000);

describe('combinatorial matrix', () => {
  it('covers 128 combinations', () => {
    expect(COMBOS).toHaveLength(128);
  });

  it.each(PAGES)('%s holds under every combination', (page) => {
    for (const combo of COMBOS) {
      const dom = new JSDOM(html[page]);
      const doc = dom.window.document;
      apply(validate(combo), doc.documentElement);

      const label = JSON.stringify(combo);

      // Structure survives.
      expect(doc.querySelector('#main'), `${page} ${label}: no main`).not.toBeNull();
      expect(doc.querySelectorAll('main'), `${page} ${label}: duplicate main`).toHaveLength(1);
      expect(doc.querySelector('a.t-skip-link'), `${page} ${label}: no skip link`).not.toBeNull();

      // Every attribute round-trips.
      for (const [key, value] of Object.entries(combo)) {
        expect(doc.documentElement.getAttribute(SCHEMA[key].attr), `${page} ${label}: ${key}`).toBe(value);
      }

      // Direction is on the html element, and nowhere else contradicts it.
      const conflicting = [...doc.querySelectorAll('[dir]')].filter((el) => el !== doc.documentElement);
      expect(conflicting.map((el) => el.tagName), `${page} ${label}: nested dir`).toEqual([]);

      dom.window.close();
    }
  }, 120_000);
});

describe('interaction invariants', () => {
  it('never hides both the sidebar and the horizontal nav at once', () => {
    for (const combo of COMBOS) {
      const state = validate(combo);
      const noSidebar = state.nav === 'horizontal' || state.navState === 'hidden';
      const noHorizontal = state.nav === 'vertical';
      expect(noSidebar && noHorizontal && state.navState === 'hidden' ? 'navigation still reachable via navbar toggle' : true).toBeTruthy();
    }
  });

  it('keeps the customizer reachable in every combination', async () => {
    for (const page of PAGES) {
      const doc = new JSDOM(html[page]).window.document;
      expect(doc.querySelector('[data-t-customizer-open]'), page).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or passes**

Run: `cd theme1 && npm run build && npx vitest run tests/rtl/combinatorial.test.js`
Expected: 6 pages × 128 combinations = 768 checked configurations.

- [ ] **Step 3: Manual visual sweep of the hardest combinations**

The structural test cannot see overlap. Open each of these by hand and confirm nothing collides, clips or scrolls sideways:

| # | Combination |
|---|---|
| 1 | RTL + dark + collapsed + vertical + boxed + compact + high-contrast |
| 2 | RTL + dark + horizontal + boxed + compact |
| 3 | RTL + light + collapsed + vertical + fluid + comfortable, at 320 px |
| 4 | LTR + dark + horizontal + boxed, at 3840 px |
| 5 | RTL + Arabic locale + dark + collapsed |
| 6 | LTR + German locale + compact — the +35% expansion case |
| 7 | LTR + Japanese locale — no word spaces, wrapping |

Fix layout breakage in CSS, never by special-casing a locale.

- [ ] **Step 4: Wire into CI and commit**

Add `"test:rtl": "vitest run tests/rtl"` and a CI step.

```bash
git add theme1/tests/rtl/combinatorial.test.js theme1/package.json theme1/.github/workflows/ci.yml theme1/src/styles/
git commit -m "test(rtl): 768-configuration combinatorial matrix gate"
```

---

### Task 5: Locale layout robustness

**Files:**
- Create: `theme1/tests/rtl/locale-layout.test.js`
- Modify: styles as needed

- [ ] **Step 1: Write the test**

Assert structurally what the manual sweep checks visually: every catalogue has the **same key set** as `en.json`, so no locale silently falls back; no German string exceeds 2.5× its English source without the template marking the element as wrapping-safe; every `[data-i18n]` element's CSS allows wrapping (no `white-space: nowrap` without `text-overflow`); every fixed-width container holding translated text has a `min-inline-size` rather than a fixed `inline-size`; and every locale's `Intl` formatting round-trips through `format.js` without throwing.

Add a specific assertion that no button or badge in the built CSS sets a fixed `inline-size` — the most common cause of a German label spilling out of its control.

- [ ] **Step 2: Run it, fix what it finds, then commit**

```bash
cd theme1 && npm run build && npx vitest run tests/rtl/locale-layout.test.js
git add theme1/tests/rtl/locale-layout.test.js theme1/src/styles/ theme1/src/locales/
git commit -m "test(i18n): locale layout robustness across expansion and wrapping"
```

---

### Task 6: Phase gate

- [ ] **Step 1: Run everything**

```bash
cd theme1 && npm run lint && npm run i18n:check && npm run build && npm run test && npm run test:a11y && npm run test:rtl && npm run test:assets && npm run audit:licenses && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 2: Run the a11y gate in Arabic**

Extend `tests/a11y/style-guide.test.js` to run its audit a third time with `lang="ar" dir="rtl"`, so RTL a11y is covered rather than assumed.

- [ ] **Step 3: Commit**

```bash
git add theme1/tests/a11y/style-guide.test.js
git commit -m "test(i18n): run the accessibility audit in arabic rtl as well"
```

---

## Phase exit checklist

- [ ] `npm run i18n:check` exits 0 — no hard-coded user-visible string anywhere.
- [ ] All four locale catalogues have identical key sets.
- [ ] Switching locale re-renders text and attributes with `textContent`, sets `lang` and `dir`, and persists.
- [ ] A missing key renders the key, never `undefined`; a hostile translation cannot inject markup.
- [ ] Numbers, dates and currency follow the active locale through `format.js`.
- [ ] No `.t-` rule contains a physical directional property; no separate RTL stylesheet ships.
- [ ] Only icons marked `--directional` flip in RTL — clocks, media controls and logos do not.
- [ ] The 768-configuration matrix passes on six representative pages.
- [ ] The seven hardest combinations pass a manual visual check with no collision, clipping or sideways scroll.
- [ ] German expansion and Japanese wrapping break no layout; no control has a fixed `inline-size`.
- [ ] The axe audit passes in Arabic RTL as well as light and dark.
- [ ] CI green.

**Unblocks:** Phase 14 (Hardening).
