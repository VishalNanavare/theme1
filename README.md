# theme1

theme1 is an original, MIT-licensed admin dashboard theme. It is an
original work: it is not derived from, based on, or a reskin of any
commercial admin dashboard template. The markup, styling and build
pipeline in this repository were written for this project.

## Licence

theme1 is released under the [MIT licence](./LICENSE). Third-party
dependency licences are audited on every build and recorded in
[`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).

## Prerequisites

- Node.js >= 20.11.0
- npm >= 10

## Getting started

```bash
npm install
npm run dev
```

## Commands

| Command                  | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Dev server with live re-render on `.njk` change    |
| `npm run build`          | Production build to `dist/`                        |
| `npm run preview`        | Serve `dist/` locally                              |
| `npm test`               | Unit tests                                         |
| `npm run test:watch`     | Unit tests in watch mode                           |
| `npm run render`         | Render `.njk` pages to HTML without a full build   |
| `npm run lint`           | ESLint + Stylelint + Prettier                      |
| `npm run lint:js`        | ESLint only                                        |
| `npm run lint:css`       | Stylelint only                                     |
| `npm run lint:format`    | Prettier check only                                |
| `npm run format`         | Prettier write (auto-fix formatting)               |
| `npm run audit:licenses` | Licence gate; regenerates `THIRD-PARTY-NOTICES.md` |
| `npm run check:budgets`  | Gzipped size gate over `dist/assets`               |

## Continuous integration

Every push and pull request runs the full gate pipeline in
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml), in this
order: lint, build, test, licence audit, bundle budgets. Build runs
before the test suite because later phases add tests that read files
out of `dist/`. A final step fails the build if the licence audit
changed `THIRD-PARTY-NOTICES.md` without that change being committed.
