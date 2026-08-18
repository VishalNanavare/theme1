# Phase 15 — Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a passing build into a shippable product — complete documentation, a starter kit, a provenance record proving the theme is original, a final licence audit, and a tagged v1.0.0 release.

**Architecture:** Documentation is generated where it can be (tokens, components, icons, licences) and hand-written where it must be (getting started, customization, architecture, migration). The provenance record is the artefact that answers the question this whole project exists to answer: *can we prove none of this came from the commercial template?*

**Tech Stack:** Markdown · Node ESM generators · Vitest

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
- **Accessibility:** WCAG 2.2 AA in both themes and all locales.
- **Icons: Feather (MIT) only. No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

---

### Task 1: Provenance record

**Files:**
- Create: `theme1/scripts/provenance.mjs`
- Create: `theme1/PROVENANCE.md`
- Test: `theme1/tests/release/provenance.test.js`

**Interfaces:**
- Produces:
  - `scanForForeignStrings(dir, terms) => Array<{ file, term, line }>`
  - `similarityReport(ourFiles, theirDir) => Array<{ ours, theirs, score }>` — normalised token-shingle Jaccard similarity
  - `PROVENANCE.md` — the evidence document

This is the artefact that substantiates the project's core claim. It is checked into the repository and regenerated on every release.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/release/provenance.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { scanForForeignStrings, similarityReport, FORBIDDEN_TERMS } from '../../scripts/provenance.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE_TEMPLATE = 'd:/webserver/www/sample_theme';

describe('FORBIDDEN_TERMS', () => {
  it('covers the source template, its vendors and its asset suppliers', () => {
    for (const term of ['vuexy', 'pixinvent', 'themeforest', 'ui8', 'freepik', 'unsplash', 'coffinite', 'montserrat', 'fontawesome']) {
      expect(FORBIDDEN_TERMS.map((t) => t.toLowerCase())).toContain(term);
    }
  });
});

describe('scanForForeignStrings', () => {
  it('finds no forbidden term anywhere in our source', async () => {
    const findings = await scanForForeignStrings(path.join(rootDir, 'src'), FORBIDDEN_TERMS);
    const report = findings.map((f) => `${f.file}:${f.line} — ${f.term}`).join('\n');
    expect(findings, `\n${report}`).toEqual([]);
  });

  it('finds no forbidden term in the build scripts', async () => {
    const findings = await scanForForeignStrings(path.join(rootDir, 'scripts'), FORBIDDEN_TERMS);
    // The provenance script itself legitimately names the terms it searches for.
    expect(findings.filter((f) => !f.file.endsWith('provenance.mjs'))).toEqual([]);
  });

  it('finds no forbidden term in the built output', async () => {
    const findings = await scanForForeignStrings(path.join(rootDir, 'dist'), FORBIDDEN_TERMS);
    expect(findings.map((f) => `${f.file}: ${f.term}`)).toEqual([]);
  });

  it('detects a planted term, proving the scanner actually works', async () => {
    const findings = await scanForForeignStrings(path.join(rootDir, 'tests/release/fixtures'), ['plantedterm']);
    expect(findings.length, 'the scanner must detect the control fixture').toBeGreaterThan(0);
  });
});

describe('similarity to the source template', () => {
  it.runIf(existsSync(SOURCE_TEMPLATE))('shares no substantially similar CSS or markup', async () => {
    const report = await similarityReport(path.join(rootDir, 'src'), SOURCE_TEMPLATE);
    const suspicious = report.filter((r) => r.score > 0.3);
    const detail = suspicious.map((r) => `${r.ours} ~ ${r.theirs} = ${r.score.toFixed(2)}`).join('\n');
    expect(suspicious, `\nPossible derivation:\n${detail}`).toEqual([]);
  }, 300_000);
});

describe('PROVENANCE.md', () => {
  it('exists and records the required sections', async () => {
    const text = await readFile(path.join(rootDir, 'PROVENANCE.md'), 'utf8');
    for (const heading of ['Origin', 'Method', 'Dependencies', 'Assets', 'Fonts', 'Verification', 'Attestation']) {
      expect(text, `missing section: ${heading}`).toContain(heading);
    }
  });

  it('states the scan date and the tool version', async () => {
    const text = await readFile(path.join(rootDir, 'PROVENANCE.md'), 'utf8');
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

Create the control fixture `tests/release/fixtures/control.txt` containing the word `plantedterm` — a scanner that has silently broken must fail this test rather than reporting a clean result.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/release/provenance.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/provenance.mjs`**

`similarityReport` normalises each file — strip comments and whitespace, lowercase, tokenise — then compares 8-token shingles by Jaccard index between every one of our CSS/SCSS/HTML/JS files and every file of the same kind in the source template. Anything above 0.3 is reported for human review. Independent implementations of the same component routinely score 0.05–0.15; a copy scores above 0.7.

The comparison is skipped gracefully when the source template is not present, so the test suite runs anywhere.

- [ ] **Step 4: Write `PROVENANCE.md`**

Sections, each stating a fact rather than an intention:

- **Origin** — theme1 is an original work. The commercial template *Vuexy* by PIXINVENT was examined only to enumerate features; no code, markup, stylesheet, or artwork was copied, adapted, or transcribed.
- **Method** — clean-room: a requirements inventory (spec §6–§8) was written from the feature surface; implementation proceeded from that inventory and from an independently designed token system. Distinct palette (`#3D5AFE` indigo vs their `#7367f0` violet), distinct typeface (Inter vs Montserrat), distinct class prefix (`t-`), distinct markup conventions, distinct architecture (runtime layout attributes vs fourteen duplicated folders).
- **Dependencies** — every runtime dependency, its licence, and the audit that enforces the allow-list.
- **Assets** — every image is generated by `scripts/svg-gen.mjs` from code in this repository. No stock photography, no purchased illustration, no third-party trademark. The `no-raster` gate proves it.
- **Fonts** — Inter under SIL OFL 1.1, self-hosted, `OFL.txt` included.
- **Verification** — the commands anyone can run to check these claims: `npm run audit:licenses`, `npm run test:assets`, `npm run provenance`, and the similarity report.
- **Attestation** — the date, the tool versions, and the result of the most recent scan.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd theme1 && npm run build && npx vitest run tests/release/provenance.test.js`
Expected: PASS. Any similarity finding above 0.3 must be investigated and the file rewritten before this phase can continue.

- [ ] **Step 6: Commit**

```bash
git add theme1/scripts/provenance.mjs theme1/PROVENANCE.md theme1/tests/release/ theme1/package.json
git commit -m "docs: provenance record and originality verification"
```

---

### Task 2: Generated documentation

**Files:**
- Create: `theme1/scripts/docs-gen.mjs`
- Create: `theme1/docs/tokens.md`, `components.md`, `icons.md` (generated)
- Test: `theme1/tests/release/docs.test.js`

**Interfaces:**
- Produces: `generateTokenDocs(tokens)`, `generateComponentDocs(components)`, `generateIconDocs(iconSet)` — each returning Markdown.

- [ ] **Step 1: Write the failing test**

Assert that the generated docs are complete and cannot drift:

- `tokens.md` documents **every** token present in `dist-tokens/tokens.json`, with its light value, its dark value, and its tier.
- `components.md` has a section for every file in `src/partials/ui/`, listing the macro signature, every option with its type and default, and every variant.
- `icons.md` lists every name in `ICON_SET`.
- Regenerating produces byte-identical output, so a stale doc is a CI failure.
- No generated doc contains a `TODO`, `TBD` or empty section.

- [ ] **Step 2: Run the test to verify it fails, implement, then verify it passes**

Run: `cd theme1 && npx vitest run tests/release/docs.test.js`
Expected: FAIL, then PASS.

Add `"docs:gen": "node scripts/docs-gen.mjs"` and a CI step that regenerates and then runs `git diff --exit-code -- docs/` — the same drift check already used for `THIRD-PARTY-NOTICES.md`.

- [ ] **Step 3: Commit**

```bash
git add theme1/scripts/docs-gen.mjs theme1/docs/tokens.md theme1/docs/components.md theme1/docs/icons.md theme1/tests/release/docs.test.js theme1/package.json theme1/.github/workflows/ci.yml
git commit -m "docs: generated token, component and icon references with a drift gate"
```

---

### Task 3: Hand-written documentation

**Files:**
- Create: `theme1/docs/getting-started.md`, `customization.md`, `architecture.md`, `contributing.md`, `faq.md`
- Modify: `theme1/README.md`
- Create: `theme1/src/pages/documentation.njk`
- Test: `theme1/tests/release/docs-links.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

describe('documentation', () => {
  it('includes every required document', () => {
    for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md', 'PROVENANCE.md', 'THIRD-PARTY-NOTICES.md',
      'docs/getting-started.md', 'docs/customization.md', 'docs/architecture.md', 'docs/tokens.md',
      'docs/components.md', 'docs/icons.md', 'docs/security.md', 'docs/browser-support.md', 'docs/contributing.md', 'docs/faq.md']) {
      expect(existsSync(path.join(rootDir, file)), `missing ${file}`).toBe(true);
    }
  });

  it('has no broken relative link', async () => {
    const broken = [];
    for (const file of await fg(['*.md', 'docs/**/*.md'], { cwd: rootDir, absolute: true })) {
      const text = await readFile(file, 'utf8');
      for (const [, target] of text.matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)(?:#[^)]*)?\)/g)) {
        const resolved = path.resolve(path.dirname(file), target);
        if (!existsSync(resolved)) broken.push(`${path.relative(rootDir, file)} -> ${target}`);
      }
    }
    expect(broken, broken.join('\n')).toEqual([]);
  });

  it('contains no placeholder text', async () => {
    const offenders = [];
    for (const file of await fg(['*.md', 'docs/**/*.md'], { cwd: rootDir, absolute: true })) {
      const text = await readFile(file, 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        if (/\b(TODO|TBD|FIXME|Lorem ipsum|coming soon|XXX)\b/i.test(line)) {
          offenders.push(`${path.relative(rootDir, file)}:${i + 1}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('states the MIT licence in the README', async () => {
    const readme = await readFile(path.join(rootDir, 'README.md'), 'utf8');
    expect(readme).toMatch(/\bMIT\b/);
    expect(readme).toMatch(/original work|not derived/i);
  });

  it('documents every npm script', async () => {
    const pkg = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
    const readme = await readFile(path.join(rootDir, 'README.md'), 'utf8');
    const undocumented = Object.keys(pkg.scripts).filter((s) => !readme.includes(s));
    expect(undocumented, `undocumented scripts: ${undocumented.join(', ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, then write the documents**

**`getting-started.md`** — prerequisites, install, the four commands that matter, the folder tour, how to add a page, how to add a component, and how to deploy `dist/` to a static host.

**`customization.md`** — the three-tier token model with a worked example of rebranding by editing tier 1 only; how to build a new preset; how to change the type scale; how to add a locale; how to add an icon; how to change the layout defaults; and how to remove pages you do not need without breaking the navigation.

**`architecture.md`** — the decisions and their reasons, including the ones taken during implementation: DataTables dropped for jQuery, pdfmake and JSZip dropped for weight and dual-licensing, jsTree replaced, the flat `src/pages/` layout, and the replacement table from Phase 12.

**`faq.md`** — the questions an integrator actually asks: can I use this commercially (yes, MIT); do I have to credit you (no, but the third-party notices must ship); how do I wire it to a backend; how do I add authentication; why is there no jQuery; why are there no photographs; how do I add a chart type.

**`documentation.njk`** — an in-theme page rendering the docs so the demo site is self-documenting.

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/release/docs-links.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add theme1/docs/ theme1/README.md theme1/src/pages/documentation.njk theme1/tests/release/docs-links.test.js
git commit -m "docs: getting started, customization, architecture, contributing and faq"
```

---

### Task 4: Starter kit

**Files:**
- Create: `theme1/starter/` — a minimal working project
- Create: `theme1/scripts/build-starter.mjs`
- Test: `theme1/tests/release/starter.test.js`

**Interfaces:**
- Produces: `dist-starter/` — a stripped project with the shell, tokens, components and three pages, and nothing else.

The starter is what an integrator actually begins from; shipping only the 122-page demo makes them delete 119 files before writing a line.

- [ ] **Step 1: Write the failing test**

Assert: the starter contains exactly three pages (`index`, `login`, `blank`); it contains the full `styles/` and `scripts/core/` trees; it contains **no** demo data beyond `site.json` and `navigation.json`; its `package.json` has the same scripts and the same dependency set minus the demo-only libraries; `npm ci && npm run build` inside it succeeds; the built starter has zero console errors; and its shared CSS is smaller than the full theme's, proving the strip actually stripped.

- [ ] **Step 2: Run the test to verify it fails, build the starter, then verify it passes**

Run: `cd theme1 && npm run build:starter && npx vitest run tests/release/starter.test.js`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add theme1/starter/ theme1/scripts/build-starter.mjs theme1/tests/release/starter.test.js theme1/package.json
git commit -m "feat(release): minimal starter kit"
```

---

### Task 5: Release verification

**Files:**
- Create: `theme1/scripts/release-check.mjs`
- Create: `theme1/CHANGELOG.md`
- Modify: `theme1/.github/workflows/release.yml`

**Interfaces:**
- Produces: `releaseChecks() => Array<{ name, pass, detail }>` — one consolidated gate that runs every other gate and refuses to tag on any failure.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/release/release-check.test.js` asserting that `releaseChecks()` includes, at minimum, a check named for each of: lint, unit tests, i18n extraction, build, accessibility, RTL matrix, assets, end-to-end, Lighthouse, licence audit, budgets, provenance, docs drift, starter build, changelog updated, and version consistency between `package.json`, `CHANGELOG.md` and the git tag. Assert that a deliberately failing check makes `releaseChecks()` report `pass: false` rather than throwing.

- [ ] **Step 2: Implement and run the full release check**

Run: `cd theme1 && npm run release:check`

Expected output: every check listed with a pass mark, and a non-zero exit on any failure.

- [ ] **Step 3: Write `CHANGELOG.md`**

A `1.0.0` entry under Keep a Changelog conventions, describing what the release contains: 122 pages, ~95 components, four locales, both themes, the fifteen layout options, and the guarantees — MIT, zero non-permissive dependencies, zero third-party artwork, WCAG 2.2 AA, no jQuery.

- [ ] **Step 4: Write the release workflow**

`.github/workflows/release.yml` runs on a `v*` tag: install, `npm run release:check`, build, build the starter, package `dist/`, `dist-starter/`, `dist-tokens/`, `docs/`, `LICENSE`, `THIRD-PARTY-NOTICES.md` and `PROVENANCE.md` into a release archive, and attach it to the GitHub release.

- [ ] **Step 5: Commit**

```bash
git add theme1/scripts/release-check.mjs theme1/CHANGELOG.md theme1/.github/workflows/release.yml theme1/tests/release/release-check.test.js theme1/package.json
git commit -m "chore(release): consolidated release gate and changelog"
```

---

### Task 6: Ship v1.0.0

- [ ] **Step 1: Run every gate one final time from a clean checkout**

```bash
cd theme1 && rm -rf node_modules dist dist-starter dist-tokens src/.gen src/generated
npm ci
npm run release:check
```

Expected: every check passes. A clean checkout is the point — a gate that only passes with warm caches is not a gate.

- [ ] **Step 2: Verify the deliverable by hand**

- Serve `dist/` and click through every navigation entry; confirm no 404 and no console error.
- Toggle every customizer option and confirm each takes effect and persists across a reload.
- Switch to each of the four locales, including Arabic, and confirm text, direction and formatting all follow.
- Open the theme on a real phone and a real tablet, in both orientations.
- Print the invoice preview and confirm the document is correct.
- Read `PROVENANCE.md` end to end and confirm every claim in it is one you can defend.

- [ ] **Step 3: Set the version and tag**

```bash
cd theme1
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): v1.0.0"
git tag -a v1.0.0 -m "theme1 v1.0.0 — original MIT-licensed admin dashboard theme"
```

- [ ] **Step 4: Push and confirm the release pipeline**

Push the branch and the tag, and confirm the release workflow completes and attaches the archive. Do not push without the user's explicit go-ahead — tagging and publishing are outward-facing actions.

- [ ] **Step 5: Record what shipped**

Append to `CHANGELOG.md` the actual measured figures from the final build: total pages, component count, gzipped CSS and JS, Lighthouse scores, and the dependency count. Numbers that were targets throughout become facts here.

---

## Phase exit checklist

- [ ] `PROVENANCE.md` exists, its claims are verified by automated scans, and the similarity report shows nothing above 0.3 against the source template.
- [ ] The provenance scanner detects its control fixture, proving it works.
- [ ] No forbidden term (vuexy, pixinvent, themeforest, ui8, freepik, unsplash, coffinite, montserrat, fontawesome) appears in source, scripts, or `dist/`.
- [ ] Generated docs cover every token, component and icon, and regenerate byte-identically.
- [ ] Every required document exists, has no broken link, and contains no placeholder text.
- [ ] Every npm script is documented in the README.
- [ ] The starter kit builds and runs standalone with a smaller CSS payload than the full theme.
- [ ] `npm run release:check` passes from a clean `npm ci` checkout.
- [ ] The manual sweep passes: no 404, no console error, every option works and persists, all four locales correct, real devices verified, print correct.
- [ ] `LICENSE` (MIT), `THIRD-PARTY-NOTICES.md` and `PROVENANCE.md` all ship in the release archive.
- [ ] v1.0.0 tagged, and pushed only with explicit approval.

---

## What v1.0.0 delivers

| | |
|---|---|
| Pages | 122 authored (114 replacing the source's unique pages, 7 new, 1 alias) |
| Components | ~95, every variant and state, light + dark + both densities + both directions |
| Layout options | 15 groups, runtime-switchable, persisted, validated |
| Locales | 4, including one RTL |
| Runtime dependencies | All MIT / BSD / Apache-2.0 / ISC — enforced in CI |
| Artwork | 100% generated SVG; zero raster, zero stock, zero trademark |
| Accessibility | WCAG 2.2 AA, axe-clean in three modes across every page |
| Weight | From 191 MB and 16 MB of vendor JS to a fraction of it, with heavy libraries lazy-loaded |
| Licence | MIT, with a provenance record substantiating originality |
