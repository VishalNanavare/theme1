# Phase 11 — Content Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 22 content pages — authentication, account settings, profile, blog, FAQ, knowledge base, pricing, and the misc/error pages — plus the 6 transactional mail templates the source template linked to offsite and never shipped.

**Architecture:** Authentication uses a dedicated `auth.njk` layout with two variants: v1 centred card, v2 split illustration panel. Content pages use the standard shell with an optional content sidebar. Mail templates are a separate build target: table-based HTML with inlined styles, because email clients support neither external stylesheets nor CSS Grid.

**Tech Stack:** Nunjucks · SCSS · vanilla ES modules · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties** — except inside mail templates, where email-client support forces physical properties; that exception is scoped to `src/mail/` and excluded from the Stylelint rule.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **Icons: Feather (MIT) only. No photographic assets** — illustrations come from Phase 06.
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Security rules for auth pages

These pages are the ones a security review looks at first, so they are specified up front:

1. No credential is ever placed in a URL, a `GET` form, or `localStorage`.
2. Password fields use `autocomplete="current-password"` or `"new-password"` — never `off`, which breaks password managers and pushes users toward weaker passwords.
3. The show/hide password toggle is a real `<button aria-pressed>`, and toggling never re-renders the value through `innerHTML`.
4. Password-strength feedback is computed client-side and announced politely; it never blocks paste.
5. Forgot-password confirms in identical language whether or not the address exists — no account enumeration.
6. Every form posts to a same-origin placeholder and carries a CSRF-token field so a backend integrator has an obvious slot.
7. No `target="_blank"` without `rel="noopener noreferrer"`.
8. Demo credentials are never pre-filled into a real password field.

---

### Task 1: Auth layout and the eight auth pages

**Files:**
- Create: `theme1/src/layouts/auth.njk`
- Create: `theme1/src/partials/auth/panel.njk`, `social-buttons.njk`, `password-field.njk`
- Create: `theme1/src/pages/page-auth-{login,register,forgot-password,reset-password}-v{1,2}.njk` (8 files)
- Create: `theme1/src/scripts/components/password-strength.js`, `password-toggle.js`
- Create: `theme1/src/styles/pages/_auth.scss`
- Test: `theme1/tests/unit/password-strength.test.js`, `tests/a11y/auth.test.js`

**Interfaces:**
- Produces: `scorePassword(value) => { score: 0..4, label, suggestions: string[] }`; `init`/`destroy` from `password-toggle.js`.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/password-strength.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { scorePassword } from '../../src/scripts/components/password-strength.js';

describe('scorePassword', () => {
  it('scores an empty password zero with no label crash', () => {
    const result = scorePassword('');
    expect(result.score).toBe(0);
    expect(result.label).toBeTruthy();
  });

  it('scores a short password very weak', () => {
    expect(scorePassword('abc').score).toBeLessThanOrEqual(1);
  });

  it('scores a long mixed password strong', () => {
    expect(scorePassword('correct-horse-Battery-9!').score).toBeGreaterThanOrEqual(3);
  });

  it('rewards length more than symbol soup', () => {
    expect(scorePassword('thisisaverylongpassphrase').score).toBeGreaterThanOrEqual(scorePassword('P@ss1!').score);
  });

  it('penalises a common password regardless of its shape', () => {
    expect(scorePassword('Password1!').score).toBeLessThanOrEqual(2);
  });

  it('penalises repetition and sequences', () => {
    expect(scorePassword('aaaaaaaaaaaa').score).toBeLessThanOrEqual(1);
    expect(scorePassword('abcdefghijkl').score).toBeLessThanOrEqual(1);
  });

  it('always returns a score between 0 and 4', () => {
    for (const value of ['', 'a', 'aA1!', 'x'.repeat(200), '👍👍👍👍👍👍']) {
      const { score } = scorePassword(value);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  it('gives actionable suggestions below the top score', () => {
    const result = scorePassword('abc');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((s) => typeof s === 'string' && s.length > 0)).toBe(true);
  });

  it('gives no suggestions at the top score', () => {
    expect(scorePassword('correct-horse-Battery-9!-staple').suggestions).toEqual([]);
  });

  it('counts a multi-byte character as one, not several', () => {
    expect(scorePassword('👍👍👍').score).toBeLessThanOrEqual(1);
  });

  it('is pure and fast enough to run on every keystroke', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) scorePassword(`candidate-${i}`);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
```

Create `theme1/tests/a11y/auth.test.js` asserting the security rules against the built HTML:

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
const AUTH_PAGES = [
  'page-auth-login-v1.html', 'page-auth-login-v2.html',
  'page-auth-register-v1.html', 'page-auth-register-v2.html',
  'page-auth-forgot-password-v1.html', 'page-auth-forgot-password-v2.html',
  'page-auth-reset-password-v1.html', 'page-auth-reset-password-v2.html',
];

describe.each(AUTH_PAGES)('%s', (file) => {
  const load = async () => new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;

  it('never submits credentials over GET', async () => {
    const doc = await load();
    for (const form of doc.querySelectorAll('form')) {
      const method = (form.getAttribute('method') ?? 'get').toLowerCase();
      if (form.querySelector('input[type="password"]')) expect(method, form.outerHTML.slice(0, 80)).toBe('post');
    }
  });

  it('sets a meaningful autocomplete on every password field', async () => {
    const doc = await load();
    for (const field of doc.querySelectorAll('input[type="password"]')) {
      expect(['current-password', 'new-password']).toContain(field.getAttribute('autocomplete'));
    }
  });

  it('sets autocomplete on the email or username field', async () => {
    const doc = await load();
    for (const field of doc.querySelectorAll('input[type="email"]')) {
      expect(['email', 'username']).toContain(field.getAttribute('autocomplete'));
    }
  });

  it('never disables paste on a password field', async () => {
    const html = await readFile(path.join(distDir, file), 'utf8');
    expect(html).not.toMatch(/onpaste|paste.*preventDefault/i);
  });

  it('exposes the password toggle as a pressed-state button', async () => {
    const doc = await load();
    for (const toggle of doc.querySelectorAll('[data-t-password-toggle]')) {
      expect(toggle.tagName.toLowerCase()).toBe('button');
      expect(toggle.getAttribute('type')).toBe('button');
      expect(toggle.hasAttribute('aria-pressed')).toBe(true);
      expect(toggle.getAttribute('aria-label') || toggle.textContent.trim()).toBeTruthy();
    }
  });

  it('includes a CSRF token slot', async () => {
    const doc = await load();
    if (doc.querySelector('form[method="post"]')) {
      expect(doc.querySelector('input[name="_csrf"], input[name="csrf_token"]')).not.toBeNull();
    }
  });

  it('adds rel="noopener noreferrer" to every new-tab link', async () => {
    const doc = await load();
    for (const link of doc.querySelectorAll('a[target="_blank"]')) {
      expect((link.getAttribute('rel') ?? '').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
  });

  it('pre-fills no password value', async () => {
    const doc = await load();
    for (const field of doc.querySelectorAll('input[type="password"]')) {
      expect(field.getAttribute('value') ?? '').toBe('');
    }
  });

  it('has exactly one h1 and a labelled form', async () => {
    const doc = await load();
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    for (const form of doc.querySelectorAll('form')) {
      expect(form.getAttribute('aria-label') || form.getAttribute('aria-labelledby')).toBeTruthy();
    }
  });

  it('references no raster image', async () => {
    const html = await readFile(path.join(distDir, file), 'utf8');
    expect(html).not.toMatch(/\.(png|jpe?g|gif|webp|avif)("|')/i);
  });
});

describe('account enumeration', () => {
  it('uses identical confirmation wording on both forgot-password variants', async () => {
    const texts = await Promise.all(
      ['page-auth-forgot-password-v1.html', 'page-auth-forgot-password-v2.html'].map(async (file) => {
        const doc = new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
        return doc.querySelector('[data-t-auth-confirmation]')?.textContent.trim();
      }),
    );
    expect(texts[0]).toBeTruthy();
    expect(texts[0]).toBe(texts[1]);
    expect(texts[0], 'must not reveal whether the account exists').not.toMatch(/no account|not found|doesn't exist|unknown/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/password-strength.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement and build the eight pages**

`scorePassword` is in-house: length is the dominant term, with penalties for a small common-password list, repetition, and keyboard or alphabet sequences. Do not add `zxcvbn` — it is 800 KB for a progress bar.

The v1 layout is a centred card on a patterned background from Phase 06. The v2 layout is a two-column split with an `auth-panel` illustration on the inline-start side, collapsing to v1's single column below `lg`.

Each page: login (email, password with toggle, remember me, forgot link, submit, social buttons, register link); register (name, email, password with strength meter, confirm, terms checkbox, submit, social, login link); forgot (email, submit, back-to-login, and the identical confirmation panel); reset (new password with strength, confirm, submit, back-to-login).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npm run build && npx vitest run tests/unit/password-strength.test.js tests/a11y/auth.test.js`
Expected: PASS — 11 strength tests, 8 × 10 page tests, 1 enumeration test.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/layouts/auth.njk theme1/src/partials/auth/ theme1/src/pages/page-auth-*.njk theme1/src/scripts/components/password-*.js theme1/src/styles/pages/_auth.scss theme1/tests/unit/password-strength.test.js theme1/tests/a11y/auth.test.js
git commit -m "feat(pages): eight auth pages with security and a11y gates"
```

---

### Task 2: Account settings and profile

**Files:**
- Create: `theme1/src/pages/page-account-settings.njk`, `page-profile.njk`
- Create: `theme1/src/scripts/pages/page-account-settings.js`
- Create: `theme1/src/styles/pages/_profile.scss`
- Create: `theme1/src/data/profile.json`
- Test: `theme1/tests/unit/apps/account-settings.test.js`

**Account settings tabs.** General (avatar, name, email, org, phone, address, timezone, currency, save/reset); Change password (current, new with strength, confirm, requirement list that ticks live); Information (bio, birth date, country, languages, gender, contact); Social links (six URL fields with pattern validation); Notifications (a matrix of channel × event checkboxes with a select-all per row); Connections (connected services with connect/disconnect, using generic role icons — **not** brand marks).

**Profile blocks.** Cover header with generated pattern art, avatar, name, role, and a nav; About (bio, joined, lives in, languages); Latest photos as a grid of generated patterns; Suggested pages; Activity feed; Post composer; Post cards with reactions, comment count, share, and a comment list with a reply form.

- [ ] **Step 1: Write the failing test**

Cover: the notifications matrix's per-row select-all reaching tri-state correctly; social URL validation accepting `https://` and rejecting `javascript:`; the change-password requirement list updating live and being announced; and the unsaved-changes guard — navigating away with a dirty form prompts, and saving clears the dirty flag.

Assert in the DOM: the tab set follows the Phase 03 tabs contract; the notification matrix is a real table with `scope` on both axes so a screen reader can navigate it; and the connections list uses `roleIcon()` output, checked against `ROLE_ICONS`.

- [ ] **Step 2: Run the test to verify it fails, build both pages, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/account-settings.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/page-account-settings.njk theme1/src/pages/page-profile.njk theme1/src/scripts/pages/page-account-settings.js theme1/src/styles/pages/_profile.scss theme1/src/data/profile.json theme1/tests/unit/apps/account-settings.test.js
git commit -m "feat(pages): account settings and profile"
```

---

### Task 3: Blog, FAQ, knowledge base

**Files:**
- Create: `theme1/src/pages/page-blog-{list,detail,edit}.njk`, `page-faq.njk`, `page-knowledge-base.njk`, `page-kb-category.njk`, `page-kb-question.njk`
- Create: `theme1/src/scripts/core/search-content.js`
- Create: `theme1/src/scripts/pages/page-blog-edit.js`, `page-faq.js`, `page-knowledge-base.js`
- Create: `theme1/src/data/blog.json`, `faq.json`, `kb.json`
- Create: `theme1/src/styles/pages/_blog.scss`, `_kb.scss`
- Test: `theme1/tests/unit/apps/search-content.test.js`

**Interfaces:**
- Produces: `searchContent(items, query, fields) => Array<{ item, score, matches }>` — one search used by both FAQ and KB, ranked rather than merely filtered.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { searchContent } from '../../../src/scripts/core/search-content.js';

const items = [
  { id: '1', title: 'Reset your password', body: 'Use the forgot password link to reset access.', tags: ['account'] },
  { id: '2', title: 'Billing questions', body: 'How to update your payment method and reset billing alerts.', tags: ['billing'] },
  { id: '3', title: 'Two-factor authentication', body: 'Secure your account with 2FA.', tags: ['security', 'account'] },
];
const fields = ['title', 'body', 'tags'];

describe('searchContent', () => {
  it('returns everything for an empty query', () => {
    expect(searchContent(items, '', fields)).toHaveLength(3);
  });

  it('ranks a title match above a body match', () => {
    const results = searchContent(items, 'reset', fields);
    expect(results[0].item.id).toBe('1');
    expect(results.map((r) => r.item.id)).toContain('2');
  });

  it('matches tags', () => {
    expect(searchContent(items, 'security', fields).map((r) => r.item.id)).toContain('3');
  });

  it('is case- and diacritic-insensitive', () => {
    expect(searchContent(items, 'RESET', fields).length).toBeGreaterThan(0);
    expect(searchContent([{ id: 'x', title: 'Café', body: '', tags: [] }], 'cafe', fields)).toHaveLength(1);
  });

  it('requires every term of a multi-word query', () => {
    expect(searchContent(items, 'reset billing', fields).map((r) => r.item.id)).toEqual(['2']);
  });

  it('returns nothing when nothing matches', () => {
    expect(searchContent(items, 'zzzz', fields)).toEqual([]);
  });

  it('treats the query literally, not as a regex', () => {
    expect(() => searchContent(items, '(*', fields)).not.toThrow();
    expect(searchContent(items, '.*', fields)).toEqual([]);
  });

  it('reports the matched field so the UI can highlight it', () => {
    expect(searchContent(items, 'reset', fields)[0].matches).toContain('title');
  });

  it('handles an item with a missing field without throwing', () => {
    expect(() => searchContent([{ id: 'x', title: 'a' }], 'a', fields)).not.toThrow();
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(items);
    searchContent(items, 'reset', fields);
    expect(JSON.stringify(items)).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/apps/search-content.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the seven pages**

**Blog list** — a hero, a post grid using generated cover patterns, category badges, author with generated avatar, date, read time, excerpt, and a sidebar with search, recent posts, categories and tags. Pagination.

**Blog detail** — hero, meta, prose body using the Phase 03 typography, a pull quote, a code block, an image figure using generated art, tags, share buttons, an author card, related posts, a comment thread, and a leave-a-comment form.

**Blog edit** — title, slug with an auto-generate button, featured image upload, category, tags, the Phase 04 editor, status, publish date, and save-draft/publish.

**FAQ** — a search hero, accordion groups by category with a category nav, and a contact CTA. The search filters and highlights across all groups, opening matching items and showing a no-results state with the query echoed.

**Knowledge base** — a search hero and a category grid using Phase 06 illustrations. **KB category** — an article list with a sidebar of sibling categories. **KB question** — the article body, a sidebar table of contents built from the headings, previous/next links, and a "was this helpful?" control.

Every prose page must handle the content-stress cases: a 200-character title, an unbroken URL in body text, and a code block wider than the column — which scrolls inside its own container rather than widening the page.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/search-content.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/pages/page-blog-*.njk theme1/src/pages/page-faq.njk theme1/src/pages/page-k*.njk theme1/src/scripts/ theme1/src/data/ theme1/src/styles/pages/_blog.scss theme1/src/styles/pages/_kb.scss theme1/tests/unit/apps/search-content.test.js
git commit -m "feat(pages): blog, faq and knowledge base with ranked search"
```

---

### Task 4: Pricing and misc pages

**Files:**
- Create: `theme1/src/pages/page-pricing.njk`, `page-misc-{error,not-authorized,coming-soon,under-maintenance}.njk`
- Create: `theme1/src/scripts/pages/page-pricing.js`, `src/scripts/components/countdown.js`
- Create: `theme1/src/styles/pages/_pricing.scss`, `_misc.scss`
- Test: `theme1/tests/unit/components/countdown.test.js`

**Interfaces:**
- Produces: `remaining(target, now) => { days, hours, minutes, seconds, expired }`; `init`/`destroy` from `countdown.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { remaining } from '../../../src/scripts/components/countdown.js';

const now = new Date('2026-08-18T12:00:00Z');

describe('remaining', () => {
  it('breaks a duration into days, hours, minutes and seconds', () => {
    expect(remaining('2026-08-20T13:30:45Z', now)).toMatchObject({ days: 2, hours: 1, minutes: 30, seconds: 45, expired: false });
  });
  it('reports zero and expired for a past target', () => {
    expect(remaining('2026-08-17T12:00:00Z', now)).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  });
  it('reports expired exactly at the target', () => {
    expect(remaining('2026-08-18T12:00:00Z', now).expired).toBe(true);
  });
  it('handles a target more than a year away', () => {
    expect(remaining('2028-08-18T12:00:00Z', now).days).toBeGreaterThan(700);
  });
  it('handles a target one second away', () => {
    expect(remaining('2026-08-18T12:00:01Z', now)).toMatchObject({ seconds: 1, expired: false });
  });
  it('returns expired for an invalid target rather than NaN', () => {
    const result = remaining('not a date', now);
    expect(result.expired).toBe(true);
    expect(Number.isNaN(result.days)).toBe(false);
  });
  it('crosses a daylight-saving boundary without gaining or losing an hour', () => {
    const before = new Date('2026-03-28T12:00:00Z');
    expect(remaining('2026-03-30T12:00:00Z', before).days).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, then build the pages**

**Pricing** — a hero with an illustration, a monthly/annual toggle showing the annual saving, three tier cards with the middle one highlighted as popular, feature lists with tick and cross icons, a per-tier CTA, a feature comparison table, an FAQ accordion, and an enterprise CTA. The toggle must update every price **and** announce the change; prices come from integer minor units through `formatCurrency`.

**Misc pages** use `layouts/blank.njk` and the matching Phase 06 illustration: 404, 500, not-authorized, coming-soon with a countdown and a notify-me form, and under-maintenance with a subscribe form. Each carries a clear heading, an explanation, and a route back — an error page whose only affordance is a back button is a dead end.

The countdown must announce only at meaningful intervals (minute changes), not every second, or it makes a screen reader unusable.

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/components/countdown.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/pages/page-pricing.njk theme1/src/pages/page-misc-*.njk theme1/src/scripts/ theme1/src/styles/pages/_pricing.scss theme1/src/styles/pages/_misc.scss theme1/tests/unit/components/countdown.test.js
git commit -m "feat(pages): pricing with billing toggle and the four misc pages"
```

---

### Task 5: Transactional mail templates

**Files:**
- Create: `theme1/src/mail/layouts/base.njk`
- Create: `theme1/src/mail/pages/mail-{welcome,verify-email,reset-password,deactivate-account,invoice,promotional}.njk`
- Create: `theme1/scripts/build-mail.mjs`
- Modify: `theme1/package.json`
- Test: `theme1/tests/unit/mail.test.js`

**Interfaces:**
- Produces: `dist/mail/*.html` — self-contained, inline-styled email HTML.

These six are **net new**: the source template's navigation linked them to `pixinvent.com` and shipped no files.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/mail.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mailDir = fileURLToPath(new URL('../../dist/mail', import.meta.url));
const TEMPLATES = ['mail-welcome.html', 'mail-verify-email.html', 'mail-reset-password.html', 'mail-deactivate-account.html', 'mail-invoice.html', 'mail-promotional.html'];

describe.each(TEMPLATES)('%s', (file) => {
  const load = async () => readFile(path.join(mailDir, file), 'utf8');

  it('links no external stylesheet — email clients strip them', async () => {
    expect(await load()).not.toMatch(/<link[^>]+rel="stylesheet"/i);
  });

  it('contains no <style> block outside head, and no class-only styling', async () => {
    const doc = new JSDOM(await load()).window.document;
    for (const el of doc.querySelectorAll('td, table, a.button')) {
      if (el.className && !el.getAttribute('style')) {
        expect(el.getAttribute('style'), `${el.tagName} styled by class alone`).toBeTruthy();
      }
    }
  });

  it('uses table layout, not flex or grid', async () => {
    const html = await load();
    expect(html).toMatch(/<table/i);
    expect(html).not.toMatch(/display:\s*(flex|grid)/i);
  });

  it('contains no script', async () => {
    expect(await load()).not.toMatch(/<script/i);
  });

  it('sets a max width around 600px, the safe email width', async () => {
    expect(await load()).toMatch(/(max-width|width):\s*600px/i);
  });

  it('provides a plain-text preheader', async () => {
    const doc = new JSDOM(await load()).window.document;
    expect(doc.querySelector('[data-preheader]')?.textContent.trim()).toBeTruthy();
  });

  it('gives every image alt text, and uses no raster', async () => {
    const html = await load();
    expect(html).not.toMatch(/\.(png|jpe?g|gif|webp)("|')/i);
    const doc = new JSDOM(html).window.document;
    for (const img of doc.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true);
  });

  it('makes every link absolute, since email has no base URL', async () => {
    const doc = new JSDOM(await load()).window.document;
    for (const link of doc.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      expect(href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('{{'), href).toBe(true);
    }
  });

  it('includes an unsubscribe link where the message is not transactional', async () => {
    if (file === 'mail-promotional.html') {
      expect((await load()).toLowerCase()).toContain('unsubscribe');
    }
  });

  it('states a language on the html element', async () => {
    expect(await load()).toMatch(/<html[^>]+lang=/i);
  });

  it('keeps body text at 4.5:1 against its background', async () => {
    const { contrastRatio } = await import('../../scripts/contrast.mjs');
    const doc = new JSDOM(await load()).window.document;
    const body = doc.querySelector('[data-mail-body]');
    const colour = body.getAttribute('style').match(/color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    const background = body.getAttribute('style').match(/background(?:-color)?:\s*(#[0-9a-f]{3,6})/i)?.[1] ?? '#ffffff';
    expect(contrastRatio(colour, background)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/mail.test.js`
Expected: FAIL — `dist/mail` does not exist.

- [ ] **Step 3: Build the mail templates and their build step**

Email HTML is its own discipline: nested tables, inline styles, physical `left`/`right`, and hex colours baked in — CSS custom properties do not resolve in most clients. Take the hex values from `dist-tokens/tokens.json` at build time, so mail stays in step with the theme without inheriting its mechanism.

`build-mail.mjs` renders `src/mail/pages/*.njk` into `dist/mail/`. Add `"mail": "node scripts/build-mail.mjs"` and chain it into `build`.

Template variables use `{{ }}` placeholders that survive into the output for a backend to fill.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/unit/mail.test.js`
Expected: PASS — 6 × 11 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/mail/ theme1/scripts/build-mail.mjs theme1/package.json theme1/tests/unit/mail.test.js
git commit -m "feat(mail): six transactional email templates the source never shipped"
```

---

### Task 6: Phase gate

- [ ] **Step 1: Extend the axe gate and navigation**

Add all 22 content pages to `PAGES` in `tests/a11y/style-guide.test.js` and to `navigation.json` under "Pages", with the mail templates as their own group linking into `mail/`.

- [ ] **Step 2: Content-stress sweep**

On the blog detail, KB question and FAQ pages, verify by hand: a 200-character title wraps rather than overflowing; an unbroken 300-character URL wraps; a wide code block scrolls inside its own container; and a table wider than the column scrolls without widening the page. Fix any failure in CSS with `overflow-wrap: anywhere` and per-container `overflow-x: auto`.

- [ ] **Step 3: Run everything**

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json theme1/src/styles/
git commit -m "test(pages): a11y coverage and content-stress fixes for all content pages"
```

---

## Phase exit checklist

- [ ] All 22 content pages plus 6 mail templates build and appear in the navigation.
- [ ] Every auth page passes the security gate: POST only, correct `autocomplete`, paste allowed, toggle as a pressed button, CSRF slot, `noopener noreferrer`, no pre-filled password.
- [ ] Forgot-password wording is identical on both variants and reveals nothing about account existence.
- [ ] Password strength runs 1,000 evaluations in under 100 ms and never returns a score outside 0–4.
- [ ] The pricing toggle updates and announces every price; all prices derive from integer minor units.
- [ ] The countdown announces at minute granularity, not per second, and reports expired for an invalid target.
- [ ] Content search ranks title matches above body matches and requires every term of a multi-word query.
- [ ] Mail templates use table layout, inline styles, absolute links, alt text, a preheader, and no script or raster.
- [ ] Long titles, unbroken URLs and wide code blocks never widen the page.
- [ ] `npm run test:a11y` clean on all 22 pages in both themes.
- [ ] CI green.
