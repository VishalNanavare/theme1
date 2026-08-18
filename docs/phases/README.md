# theme1 — Implementation Phases

Sixteen independently-shippable phases. Each has its own plan file in this directory and produces
working, verifiable software on its own.

**Source spec:** [`../superpowers/specs/2026-08-18-theme1-design.md`](../superpowers/specs/2026-08-18-theme1-design.md)

---

## Phase index

| # | Phase | File | Exit gate |
|---|---|---|---|
| 00 | Foundation | [`phase-00-foundation.md`](phase-00-foundation.md) | `npm run build` green; licence audit passes |
| 01 | Design tokens | [`phase-01-design-tokens.md`](phase-01-design-tokens.md) | Contrast audit passes in both themes |
| 02 | Layout shell | [`phase-02-layout-shell.md`](phase-02-layout-shell.md) | Every option-matrix combination renders |
| 03 | Core components | [`phase-03-core-components.md`](phase-03-core-components.md) | axe: 0 critical/serious on style guide |
| 04 | Forms | [`phase-04-forms.md`](phase-04-forms.md) | Keyboard path verified on all 16 pages |
| 05 | Data display | [`phase-05-data-display.md`](phase-05-data-display.md) | 500-row table renders < 100 ms |
| 06 | Artwork | [`phase-06-artwork.md`](phase-06-artwork.md) | Zero third-party image assets in `dist/` |
| 07 | Dashboards & cards | [`phase-07-dashboards-cards.md`](phase-07-dashboards-cards.md) | Responsive matrix 320→3840 px |
| 08 | Apps I | [`phase-08-apps-productivity.md`](phase-08-apps-productivity.md) | Per-app behaviour checklist |
| 09 | Apps II | [`phase-09-apps-commerce.md`](phase-09-apps-commerce.md) | Per-app behaviour checklist |
| 10 | Apps III | [`phase-10-apps-invoice-user.md`](phase-10-apps-invoice-user.md) | Currency arithmetic exact; print correct |
| 11 | Content pages | [`phase-11-content-pages.md`](phase-11-content-pages.md) | Per-page checklist; mail templates render in clients |
| 12 | Extensions | [`phase-12-extensions.md`](phase-12-extensions.md) | All 13 pages on replaced libraries |
| 13 | i18n & RTL | [`phase-13-i18n-rtl.md`](phase-13-i18n-rtl.md) | Combinatorial matrix green |
| 14 | Hardening | [`phase-14-hardening.md`](phase-14-hardening.md) | Lighthouse ≥ 95; axe 0 criticals; CSP clean |
| 15 | Release | [`phase-15-release.md`](phase-15-release.md) | Licence audit clean; docs complete |

---

## Dependency graph

```
00 Foundation
 └─ 01 Tokens
     ├─ 02 Layout shell ──┐
     └─ 03 Core components┤
                          ├─ 04 Forms ────────┐
                          ├─ 05 Data display ─┤
                          └─ 06 Artwork ──────┤
                                              ├─ 07 Dashboards & cards
                                              ├─ 08 Apps I
                                              ├─ 09 Apps II
                                              ├─ 10 Apps III
                                              ├─ 11 Content pages
                                              └─ 12 Extensions
                                                   └─ 13 i18n & RTL
                                                        └─ 14 Hardening
                                                             └─ 15 Release
```

**Hard ordering:** 00 → 01 → {02, 03} → {04, 05, 06} → {07…12} → 13 → 14 → 15.
Phases 04–06 may run in parallel once 03 lands. Phases 07–12 may run in parallel once 04–06 land.

---

## Conventions shared by every phase

### Naming

| Thing | Convention | Example |
|---|---|---|
| CSS class | `t-` prefix, BEM-ish | `.t-card`, `.t-card__header`, `.t-card--bordered` |
| CSS custom property | `--t-` prefix | `--t-surface-raised` |
| Layout state | `data-*` on `<html>` | `data-nav-state="collapsed"` |
| Component hook | `data-t-<name>` | `data-t-dropdown` |
| JS module | kebab-case file, named exports | `src/scripts/components/dropdown.js` |
| Nunjucks macro | snake_case file, camelCase macro | `partials/ui/form_field.njk` → `formField()` |
| Test file | mirrors source path | `tests/unit/components/dropdown.test.js` |

### Every interactive component module exports

```js
export const NAME = 'dropdown';
export function init(root = document) { /* returns array of instances */ }
export function destroy(root = document) { /* removes listeners, restores DOM */ }
export const defaults = { /* documented options */ };
```

### Commit convention

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`, `a11y:`.
Scope with the phase where useful: `feat(tokens): add dark palette`.

### Definition of done for any task

1. Test written first and observed failing.
2. Minimal implementation makes it pass.
3. `npm run lint` clean.
4. `npm run test` green.
5. Committed.

---

## Global constraints

These apply to **every task in every phase**. Copied verbatim into each phase file.

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Never `@import "bootstrap/scss/bootstrap"` wholesale — selective imports only, via `src/styles/bootstrap/_config.scss`.
- **No jQuery.** Not as a dependency, not as a peer, not in a vendored file.
- **Runtime dependencies** (`dependencies` in `package.json`) must be licensed MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only dependencies additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.** That tree is a requirements reference only.
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties** (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline-start/end`, `text-align: start/end`). Physical `left`/`right` properties are a lint error.
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. Heavy libraries (`ag-grid`, `apexcharts`, `fullcalendar`, `quill`, `leaflet`, `plyr`) are dynamically imported only.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries and large text, in **both** light and dark.
- **Fonts self-hosted.** Inter (SIL OFL) only. No runtime requests to Google Fonts or any CDN.
- **Icons: Feather (MIT) only**, delivered as one SVG sprite. No icon fonts.
- **No photographic assets.** All imagery is generated SVG.
- **Licence:** the theme itself ships MIT, with `THIRD-PARTY-NOTICES.md` generated by `scripts/license-audit.mjs`.

---

## Running a phase

Each phase file is a standalone plan. Execute with either:

- **`superpowers:subagent-driven-development`** — a fresh subagent per task with review between tasks (recommended).
- **`superpowers:executing-plans`** — batch execution in one session with checkpoints.
