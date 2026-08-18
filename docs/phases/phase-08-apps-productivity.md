# Phase 08 — Apps I: Email, Chat, Todo, Calendar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four productivity apps, each with its full screen anatomy, every action, every empty state, and a keyboard path that does not depend on drag-and-drop or hover.

**Architecture:** All four share one **app shell** — a collapsible app sidebar, a list pane, and a detail pane — implemented once in `src/partials/app/` and specialised per app. State (selected item, active filter, search query) lives in a small per-app store mirrored into the URL, so a view is shareable and survives reload. Demo data is JSON; no app performs network I/O.

**Tech Stack:** Nunjucks · SCSS · vanilla ES modules · FullCalendar (MIT, dynamic import) · Vitest + jsdom

## Global Constraints

- **Node** ≥ 20.11.0. **npm** ≥ 10.
- **Bootstrap 5.3.x only.** Selective imports; never the barrel file.
- **No jQuery.**
- **Runtime dependencies** must be MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, or Unlicense. Dev-only additionally may be MPL-2.0.
- **No file may be copied, adapted, or transcribed from `d:/webserver/www/sample_theme`.**
- **CSS class prefix `t-`; custom-property prefix `--t-`.**
- **All directional CSS uses logical properties.**
- **No inline event handlers. No `innerHTML` with non-literal data. No `eval` / `new Function`.**
- **Budgets:** shared CSS ≤ 120 KB gzipped; typical page JS ≤ 400 KB gzipped. FullCalendar is dynamically imported.
- **Accessibility:** WCAG 2.2 AA. **Every drag-and-drop interaction must have a keyboard equivalent.**
- **Icons: Feather (MIT) only. No photographic assets** — avatars come from Phase 06's generator.
- **Licence:** MIT, with generated `THIRD-PARTY-NOTICES.md`.

## Shared app shell

| Region | Behaviour |
|---|---|
| **App sidebar** | Compose/primary action, folders or filters with counts, labels/tags. Off-canvas below `lg`. |
| **List pane** | Search, bulk select, sort, the item list, pagination or infinite scroll, empty state. |
| **Detail pane** | Selected item, its actions, and a "nothing selected" state. Becomes a full-screen view below `md`. |
| **Responsive rule** | ≥ `xl`: three panes. `lg`–`xl`: sidebar off-canvas, two panes. < `md`: one pane at a time with back navigation. |

Every list is a real list (`<ul>`/`<ol>`); selection uses `aria-selected` with roving tabindex; the detail pane is an `aria-live="polite"` region so a screen reader hears what was opened.

---

### Task 1: App shell

**Files:**
- Create: `theme1/src/partials/app/shell.njk`, `sidebar.njk`, `list-pane.njk`, `detail-pane.njk`
- Create: `theme1/src/layouts/app.njk`
- Create: `theme1/src/scripts/core/app-state.js`
- Create: `theme1/src/styles/pages/_app-shell.scss`
- Test: `theme1/tests/unit/app-state.test.js`

**Interfaces:**
- Produces:
  - `createAppState({ key, defaults, schema }) => { get, set, subscribe, reset, toQuery, fromQuery }`
  - State syncs to `location.search` via `history.replaceState` — never `pushState`, which would trap the back button inside filter changes.

- [ ] **Step 1: Write the failing test**

Create `theme1/tests/unit/app-state.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppState } from '../../src/scripts/core/app-state.js';

const schema = {
  folder: { values: ['inbox', 'sent', 'draft', 'trash'], default: 'inbox' },
  query: { type: 'string', default: '' },
  selected: { type: 'string', default: '' },
  page: { type: 'number', default: 1, min: 1 },
};

beforeEach(() => {
  window.history.replaceState({}, '', '/app-email.html');
});

describe('createAppState', () => {
  it('starts at the declared defaults', () => {
    expect(createAppState({ key: 'email', schema }).get()).toEqual({ folder: 'inbox', query: '', selected: '', page: 1 });
  });

  it('reads initial state from the query string', () => {
    window.history.replaceState({}, '', '/app-email.html?folder=sent&page=3');
    const state = createAppState({ key: 'email', schema }).get();
    expect(state.folder).toBe('sent');
    expect(state.page).toBe(3);
  });

  it('falls back to the default for an out-of-schema value', () => {
    window.history.replaceState({}, '', '/app-email.html?folder=evil');
    expect(createAppState({ key: 'email', schema }).get().folder).toBe('inbox');
  });

  it('clamps a numeric value below its minimum', () => {
    window.history.replaceState({}, '', '/app-email.html?page=0');
    expect(createAppState({ key: 'email', schema }).get().page).toBe(1);
  });

  it('ignores a non-numeric value where a number is expected', () => {
    window.history.replaceState({}, '', '/app-email.html?page=abc');
    expect(createAppState({ key: 'email', schema }).get().page).toBe(1);
  });

  it('does not reflect unknown query parameters into state', () => {
    window.history.replaceState({}, '', '/app-email.html?evil=1');
    expect(createAppState({ key: 'email', schema }).get()).not.toHaveProperty('evil');
  });

  it('writes changes back to the query string with replaceState', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const state = createAppState({ key: 'email', schema });
    state.set({ folder: 'sent' });
    expect(new URLSearchParams(window.location.search).get('folder')).toBe('sent');
    expect(spy, 'filter changes must not create history entries').not.toHaveBeenCalled();
  });

  it('omits defaults from the query string, keeping URLs short', () => {
    const state = createAppState({ key: 'email', schema });
    state.set({ folder: 'sent' });
    state.set({ folder: 'inbox' });
    expect(window.location.search).not.toContain('folder');
  });

  it('notifies subscribers with the changed keys', () => {
    const state = createAppState({ key: 'email', schema });
    const seen = [];
    state.subscribe((next, changed) => seen.push(changed));
    state.set({ folder: 'sent', page: 2 });
    expect(seen[0].sort()).toEqual(['folder', 'page']);
  });

  it('does not notify when nothing actually changed', () => {
    const state = createAppState({ key: 'email', schema });
    const spy = vi.fn();
    state.subscribe(spy);
    state.set({ folder: 'inbox' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('resets page to 1 whenever a filter changes', () => {
    const state = createAppState({ key: 'email', schema, resetPageOn: ['folder', 'query'] });
    state.set({ page: 5 });
    state.set({ folder: 'sent' });
    expect(state.get().page).toBe(1);
  });

  it('escapes a hostile query value rather than echoing it', () => {
    window.history.replaceState({}, '', `/app-email.html?query=${encodeURIComponent('<img src=x>')}`);
    expect(createAppState({ key: 'email', schema }).get().query).toBe('<img src=x>');
  });

  it('reset() restores defaults and clears the query string', () => {
    const state = createAppState({ key: 'email', schema });
    state.set({ folder: 'sent', page: 4 });
    state.reset();
    expect(state.get()).toEqual({ folder: 'inbox', query: '', selected: '', page: 1 });
    expect(window.location.search).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/app-state.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app-state.js` and the shell partials**

The escaping test documents the contract: state stores the **raw** value; escaping is the renderer's job, and every renderer uses `textContent`.

`_app-shell.scss` uses a three-column grid with `grid-template-columns: auto minmax(20rem, 24rem) 1fr`, collapsing per the responsive rule via container-relative media queries. Panes each scroll independently with `overscroll-behavior: contain`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/app-state.test.js`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/partials/app/ theme1/src/layouts/app.njk theme1/src/scripts/core/app-state.js theme1/src/styles/pages/_app-shell.scss theme1/tests/unit/app-state.test.js
git commit -m "feat(apps): shared three-pane app shell with url-synced state"
```

---

### Task 2: Email

**Files:**
- Create: `theme1/src/pages/app-email.njk`
- Create: `theme1/src/scripts/pages/app-email.js`
- Create: `theme1/src/data/email.json`
- Create: `theme1/src/styles/pages/_app-email.scss`
- Test: `theme1/tests/unit/apps/email.test.js`

**Interfaces:**
- Produces: `filterMail(mail, { folder, query, labels, unreadOnly, starredOnly })`, `groupByDate(mail, now)`, `nextSelection(ids, removedId)`.

**Screen anatomy.** Sidebar: Compose, folders (Inbox, Sent, Drafts, Starred, Spam, Trash) with unread counts, labels with colour dots. List: select-all with tri-state, refresh, bulk actions (mark read/unread, star, label, move, delete), sort, search, and the message rows (checkbox, star, avatar, sender, subject, snippet, attachment indicator, time, unread weight). Detail: subject, participants, timestamp, body, attachments, and reply/reply-all/forward/star/label/delete/print. Compose: an off-canvas composer with To/Cc/Bcc, subject, rich body, attachments, and send/save-draft/discard.

- [ ] **Step 1: Write the failing test**

`email.test.js` covers the pure logic exhaustively — this is where filter bugs live:

```js
import { describe, it, expect } from 'vitest';
import { filterMail, groupByDate, nextSelection } from '../../../src/scripts/pages/app-email.js';

const mail = [
  { id: '1', folder: 'inbox', from: 'Ada Lovelace', subject: 'Analytical Engine', body: 'punch cards', read: false, starred: true, labels: ['work'], date: '2026-08-18T09:00:00Z' },
  { id: '2', folder: 'inbox', from: 'Grace Hopper', subject: 'Compiler notes', body: 'nanoseconds', read: true, starred: false, labels: ['personal'], date: '2026-08-17T09:00:00Z' },
  { id: '3', folder: 'sent', from: 'Me', subject: 'Re: budget', body: 'approved', read: true, starred: false, labels: [], date: '2026-08-10T09:00:00Z' },
];

describe('filterMail', () => {
  it('filters by folder', () => {
    expect(filterMail(mail, { folder: 'inbox' })).toHaveLength(2);
    expect(filterMail(mail, { folder: 'sent' })).toHaveLength(1);
  });
  it('returns nothing for an empty folder rather than everything', () => {
    expect(filterMail(mail, { folder: 'trash' })).toEqual([]);
  });
  it('searches sender, subject and body case-insensitively', () => {
    expect(filterMail(mail, { folder: 'inbox', query: 'ADA' })).toHaveLength(1);
    expect(filterMail(mail, { folder: 'inbox', query: 'compiler' })).toHaveLength(1);
    expect(filterMail(mail, { folder: 'inbox', query: 'punch' })).toHaveLength(1);
  });
  it('treats the query literally, not as a regex', () => {
    expect(() => filterMail(mail, { folder: 'inbox', query: '(' })).not.toThrow();
    expect(filterMail(mail, { folder: 'inbox', query: '.*' })).toEqual([]);
  });
  it('trims a whitespace-only query to mean no filter', () => {
    expect(filterMail(mail, { folder: 'inbox', query: '   ' })).toHaveLength(2);
  });
  it('filters by unread and starred', () => {
    expect(filterMail(mail, { folder: 'inbox', unreadOnly: true })).toHaveLength(1);
    expect(filterMail(mail, { folder: 'inbox', starredOnly: true })).toHaveLength(1);
  });
  it('filters by label, matching any of several', () => {
    expect(filterMail(mail, { folder: 'inbox', labels: ['work'] })).toHaveLength(1);
    expect(filterMail(mail, { folder: 'inbox', labels: ['work', 'personal'] })).toHaveLength(2);
  });
  it('combines filters conjunctively', () => {
    expect(filterMail(mail, { folder: 'inbox', query: 'ada', unreadOnly: true })).toHaveLength(1);
    expect(filterMail(mail, { folder: 'inbox', query: 'grace', unreadOnly: true })).toEqual([]);
  });
  it('is diacritic-insensitive', () => {
    expect(filterMail([{ ...mail[0], from: 'José' }], { folder: 'inbox', query: 'jose' })).toHaveLength(1);
  });
  it('does not mutate the input', () => {
    const before = JSON.stringify(mail);
    filterMail(mail, { folder: 'inbox', query: 'ada' });
    expect(JSON.stringify(mail)).toBe(before);
  });
});

describe('groupByDate', () => {
  const now = new Date('2026-08-18T12:00:00Z');
  it('groups into Today, Yesterday and Earlier', () => {
    const groups = groupByDate(mail, now);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier']);
  });
  it('omits an empty group rather than rendering an empty heading', () => {
    expect(groupByDate([mail[2]], now).map((g) => g.label)).toEqual(['Earlier']);
  });
  it('returns no groups for no mail', () => {
    expect(groupByDate([], now)).toEqual([]);
  });
});

describe('nextSelection', () => {
  it('selects the following item when one is deleted', () => {
    expect(nextSelection(['1', '2', '3'], '2')).toBe('3');
  });
  it('selects the previous item when the last is deleted', () => {
    expect(nextSelection(['1', '2', '3'], '3')).toBe('2');
  });
  it('returns null when the only item is deleted', () => {
    expect(nextSelection(['1'], '1')).toBeNull();
  });
  it('returns null when the id is not in the list', () => {
    expect(nextSelection(['1', '2'], '9')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/apps/email.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the app**

Implement the pure helpers first, then the DOM layer. Keyboard requirements: `↑`/`↓` move through messages; `Enter` opens; `x` toggles the row checkbox; `s` stars; `e` archives; `#` deletes; `/` focuses search; `Escape` returns from detail to list on narrow screens. Announce bulk actions ("3 messages moved to Trash") in a live region, with an Undo affordance that is a real button, not a toast-only action.

Empty states: empty folder, no search results (echoing the query), and nothing selected in the detail pane.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/email.test.js`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add theme1/src/pages/app-email.njk theme1/src/scripts/pages/app-email.js theme1/src/data/email.json theme1/src/styles/pages/_app-email.scss theme1/tests/unit/apps/email.test.js
git commit -m "feat(apps): email with folders, labels, bulk actions and keyboard shortcuts"
```

---

### Task 3: Chat

**Files:**
- Create: `theme1/src/pages/app-chat.njk`, `src/scripts/pages/app-chat.js`, `src/data/chat.json`, `src/styles/pages/_app-chat.scss`
- Test: `theme1/tests/unit/apps/chat.test.js`

**Interfaces:**
- Produces: `groupMessages(messages)` — consecutive messages from one sender within 5 minutes become one block; `formatChatTime(date, now)`; `unreadCount(conversation)`.

**Screen anatomy.** Sidebar: own profile with status, search, pinned chats, contacts with avatar, name, last-message snippet, time, unread badge. Thread: header with participant, status and actions (call, video, info, search-in-thread); the message list grouped by day with a sticky day divider; message bubbles carrying sent/delivered/read ticks, attachments, and reactions; a typing indicator; and a composer with emoji, attachment and send.

- [ ] **Step 1: Write the failing test**

Cover: `groupMessages` merges consecutive same-sender messages inside the window and splits after it, splits across a day boundary regardless of the window, handles a single message, and handles an empty list. `formatChatTime` renders a time for today, "Yesterday" for yesterday, a weekday within the last week, and a date beyond that. `unreadCount` counts only inbound unread messages and returns 0 for an empty conversation.

DOM assertions: the message list is `role="log"` with `aria-live="polite"`; each bubble's sender and time are in the accessible name; own and other messages are distinguished by more than alignment (they carry different accessible prefixes); the typing indicator is announced once, not on every keystroke; the thread auto-scrolls to the newest message **only** when already at the bottom, never yanking a user reading history; and a long unbroken URL wraps rather than widening the pane.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd theme1 && npx vitest run tests/unit/apps/chat.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the app, then verify the tests pass**

Run: `cd theme1 && npx vitest run tests/unit/apps/chat.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add theme1/src/pages/app-chat.njk theme1/src/scripts/pages/app-chat.js theme1/src/data/chat.json theme1/src/styles/pages/_app-chat.scss theme1/tests/unit/apps/chat.test.js
git commit -m "feat(apps): chat with message grouping and a polite live thread"
```

---

### Task 4: Todo

**Files:**
- Create: `theme1/src/pages/app-todo.njk`, `src/scripts/pages/app-todo.js`, `src/data/todo.json`, `src/styles/pages/_app-todo.scss`
- Test: `theme1/tests/unit/apps/todo.test.js`

**Interfaces:**
- Produces: `filterTasks(tasks, { filter, tags, query, showCompleted })`, `sortTasks(tasks, by)`, `reorder(tasks, fromId, toIndex)`.

**Screen anatomy.** Sidebar: Add Task, filters (All, Important, Completed, Deleted), tags with colour dots. List: search, sort menu, select-all, and task rows with a checkbox, title with strikethrough when done, tags, assignee avatar, due date badge (overdue in danger), and a drag handle. Detail: an off-canvas editor with title, assignee, due date, tags, description, and delete.

**The keyboard requirement is the point of this task.** Reordering must work without a mouse: with a task focused, `Alt+↑` / `Alt+↓` move it, the new position is announced in a live region, and the same operation is available from the row's action menu. Test this explicitly.

- [ ] **Step 1: Write the failing test**

Cover `reorder` as a pure function: moving down, moving up, moving to the first and last positions, a no-op move, an unknown id, and immutability. Then the DOM: `Alt+↑`/`Alt+↓` reorder and announce; the drag handle has an accessible name describing the keyboard alternative; completing a task moves it correctly under the active filter; overdue dates get the danger treatment and are announced as overdue; and the empty state differs between "no tasks" and "no tasks match this filter".

- [ ] **Step 2: Run the test to verify it fails, build the app, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/todo.test.js`
Expected: FAIL, then PASS.

Use Dragula (MIT, dynamic import) for pointer dragging, but the keyboard path must be independent of it and must work if the import fails.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-todo.njk theme1/src/scripts/pages/app-todo.js theme1/src/data/todo.json theme1/src/styles/pages/_app-todo.scss theme1/tests/unit/apps/todo.test.js
git commit -m "feat(apps): todo with keyboard-reorderable tasks"
```

---

### Task 5: Calendar

**Files:**
- Create: `theme1/src/pages/app-calendar.njk`, `src/scripts/pages/app-calendar.js`, `src/data/calendar.json`, `src/styles/pages/_app-calendar.scss`
- Test: `theme1/tests/unit/apps/calendar.test.js`

**Interfaces:**
- Consumes: FullCalendar (MIT), dynamically imported.
- Produces: `eventsInRange(events, start, end, timeZone)`, `overlaps(a, b)`, `validateEvent(event)`.

**Screen anatomy.** Sidebar: Add Event, a mini month picker, and calendar categories (Personal, Business, Family, Holiday, Other) as toggles with colour dots. Main: view switcher (Month, Week, Day, List), today/prev/next, and the grid. Event editor: an off-canvas form with title, category, start, end, all-day toggle, repeat, location, guests, description, and save/delete.

**Timezone correctness is the risk here**, and the spec calls it out. All stored timestamps are ISO 8601 with an offset; rendering goes through an explicit `timeZone` option, never the runner's local zone.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { eventsInRange, overlaps, validateEvent } from '../../../src/scripts/pages/app-calendar.js';

const events = [
  { id: '1', title: 'Standup', start: '2026-08-18T09:00:00Z', end: '2026-08-18T09:15:00Z', category: 'business' },
  { id: '2', title: 'All day', start: '2026-08-18', allDay: true, category: 'personal' },
  { id: '3', title: 'Late', start: '2026-08-18T23:30:00Z', end: '2026-08-19T00:30:00Z', category: 'personal' },
];

describe('eventsInRange', () => {
  it('includes an event fully inside the range', () => {
    expect(eventsInRange(events, '2026-08-18T00:00:00Z', '2026-08-19T00:00:00Z', 'UTC').map((e) => e.id)).toContain('1');
  });
  it('includes an event that straddles the range end', () => {
    expect(eventsInRange(events, '2026-08-18T00:00:00Z', '2026-08-19T00:00:00Z', 'UTC').map((e) => e.id)).toContain('3');
  });
  it('excludes an event entirely outside the range', () => {
    expect(eventsInRange(events, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', 'UTC')).toEqual([]);
  });
  it('places an event on the correct local day for the given time zone', () => {
    const inTokyo = eventsInRange(events, '2026-08-19T00:00:00+09:00', '2026-08-20T00:00:00+09:00', 'Asia/Tokyo');
    expect(inTokyo.map((e) => e.id), 'the 23:30 UTC event falls on the 19th in Tokyo').toContain('3');
  });
  it('treats an all-day event as spanning its whole local day', () => {
    expect(eventsInRange(events, '2026-08-18T00:00:00Z', '2026-08-18T00:00:01Z', 'UTC').map((e) => e.id)).toContain('2');
  });
  it('handles an empty event list', () => {
    expect(eventsInRange([], '2026-08-18T00:00:00Z', '2026-08-19T00:00:00Z', 'UTC')).toEqual([]);
  });
});

describe('overlaps', () => {
  it('detects an overlap', () => {
    expect(overlaps(events[0], { start: '2026-08-18T09:10:00Z', end: '2026-08-18T09:20:00Z' })).toBe(true);
  });
  it('treats touching boundaries as no overlap', () => {
    expect(overlaps(events[0], { start: '2026-08-18T09:15:00Z', end: '2026-08-18T09:30:00Z' })).toBe(false);
  });
});

describe('validateEvent', () => {
  it('requires a title', () => {
    expect(validateEvent({ start: '2026-08-18T09:00:00Z', end: '2026-08-18T10:00:00Z' }).valid).toBe(false);
  });
  it('rejects an end before its start', () => {
    const result = validateEvent({ title: 'x', start: '2026-08-18T10:00:00Z', end: '2026-08-18T09:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.end).toMatch(/after/i);
  });
  it('accepts an all-day event with no end', () => {
    expect(validateEvent({ title: 'x', start: '2026-08-18', allDay: true }).valid).toBe(true);
  });
  it('rejects an unknown category', () => {
    expect(validateEvent({ title: 'x', start: '2026-08-18', allDay: true, category: 'evil' }).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, build the app, then verify it passes**

Run: `cd theme1 && npx vitest run tests/unit/apps/calendar.test.js`
Expected: FAIL, then PASS.

FullCalendar must be restyled entirely from our tokens and given a keyboard path: arrow keys move the focused day, `Enter` opens the day or creates an event, and events are reachable in the tab order. Provide a **list view fallback** rendered server-side so the calendar is usable before — or without — the 200 KB import.

- [ ] **Step 3: Commit**

```bash
git add theme1/src/pages/app-calendar.njk theme1/src/scripts/pages/app-calendar.js theme1/src/data/calendar.json theme1/src/styles/pages/_app-calendar.scss theme1/package.json theme1/tests/unit/apps/calendar.test.js
git commit -m "feat(apps): calendar with timezone-correct ranges and a list fallback"
```

---

### Task 6: Phase gate

**Files:**
- Create: `theme1/tests/a11y/apps.test.js`
- Modify: `theme1/tests/a11y/style-guide.test.js`, `theme1/src/data/navigation.json`

- [ ] **Step 1: Write the gate**

`apps.test.js` asserts, for each of the four pages: exactly one `<main>`; every pane has an `aria-label`; every list is a real list element; every interactive row is reachable by keyboard; the detail pane is a live region; every icon-only action has a name; no `draggable` element lacks a documented keyboard equivalent (assert each carries `data-t-keyboard-alt` naming the shortcut); and no raster image is referenced.

- [ ] **Step 2: Run the gate, fix every failure at source**

Run: `cd theme1 && npm run build && npx vitest run tests/a11y/apps.test.js`

- [ ] **Step 3: Extend the axe gate and navigation, then run everything**

Add the four pages to `PAGES` and to `navigation.json` under "Apps".

```bash
cd theme1 && npm run lint && npm run build && npm run test && npm run test:a11y && npm run test:assets && npm run check:budgets
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add theme1/tests/a11y/apps.test.js theme1/tests/a11y/style-guide.test.js theme1/src/data/navigation.json
git commit -m "test(apps): accessibility and keyboard-alternative gates for the four apps"
```

---

## Phase exit checklist

- [ ] All four apps build, appear in the navigation, and pass axe in both themes.
- [ ] The three-pane shell collapses correctly at `xl`, `lg` and `md`.
- [ ] App state round-trips through the query string and never pushes history entries for filter changes.
- [ ] Email: folder, label, search, unread and starred filters combine conjunctively; bulk actions announce and offer undo.
- [ ] Chat: messages group correctly; the thread auto-scrolls only when already at the bottom.
- [ ] Todo: `Alt+↑`/`Alt+↓` reorder tasks and announce the new position, working with Dragula absent.
- [ ] Calendar: events land on the correct local day across time zones; an end before its start is rejected; the list fallback renders without FullCalendar.
- [ ] Every drag interaction has a tested keyboard equivalent.
- [ ] FullCalendar and Dragula are absent from the shared chunk.
- [ ] CI green.
