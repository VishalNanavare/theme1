# Phase 04 — Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete forms system — every field type, every state, validation on the native Constraint Validation API, the multi-step wizard, the repeater, and the 16 form demo pages — with a keyboard path through every control.

**Architecture:** One `formField()` macro owns the label / control / helper / error anatomy so no page ever hand-writes it, and so the label–control–error association is correct by construction. Validation wraps the browser's own Constraint Validation API rather than shipping a validation library; custom rules plug in through a small registry. Enhanced controls (select, date, mask, editor, uploader) are thin adapters over permissively-licensed libraries, each dynamically imported.

**Tech Stack:** Constraint Validation API · Tom Select (Apache-2.0) · Flatpickr (MIT) · Cleave.js (Apache-2.0) · Quill (BSD-3-Clause) · Dropzone (MIT) · bs-stepper (MIT) · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. Quill, Dropzone, Flatpickr and Tom Select are dynamically imported only.
- **Accessibility:** WCAG 2.2 AA. Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- **Fonts self-hosted.** Icons: Feather (MIT) only. **No photographic assets.**
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Non-negotiable form rules

Every control this phase produces obeys all of these, and the tests enforce them:

1. Every control has a programmatic label — `<label for>`, `aria-label`, or `aria-labelledby`. No placeholder-as-label.
2. Helper text is linked with `aria-describedby`; error text is **appended** to `aria-describedby`, never replacing the helper.
3. Invalid controls carry `aria-invalid="true"`; valid ones remove the attribute rather than setting `"false"` on untouched fields.
4. Errors are announced through a per-field `aria-live="polite"` region, and the form-level summary through `role="alert"`.
5. Required fields use the `required` attribute; the asterisk is decorative (`aria-hidden`) with the requirement conveyed in the accessible name.
6. Validation fires on `blur` and on `submit`, and re-validates on `input` **only after** the field has already been marked invalid — validating as someone first types is hostile.
7. On failed submit, focus moves to the first invalid control and the page scrolls it into view.
8. Disabled and readonly are visually and semantically distinct.
9. Every enhanced control degrades to a usable native control if its script fails to load.

## File Structure

| Path | Responsibility |
|---|---|
| `src/partials/ui/form-field.njk` | The field anatomy macro — label, control, helper, error |
| `src/partials/ui/form-layout.njk` | Section, row, actions, fieldset macros |
| `src/scripts/components/form-validate.js` | Validation engine over the Constraint Validation API |
| `src/scripts/core/validators.js` | The custom rule registry |
| `src/scripts/components/select.js` | Tom Select adapter |
| `src/scripts/components/datepicker.js` | Flatpickr adapter |
| `src/scripts/components/input-mask.js` | Cleave adapter |
| `src/scripts/components/number-input.js` | Stepper input, in-house |
| `src/scripts/components/file-upload.js` | Dropzone adapter |
| `src/scripts/components/editor.js` | Quill adapter |
| `src/scripts/components/repeater.js` | Repeatable row groups, in-house |
| `src/scripts/components/wizard.js` | Multi-step form |
| `src/styles/components/_form-*.scss` | Field, control, check, switch, group styling |
| `src/pages/form-*.njk` | The 16 demo pages |

---

### Task 1: Field anatomy macro

**Files:**
- Create: `theme1/src/partials/ui/form-field.njk`
- Create: `theme1/src/styles/components/_form-field.scss`
- Create: `theme1/src/styles/components/_form-control.scss`
- Create: `theme1/src/pages/form-input.njk`
- Test: `theme1/tests/unit/form-field.test.js`

**Interfaces:**
- Consumes: tier-3 `--t-input-*` knobs; `icon()`.
- Produces: `formField(opts)` with

```
{ id, name, label, type, value, placeholder, helper, error, required, disabled, readonly,
  size: 'sm'|'md'|'lg', iconStart, iconEnd, prefix, suffix, labelStyle: 'stacked'|'floating'|'merged'|'inline',
  autocomplete, attrs }
```

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/form-field.test.js`. It renders the macro through Nunjucks and asserts the resulting DOM:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../../src', import.meta.url));
const env = nunjucks.configure([srcDir], { autoescape: true, noCache: true });

function render(opts) {
  const html = env.renderString(
    `{% from "partials/ui/form-field.njk" import formField %}{{ formField(opts) }}`,
    { opts },
  );
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('labelling', () => {
  it('associates the label with the control', () => {
    const doc = render({ id: 'email', name: 'email', label: 'Email address', type: 'email' });
    const input = doc.querySelector('input');
    const label = doc.querySelector('label');
    expect(label.getAttribute('for')).toBe('email');
    expect(input.id).toBe('email');
    expect(label.textContent).toContain('Email address');
  });

  it('never uses the placeholder as the only label', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name', placeholder: 'Jane Doe' });
    expect(doc.querySelector('label')).not.toBeNull();
    expect(doc.querySelector('input').placeholder).toBe('Jane Doe');
  });

  it('marks the required asterisk decorative and states the requirement accessibly', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name', required: true });
    expect(doc.querySelector('input').required).toBe(true);
    expect(doc.querySelector('.t-field__required').getAttribute('aria-hidden')).toBe('true');
    expect(doc.querySelector('label').textContent).toMatch(/required/i);
  });
});

describe('description wiring', () => {
  it('links helper text with aria-describedby', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name', helper: 'As it appears on your card' });
    const input = doc.querySelector('input');
    const helper = doc.querySelector('.t-field__helper');
    expect(input.getAttribute('aria-describedby').split(/\s+/)).toContain(helper.id);
  });

  it('appends the error id, keeping the helper id', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name', helper: 'Helper', error: 'Required' });
    const ids = doc.querySelector('input').getAttribute('aria-describedby').split(/\s+/);
    expect(ids).toContain(doc.querySelector('.t-field__helper').id);
    expect(ids).toContain(doc.querySelector('.t-field__error').id);
  });

  it('marks an errored control invalid', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name', error: 'Required' });
    expect(doc.querySelector('input').getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves aria-invalid off an untouched control', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name' });
    expect(doc.querySelector('input').hasAttribute('aria-invalid')).toBe(false);
  });

  it('gives the error slot a polite live region so changes are announced', () => {
    const doc = render({ id: 'a', name: 'a', label: 'Name' });
    expect(doc.querySelector('.t-field__error').getAttribute('aria-live')).toBe('polite');
  });

  it('generates unique ids when none is supplied', () => {
    const first = render({ name: 'a', label: 'A' }).querySelector('input').id;
    const second = render({ name: 'b', label: 'B' }).querySelector('input').id;
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

describe('control types', () => {
  it.each(['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'color'])(
    'renders an input of type %s',
    (type) => {
      expect(render({ id: 't', name: 't', label: 'L', type }).querySelector('input').type).toBe(type);
    },
  );

  it('renders a textarea', () => {
    expect(render({ id: 't', name: 't', label: 'L', type: 'textarea' }).querySelector('textarea')).not.toBeNull();
  });

  it('renders a select with its options', () => {
    const doc = render({ id: 't', name: 't', label: 'L', type: 'select', options: [{ value: '1', label: 'One' }] });
    expect(doc.querySelectorAll('select option')).toHaveLength(1);
  });
});

describe('states and decoration', () => {
  it('applies disabled and readonly to the control, not just the wrapper', () => {
    expect(render({ id: 'a', name: 'a', label: 'L', disabled: true }).querySelector('input').disabled).toBe(true);
    expect(render({ id: 'a', name: 'a', label: 'L', readonly: true }).querySelector('input').readOnly).toBe(true);
  });

  it.each(['sm', 'md', 'lg'])('applies the %s size class', (size) => {
    expect(render({ id: 'a', name: 'a', label: 'L', size }).querySelector('.t-field').className).toContain(size);
  });

  it('marks decorative icons aria-hidden', () => {
    const doc = render({ id: 'a', name: 'a', label: 'L', iconStart: 'search' });
    expect(doc.querySelector('.t-field__icon svg').getAttribute('aria-hidden')).toBe('true');
  });

  it.each(['stacked', 'floating', 'merged', 'inline'])('supports the %s label style', (labelStyle) => {
    const doc = render({ id: 'a', name: 'a', label: 'L', labelStyle });
    expect(doc.querySelector('.t-field').className).toContain(labelStyle);
    expect(doc.querySelector('label')).not.toBeNull();
  });

  it('passes autocomplete through, because password managers need it', () => {
    const doc = render({ id: 'a', name: 'a', label: 'L', type: 'email', autocomplete: 'email' });
    expect(doc.querySelector('input').getAttribute('autocomplete')).toBe('email');
  });

  it('escapes label and helper text', () => {
    const doc = render({ id: 'a', name: 'a', label: '<script>x</script>', helper: '<b>y</b>' });
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('.t-field__helper b')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/form-field.test.js`
Expected: FAIL — `partials/ui/form-field.njk` not found.

- [ ] **Step 3: Write `src/partials/ui/form-field.njk`**

One macro satisfying every assertion. Key points: generate an id from `name` plus a counter when `id` is absent; build `aria-describedby` by joining only the ids that exist; always render the `.t-field__error` element with `aria-live="polite"` even when empty, so JavaScript has a stable target; render the required note as visually-hidden text inside the label alongside the `aria-hidden` asterisk.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/form-field.test.js`
Expected: PASS — 27 tests.

- [ ] **Step 5: Write the stylesheets and the first demo page**

`_form-field.scss`: the field wrapper, label, helper, error, required marker, sizes, and the four label styles — floating uses `:placeholder-shown` plus `:focus-within`, merged puts the label inside the control's border, inline uses a grid so labels align.

`_form-control.scss`: the control itself — background, border, radius, height from `--t-input-height`, placeholder colour, `:focus-visible` ring, `:disabled`, `:read-only`, `[aria-invalid="true"]`, valid state, icon padding via `padding-inline-start`, prefix and suffix addons.

`form-input.njk`: basic inputs, all sizes, all types, with icons, with prefix/suffix, all four label styles, and every state.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/partials/ui/form-field.njk theme1/src/styles/components/_form-field.scss theme1/src/styles/components/_form-control.scss theme1/src/pages/form-input.njk theme1/tests/unit/form-field.test.js
git commit -m "feat(forms): field anatomy macro with correct label and description wiring"
```

---

### Task 2: Validation engine

**Files:**
- Create: `theme1/src/scripts/core/validators.js`
- Create: `theme1/src/scripts/components/form-validate.js`
- Create: `theme1/src/pages/form-validation.njk`
- Test: `theme1/tests/unit/validators.test.js`, `theme1/tests/unit/form-validate.test.js`

**Interfaces:**
- Consumes: `formField()`; the registry.
- Produces:
  - `registerValidator(name, { validate(value, param, field) => boolean, message(param) => string })`
  - `getValidator(name)`, `listValidators()`
  - Built-ins: `required`, `email`, `url`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `match`, `numeric`, `integer`, `alphanumeric`, `phone`, `creditCard`, `strongPassword`, `fileSize`, `fileType`, `dateAfter`, `dateBefore`, `remote`
  - From `form-validate.js`: `init`, `destroy`, `validateField(field) => { valid, message }`, `validateForm(form) => { valid, errors }`, `showErrors(form, errors)`, `clearErrors(form)`
  - Events: `form:invalid`, `form:valid`, `field:invalid`, `field:valid`

- [ ] **Step 1: Write the failing tests**

`tests/unit/validators.test.js` tests each built-in as a pure function. The cases that matter:

```js
import { describe, it, expect } from 'vitest';
import { getValidator, registerValidator, listValidators } from '../../src/scripts/core/validators.js';

const run = (name, value, param) => getValidator(name).validate(value, param);

describe('required', () => {
  it.each(['', '   ', '\t\n', null, undefined])('rejects %j', (v) => expect(run('required', v)).toBe(false));
  it.each(['a', '0', 'false'])('accepts %j', (v) => expect(run('required', v)).toBe(true));
  it('accepts an array with entries and rejects an empty one', () => {
    expect(run('required', ['a'])).toBe(true);
    expect(run('required', [])).toBe(false);
  });
});

describe('email', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com', "o'brien@example.com"])('accepts %s', (v) =>
    expect(run('email', v)).toBe(true));
  it.each(['a@', '@b.co', 'a b@c.co', 'a@b', 'a@@b.co', 'a@b..co'])('rejects %s', (v) =>
    expect(run('email', v)).toBe(false));
  it('treats empty as valid — emptiness is required\'s job', () => expect(run('email', '')).toBe(true));
});

describe('minLength and maxLength', () => {
  it('counts characters, not bytes', () => {
    expect(run('minLength', 'ab', 3)).toBe(false);
    expect(run('minLength', 'abc', 3)).toBe(true);
    expect(run('maxLength', 'abcd', 3)).toBe(false);
  });
  it('counts an emoji as one grapheme, not two code units', () => {
    expect(run('maxLength', '👍', 1)).toBe(true);
  });
});

describe('min and max', () => {
  it('compares numerically, not lexically', () => {
    expect(run('min', '9', 10)).toBe(false);
    expect(run('max', '9', 10)).toBe(true);
  });
  it('handles negative and decimal values', () => {
    expect(run('min', '-5', -10)).toBe(true);
    expect(run('max', '1.5', 1.5)).toBe(true);
  });
  it('rejects a non-numeric value', () => expect(run('min', 'abc', 0)).toBe(false));
});

describe('strongPassword', () => {
  it.each(['Passw0rd!', 'aB3$xyzw'])('accepts %s', (v) => expect(run('strongPassword', v)).toBe(true));
  it.each(['password', 'PASSWORD1', 'Pass1', 'abcdefgh'])('rejects %s', (v) =>
    expect(run('strongPassword', v)).toBe(false));
});

describe('creditCard', () => {
  it('accepts a Luhn-valid number with spaces', () => expect(run('creditCard', '4242 4242 4242 4242')).toBe(true));
  it('rejects a Luhn-invalid number', () => expect(run('creditCard', '4242424242424241')).toBe(false));
  it('rejects letters', () => expect(run('creditCard', '4242abcd')).toBe(false));
});

describe('registry', () => {
  it('registers a custom rule and exposes it', () => {
    registerValidator('even', { validate: (v) => Number(v) % 2 === 0, message: () => 'Must be even' });
    expect(run('even', '4')).toBe(true);
    expect(listValidators()).toContain('even');
  });
  it('rejects a duplicate registration', () => {
    expect(() => registerValidator('required', { validate: () => true, message: () => '' })).toThrow(/required/);
  });
  it('throws a clear error for an unknown rule', () => {
    expect(() => getValidator('nope')).toThrow(/nope/);
  });
});
```

`tests/unit/form-validate.test.js` covers the DOM behaviour: no validation on first `input`; validation on `blur`; re-validation on `input` **after** a field is already invalid; `submit` prevented when invalid; focus moved to the first invalid control; `aria-invalid` set and cleared; error text written into `.t-field__error` with `textContent`; `aria-describedby` gaining and losing the error id without losing the helper id; the form-level summary getting `role="alert"` and listing each error as a link to its field; `novalidate` set on the form so the browser's own bubbles do not compete; and `destroy()` restoring the form to its unbound state.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/validators.test.js tests/unit/form-validate.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both modules**

`validators.js` is pure and dependency-free. Every rule treats an empty value as valid so that `required` remains the single source of emptiness. `minLength`/`maxLength` count graphemes with `Intl.Segmenter` where available, falling back to `[...string].length`.

`form-validate.js` reads rules from `data-t-rules` on each control (a JSON object such as `{"required":true,"minLength":8}`), merges them with the native constraints the browser already reports through `validity`, and never calls `reportValidity()` — we render our own messages so they can be styled and translated.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/validators.test.js tests/unit/form-validate.test.js`
Expected: PASS.

- [ ] **Step 5: Build `form-validation.njk`**

Demonstrate: every built-in rule; inline errors and tooltip-style errors; a form-level error summary; async/remote validation with a pending state; cross-field validation (`match`); and a custom rule registered on the page.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/core/validators.js theme1/src/scripts/components/form-validate.js theme1/src/pages/form-validation.njk theme1/tests/unit/validators.test.js theme1/tests/unit/form-validate.test.js
git commit -m "feat(forms): validation engine on the constraint validation api"
```

---

### Task 3: Choice controls — checkbox, radio, switch

**Files:**
- Create: `theme1/src/partials/ui/form-check.njk`
- Create: `theme1/src/styles/components/_form-check.scss`, `_form-switch.scss`
- Create: `theme1/src/pages/form-checkbox.njk`, `form-radio.njk`, `form-switch.njk`
- Test: `theme1/tests/unit/form-check.test.js`

**Interfaces:**
- Produces: `check(opts)` and `checkGroup(opts)` — `{ type: 'checkbox'|'radio'|'switch', id, name, value, label, helper, intent, size, checked, indeterminate, disabled, style: 'default'|'button'|'card', inline }`

- [ ] **Step 1: Write the failing test**

Assert, via rendered DOM: the control is a real `<input type="checkbox|radio">` with a visual layer, never a `<div role="checkbox">`; the label is associated; `indeterminate` is set as a **property** through a `data-t-indeterminate` hook rather than an attribute, since HTML has no such attribute; a radio group is wrapped in `<fieldset>` with a `<legend>`; `inline` does not break the group semantics; the `switch` type renders `role="switch"` with `aria-checked` kept in step; card style keeps the input focusable and does not rely on the click landing on the label; and `disabled` reaches the input.

Also assert the keyboard contract: within a radio group, arrow keys move and select, and `Tab` enters and leaves the whole group as one stop — the native behaviour, which we must not break with `tabindex` meddling.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/form-check.test.js`
Expected: FAIL — macro not found.

- [ ] **Step 3: Implement the macro and styles**

Style the native input with `appearance: none` so it stays a real control, and draw the check/dot/thumb with `::before`. Cover six intents, three sizes, checked, indeterminate, disabled, focus-visible, and the button and card styles. The switch thumb must translate on the **inline** axis so it moves the correct way in RTL.

Add a tiny `indeterminate.js` that sets `el.indeterminate = true` for `[data-t-indeterminate]`, registered with the registry.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/form-check.test.js`
Expected: PASS.

- [ ] **Step 5: Build the three demo pages, then commit**

```bash
git add theme1/src/partials/ui/form-check.njk theme1/src/styles/components/_form-check.scss theme1/src/styles/components/_form-switch.scss theme1/src/scripts/components/indeterminate.js theme1/src/pages/form-checkbox.njk theme1/src/pages/form-radio.njk theme1/src/pages/form-switch.njk theme1/tests/unit/form-check.test.js
git commit -m "feat(forms): checkbox, radio and switch on native controls"
```

---

### Task 4: Enhanced controls — select, date/time, mask, number

**Files:**
- Create: `theme1/src/scripts/components/select.js`, `datepicker.js`, `input-mask.js`, `number-input.js`
- Create: `theme1/src/styles/components/_select.scss`, `_datepicker.scss`, `_number-input.scss`
- Create: `theme1/src/pages/form-select.njk`, `form-date-time-picker.njk`, `form-input-mask.njk`, `form-number-input.njk`, `form-input-groups.njk`
- Test: `theme1/tests/unit/components/number-input.test.js`, `tests/unit/components/select.test.js`

**Interfaces:**
- Consumes: Tom Select, Flatpickr, Cleave — all dynamically imported.
- Produces: `init`/`destroy`/`defaults` per module; `number-input.js` additionally exports `clamp(value, min, max, step) => number` and `stepValue(value, step, direction, min, max) => number`.

- [ ] **Step 1: Write the failing test**

`number-input.test.js` tests the arithmetic as pure functions first — this is where floating-point bugs hide:

```js
import { describe, it, expect } from 'vitest';
import { clamp, stepValue } from '../../../src/scripts/components/number-input.js';

describe('clamp', () => {
  it('bounds within min and max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('tolerates absent bounds', () => {
    expect(clamp(5, undefined, undefined)).toBe(5);
    expect(clamp(-99, undefined, 10)).toBe(-99);
  });
  it('returns min when min exceeds max, rather than NaN', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});

describe('stepValue', () => {
  it('increments and decrements by step', () => {
    expect(stepValue(1, 1, 1)).toBe(2);
    expect(stepValue(1, 1, -1)).toBe(0);
  });
  it('does not accumulate floating-point error', () => {
    expect(stepValue(0.1, 0.2, 1)).toBe(0.3);
    expect(stepValue(0.3, 0.1, -1)).toBe(0.2);
  });
  it('respects a decimal step across many increments', () => {
    let v = 0;
    for (let i = 0; i < 10; i += 1) v = stepValue(v, 0.1, 1);
    expect(v).toBe(1);
  });
  it('clamps at the bounds', () => {
    expect(stepValue(10, 1, 1, 0, 10)).toBe(10);
    expect(stepValue(0, 1, -1, 0, 10)).toBe(0);
  });
  it('treats an empty starting value as min, or zero when there is no min', () => {
    expect(stepValue(NaN, 1, 1, 5, 10)).toBe(5);
    expect(stepValue(NaN, 1, 1)).toBe(1);
  });
});
```

The DOM half asserts: the visible control is `<input type="number">` (or `inputmode="decimal"` with `role="spinbutton"` and `aria-valuenow/min/max`); the increment and decrement buttons have accessible names and are `aria-hidden` from the tab order only if the input itself handles arrows; `ArrowUp`/`ArrowDown` step; `PageUp`/`PageDown` step by ten; `Home`/`End` jump to min and max; buttons disable at the bounds; and holding a button repeats after a delay.

`select.test.js` asserts the adapter contract without loading Tom Select: `init` leaves the native `<select>` in the DOM and functional if the dynamic import rejects; `destroy` restores it; `getValue`/`setValue` work in both enhanced and fallback modes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/number-input.test.js tests/unit/components/select.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the modules**

`stepValue` avoids floating-point drift by scaling to integers using the step's decimal places, doing integer arithmetic, then scaling back.

Each adapter follows the same shape: mark the element initialised, `await import()` the library inside a `try`, and on failure log a warning and leave the native control alone. Add the libraries:

```bash
cd theme1 && npm install tom-select flatpickr cleave.js
```

Then run `npm run audit:licenses` and confirm all three are permitted.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS.

- [ ] **Step 5: Build the five demo pages**

Cover every variant from spec §7: select single / multi / searchable / tag-input / grouped / avatar rows / clearable / async / disabled options / three sizes; date / time / datetime / range / multiple / inline / human-friendly / min-max / disabled dates / locale; masks for phone, credit card, date, time, numeral with thousands separator, blocks, prefix, and a custom delimiter; number input with min/max/step/decimals, and quantity and currency presets; input groups with text addons, buttons, dropdowns, checkboxes, and segmented addons.

Restyle the third-party widgets entirely from our tokens — the point is that a Flatpickr calendar looks like theme1, not like Flatpickr.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/components/ theme1/src/styles/components/ theme1/src/pages/form-*.njk theme1/package.json theme1/tests/unit/components/
git commit -m "feat(forms): select, date/time, mask and number controls"
```

---

### Task 5: Rich controls — textarea, editor, file upload

**Files:**
- Create: `theme1/src/scripts/components/textarea-autosize.js`, `editor.js`, `file-upload.js`
- Create: `theme1/src/styles/components/_editor.scss`, `_file-upload.scss`
- Create: `theme1/src/pages/form-textarea.njk`, `form-quill-editor.njk`, `form-file-uploader.njk`
- Test: `theme1/tests/unit/components/textarea-autosize.test.js`, `tests/unit/components/file-upload.test.js`

**Interfaces:**
- Produces: `autosize(el)`, `charCount(el)` from `textarea-autosize.js`; `formatBytes(n)`, `validateFile(file, { maxSize, accept })` from `file-upload.js`.

- [ ] **Step 1: Write the failing test**

`file-upload.test.js` covers the pure helpers exhaustively, because these are what users actually hit:

```js
import { describe, it, expect } from 'vitest';
import { formatBytes, validateFile } from '../../../src/scripts/components/file-upload.js';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [1048576, '1 MB'],
    [1073741824, '1 GB'],
  ])('formats %i as %s', (input, expected) => expect(formatBytes(input)).toBe(expected));
});

describe('validateFile', () => {
  const file = (name, size, type) => ({ name, size, type });

  it('accepts a file inside the size limit', () => {
    expect(validateFile(file('a.png', 1000, 'image/png'), { maxSize: 2000 }).valid).toBe(true);
  });

  it('rejects an oversized file and says both sizes', () => {
    const result = validateFile(file('a.png', 3000, 'image/png'), { maxSize: 2000 });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('2 KB');
  });

  it('accepts a matching mime type', () => {
    expect(validateFile(file('a.png', 10, 'image/png'), { accept: ['image/png'] }).valid).toBe(true);
  });

  it('accepts a wildcard mime type', () => {
    expect(validateFile(file('a.png', 10, 'image/png'), { accept: ['image/*'] }).valid).toBe(true);
  });

  it('accepts an extension rule', () => {
    expect(validateFile(file('a.PNG', 10, ''), { accept: ['.png'] }).valid).toBe(true);
  });

  it('rejects a type that does not match', () => {
    expect(validateFile(file('a.exe', 10, 'application/x-msdownload'), { accept: ['image/*'] }).valid).toBe(false);
  });

  it('rejects a zero-byte file', () => {
    expect(validateFile(file('a.png', 0, 'image/png'), {}).valid).toBe(false);
  });

  it('accepts anything when no rules are given', () => {
    expect(validateFile(file('a.bin', 10, ''), {}).valid).toBe(true);
  });
});
```

The DOM half asserts: the drop zone is keyboard-reachable and activates on `Enter`/`Space`; drag-over state is applied and removed, including when the drag leaves the window; rejected files produce an error announced in a live region; the file list is a real list with a remove button per item carrying the file name in its accessible name; and upload progress is exposed through `role="progressbar"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/file-upload.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the modules**

Install `dropzone` and `quill`, audit the licences, and write both as dynamic-import adapters with native fallbacks — a plain `<input type="file" multiple>` and a plain `<textarea>` respectively.

Restyle the Quill toolbar entirely from our tokens and give every toolbar button an `aria-label`; Quill's defaults ship without them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/file-upload.test.js tests/unit/components/textarea-autosize.test.js`
Expected: PASS.

- [ ] **Step 5: Build the three demo pages, then commit**

```bash
git add theme1/src/scripts/components/ theme1/src/styles/components/ theme1/src/pages/form-textarea.njk theme1/src/pages/form-quill-editor.njk theme1/src/pages/form-file-uploader.njk theme1/package.json theme1/tests/unit/components/
git commit -m "feat(forms): autosize textarea, rich editor and file uploader"
```

---

### Task 6: Repeater and wizard

**Files:**
- Create: `theme1/src/scripts/components/repeater.js`, `wizard.js`
- Create: `theme1/src/partials/ui/wizard.njk`
- Create: `theme1/src/styles/components/_wizard.scss`, `_repeater.scss`
- Create: `theme1/src/pages/form-repeater.njk`, `form-wizard.njk`, `form-layout.njk`
- Test: `theme1/tests/unit/components/repeater.test.js`, `tests/unit/components/wizard.test.js`

**Interfaces:**
- Produces:
  - `repeater` — `init`, `destroy`, `addRow(el, values?)`, `removeRow(rowEl)`, `getValues(el)`; events `repeater:add`, `repeater:remove`
  - `wizard` — `init`, `destroy`, `goTo(el, index)`, `next(el)`, `prev(el)`, `getStep(el)`; events `wizard:change`, `wizard:complete`

- [ ] **Step 1: Write the failing tests**

`repeater.test.js` asserts: a template row is cloned, not deep-copied from a live row, so no stale values leak; every cloned control's `name` is re-indexed (`items[0][price]` → `items[1][price]`); ids and `for`/`aria-describedby` references are rewritten so associations stay unique; the remove button of the **only** remaining row is disabled when `minRows` is 1; adding past `maxRows` is refused; focus moves into the first control of a new row; removing a row moves focus to the next row's first control, or the add button if none remains; and `repeater:add`/`repeater:remove` are cancelable.

`wizard.test.js` asserts: steps expose `role="tablist"`/`tab`/`tabpanel` with `aria-selected` and `aria-controls`; only the active panel is visible; in **linear** mode a forward jump is refused while the current step is invalid, and the first invalid field receives focus; in **non-linear** mode any step is reachable; step indicators show visited, current, completed, and error states; `next` on the last step emits `wizard:complete`; `prev` on the first step is a no-op; the browser's back button does not lose progress (state is kept in `history.replaceState`); and `destroy` restores all panels to visible so the form still submits without JavaScript.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd theme1 && npx vitest run tests/unit/components/repeater.test.js tests/unit/components/wizard.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both modules**

`repeater.js` is in-house — the source template's jQuery plugin has no vanilla equivalent worth adding. Re-indexing is a pure function, `reindex(html|element, index)`; test it directly.

`wizard.js` builds on `bs-stepper` for the visual stepper but owns validation gating, focus management, and history itself.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd theme1 && npx vitest run tests/unit/components/`
Expected: PASS.

- [ ] **Step 5: Build the three demo pages**

`form-layout.njk` covers vertical, horizontal, inline, gridded, sectioned with dividers, with a sticky action bar, and a two-column responsive form that collapses to one column below `md`.

- [ ] **Step 6: Commit**

```bash
git add theme1/src/scripts/components/repeater.js theme1/src/scripts/components/wizard.js theme1/src/partials/ui/wizard.njk theme1/src/styles/components/_wizard.scss theme1/src/styles/components/_repeater.scss theme1/src/pages/form-repeater.njk theme1/src/pages/form-wizard.njk theme1/src/pages/form-layout.njk theme1/tests/unit/components/
git commit -m "feat(forms): repeater and validated multi-step wizard"
```

---

### Task 7: Forms accessibility and keyboard gate

**Files:**
- Create: `theme1/tests/a11y/forms.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js` (extend `PAGES`)
- Modify: `theme1/src/data/navigation.json`

**Interfaces:**
- Consumes: all 16 form pages.
- Produces: the gate proving the non-negotiable form rules hold on every page.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/a11y/forms.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const distDir = fileURLToPath(new URL('../../dist', import.meta.url));

const FORM_PAGES = [
  'form-input.html', 'form-input-groups.html', 'form-input-mask.html', 'form-textarea.html',
  'form-checkbox.html', 'form-radio.html', 'form-switch.html', 'form-select.html',
  'form-number-input.html', 'form-file-uploader.html', 'form-quill-editor.html',
  'form-date-time-picker.html', 'form-layout.html', 'form-wizard.html',
  'form-validation.html', 'form-repeater.html',
];

async function load(file) {
  return new JSDOM(await readFile(path.join(distDir, file), 'utf8')).window.document;
}

describe.each(FORM_PAGES)('%s', (file) => {
  it('labels every control', async () => {
    const doc = await load(file);
    const unlabelled = [...doc.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter((field) => {
      if (field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby')) return false;
      if (field.id && doc.querySelector(`label[for="${CSS.escape(field.id)}"]`)) return false;
      return !field.closest('label');
    });
    expect(unlabelled.map((f) => f.outerHTML.slice(0, 100))).toEqual([]);
  });

  it('points every aria-describedby at an element that exists', async () => {
    const doc = await load(file);
    const broken = [];
    for (const el of doc.querySelectorAll('[aria-describedby]')) {
      for (const id of el.getAttribute('aria-describedby').split(/\s+/).filter(Boolean)) {
        if (!doc.getElementById(id)) broken.push(`${el.tagName}#${el.id} -> ${id}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('uses no duplicate ids', async () => {
    const doc = await load(file);
    const ids = [...doc.querySelectorAll('[id]')].map((el) => el.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('wraps every radio group in a fieldset with a legend', async () => {
    const doc = await load(file);
    const names = new Set([...doc.querySelectorAll('input[type="radio"]')].map((r) => r.name).filter(Boolean));
    for (const name of names) {
      const radio = doc.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]`);
      const fieldset = radio.closest('fieldset');
      expect(fieldset, `radio group "${name}" is not in a fieldset`).not.toBeNull();
      expect(fieldset.querySelector('legend'), `radio group "${name}" has no legend`).not.toBeNull();
    }
  });

  it('never relies on a placeholder as the only label', async () => {
    const doc = await load(file);
    const placeholderOnly = [...doc.querySelectorAll('[placeholder]')].filter(
      (el) => !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !(el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)),
    );
    expect(placeholderOnly.map((f) => f.outerHTML.slice(0, 100))).toEqual([]);
  });

  it('sets novalidate so our messages are the only ones shown', async () => {
    const doc = await load(file);
    for (const form of doc.querySelectorAll('form[data-t-validate]')) {
      expect(form.hasAttribute('novalidate')).toBe(true);
    }
  });

  it('gives every submit button an accessible name', async () => {
    const doc = await load(file);
    for (const button of doc.querySelectorAll('button[type="submit"], input[type="submit"]')) {
      const name = button.textContent.trim() || button.getAttribute('aria-label') || button.value;
      expect(name, button.outerHTML.slice(0, 100)).toBeTruthy();
    }
  });

  it('gives every enhanced control a native fallback in the markup', async () => {
    const doc = await load(file);
    for (const el of doc.querySelectorAll('[data-t-select]')) {
      expect(el.tagName.toLowerCase(), 'enhanced select must be a real <select>').toBe('select');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npm run build && npx vitest run tests/a11y/forms.test.js`
Expected: FAIL on the pages not yet built, and on any real labelling defect.

- [ ] **Step 3: Fix every failure at source**

Fix the **markup or macro**, never the test. A duplicate-id failure usually means a macro is not generating unique ids; a broken `aria-describedby` usually means an error element was omitted when a field had no helper.

- [ ] **Step 4: Extend the axe gate**

Add the 16 form page filenames to `PAGES` in `tests/a11y/style-guide.test.js`, and add all 16 pages to `navigation.json` under "Forms & Tables".

- [ ] **Step 5: Run the full gate**

Run:

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run check:budgets
```

Expected: every command exits 0. If the budget fails, confirm Quill, Dropzone, Flatpickr and Tom Select are in **dynamic** imports and absent from the shared chunk.

- [ ] **Step 6: Commit**

```bash
git add theme1/tests/a11y/forms.test.js theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json
git commit -m "test(forms): labelling, description and keyboard gates across all 16 form pages"
```

---

## Phase exit checklist

- [ ] All 16 form pages build and appear in the navigation.
- [ ] `npm run test` green, including the validator and control test suites.
- [ ] `npm run test:a11y` reports 0 critical/serious violations on all 16 form pages in both themes.
- [ ] Every control is labelled; no placeholder-only labels; no duplicate ids; no dangling `aria-describedby`.
- [ ] Validation fires on blur and submit, and only re-validates on input **after** a field is invalid.
- [ ] Failed submit moves focus to the first invalid control.
- [ ] Every enhanced control degrades to a working native control when its dynamic import fails — verify by blocking the chunk in devtools.
- [ ] The wizard gates forward navigation in linear mode and restores all panels on `destroy`.
- [ ] `stepValue` accumulates no floating-point error over 10 increments of 0.1.
- [ ] `npm run check:budgets` passes with the heavy editors lazy-loaded.
- [ ] CI green.

**Unblocks:** Phases 07–12, which consume these form components.
