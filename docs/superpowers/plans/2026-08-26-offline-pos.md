# Cusina Ko Offline POS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-device, fully offline, installable web app (PWA) for a 14-table restaurant: open a tab per table, add items from an editable menu, track covers, mark individual items or whole tables as paid, then browse order history and daily sales summaries.

**Architecture:** A Vite + React + TypeScript SPA with no backend and no network calls. All state lives in IndexedDB (Dexie), so data survives refreshes and works with no internet. UI is reactive via `dexie-react-hooks` `useLiveQuery` — every screen updates live when data changes, with no page reloads. Navigation is plain component state (no router).

**Tech Stack:** Vite, React, TypeScript (strict), Dexie 4 + dexie-react-hooks (IndexedDB), vite-plugin-pwa, Vitest + React Testing Library + user-event + fake-indexeddb + jsdom for tests, plain CSS.

**Spec:** No separate spec doc — requirements are captured in the Context section below (agreed with the user in the planning conversation).

## Context

The user runs a restaurant ("Cusina Ko") with 14 tables (floor plan provided; tables numbered 1–14). They want a quick, intuitive, touch-friendly SPA that acts as an offline POS:

- **Single device** at the till (their choice) — browser storage, zero infrastructure, truly offline.
- **Editable menu in-app** — settings screen for items/prices/categories, preloaded with a starter Filipino menu (placeholder items the user will edit).
- **One tab per table, pay per item** (their choice): each table has one open tab; individual order lines are ticked off as paid until the table settles; "covers" is a headcount number recorded per tab (used on the floor view and in the daily summary).
- **v1 extras** (their choice): order history (closed tabs browsable) and daily sales summary (takings, tables, covers, items sold). No payment-method recording, no cash/card split.
- Responsive SPA, minimal refreshing, big touch targets.

## Global Constraints

- **Fully offline, single device**: zero network calls anywhere in app code; all state in IndexedDB database named `cusina-pos` via Dexie.
- **Money is integer minor units** (`priceMinor`, pence/centavos) — never floating-point currency math. Display only via `formatMoney` (`src/money.ts`); parse user input only via `parsePrice`.
- **All business mutations go through `src/ops.ts`** (tabs, lines, payment, closing, summary). Views never re-implement these rules. Menu/settings CRUD may call `db.*` directly.
- **14 tables, numbered 1–14**, from `TABLE_NUMBERS` exported by `src/db.ts`.
- **Currency symbol** is a setting (key `currency`, default `£`), editable on the Menu screen, read via `useCurrency()` hook.
- TypeScript strict mode (Vite default). Plain CSS in `src/styles.css` — no CSS framework, no router library, no state library.
- Touch targets: interactive controls min-height 44px (set globally in CSS).
- Tests: Vitest + RTL + fake-indexeddb. Every task ends with `npx vitest run` fully green before committing.
- Git: repo initialized in Task 1 on branch `feat/pos-v1` (never commit to main — per user's global rules). Commit at each task's commit step. No `Co-Authored-By` trailer, no "Generated with Claude Code" footer.
- At execution start, copy this plan to `docs/superpowers/plans/2026-08-26-offline-pos.md` in the repo so it travels with the code.

## File Structure

```
cusina-ko/
  index.html                  # Vite entry (title "Cusina Ko POS", viewport meta)
  vite.config.ts              # Vite + Vitest config; PWA plugin added in Task 11
  package.json
  public/icon.svg             # app icon (Task 11)
  src/
    main.tsx                  # seed DB then mount <App/>
    App.tsx                   # nav state + view switching (the only "routing")
    db.ts                     # Dexie schema, types, TABLE_NUMBERS, seed
    ops.ts                    # ALL business operations + daySummary
    money.ts                  # formatMoney / parsePrice
    useCurrency.ts            # live currency-symbol hook
    test-setup.ts             # fake-indexeddb + jest-dom
    test-utils.ts             # resetDb() between tests
    styles.css                # entire app stylesheet
    views/
      FloorView.tsx           # 14-table grid, live status
      TableView.tsx           # a table's tab: covers, lines, pay, close
      MenuPicker.tsx          # tap-to-add item panel (used inside TableView)
      MenuSettings.tsx        # menu CRUD + currency setting
      HistoryView.tsx         # closed tabs grouped by day
      SummaryView.tsx         # daily takings/covers/items report
  # tests co-located: src/money.test.ts, src/db.test.ts, src/ops.test.ts,
  # src/App.test.tsx, src/views/*.test.tsx
```

---

### Task 1: Scaffold, test harness, money helpers

**Files:**
- Create: entire Vite scaffold, `vite.config.ts`, `src/test-setup.ts`, `src/money.ts`
- Test: `src/money.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `formatMoney(minor: number, symbol: string): string` and `parsePrice(input: string): number | null` from `src/money.ts`; a working `npx vitest run` harness with fake-indexeddb preloaded.

- [ ] **Step 1: Scaffold and install**

```bash
cd /Users/macbookm1/Code/cusina-ko
npm create vite@latest . -- --template react-ts
npm install
npm install dexie dexie-react-hooks
npm install -D vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom @testing-library/user-event
git init -b feat/pos-v1
```

Delete Vite boilerplate we won't use: `src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg`. Strip their imports/usages from `src/App.tsx` and `src/main.tsx` (leave those two files otherwise as scaffolded for now — Task 4 replaces them). Edit `index.html`: set `<title>Cusina Ko POS</title>` and remove the vite.svg icon link.

- [ ] **Step 2: Configure Vitest**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Create `src/test-setup.ts`:

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing test**

Create `src/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatMoney, parsePrice } from './money';

describe('formatMoney', () => {
  it('formats minor units with the given symbol', () => {
    expect(formatMoney(1250, '£')).toBe('£12.50');
    expect(formatMoney(0, '£')).toBe('£0.00');
    expect(formatMoney(305, '₱')).toBe('₱3.05');
  });
});

describe('parsePrice', () => {
  it('parses decimal input to integer minor units', () => {
    expect(parsePrice('12.50')).toBe(1250);
    expect(parsePrice('3')).toBe(300);
    expect(parsePrice('0.05')).toBe(5);
  });
  it('rejects invalid or negative input', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('-2')).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 5: Implement `src/money.ts`**

```ts
export function formatMoney(minor: number, symbol: string): string {
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

export function parsePrice(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (money tests green; the scaffold's default test files, if any, removed).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with Vitest harness and money helpers"
```

---

### Task 2: Dexie schema and seed data

**Files:**
- Create: `src/db.ts`, `src/test-utils.ts`
- Test: `src/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `src/db.ts`): `db` (Dexie instance with tables `menuItems`, `tabs`, `orderLines`, `settings`), interfaces `MenuItem { id?: number; name: string; priceMinor: number; category: string; active: 0 | 1; sortOrder: number }`, `Tab { id?: number; tableNumber: number; covers: number; status: 'open' | 'closed'; openedAt: number; closedAt: number | null }`, `OrderLine { id?: number; tabId: number; name: string; priceMinor: number; qty: number; paidQty: number; addedAt: number }`, `Setting { key: string; value: string }`, `TABLE_NUMBERS: number[]` (1–14), `seedIfEmpty(): Promise<void>`. From `src/test-utils.ts`: `resetDb(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `src/db.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db, seedIfEmpty, TABLE_NUMBERS } from './db';
import { resetDb } from './test-utils';

beforeEach(resetDb);

describe('db', () => {
  it('has 14 table numbers', () => {
    expect(TABLE_NUMBERS).toHaveLength(14);
    expect(TABLE_NUMBERS[0]).toBe(1);
    expect(TABLE_NUMBERS[13]).toBe(14);
  });

  it('seeds a starter menu and default currency once', async () => {
    await seedIfEmpty();
    const count = await db.menuItems.count();
    expect(count).toBeGreaterThan(5);
    expect((await db.settings.get('currency'))?.value).toBe('£');
    await seedIfEmpty(); // idempotent
    expect(await db.menuItems.count()).toBe(count);
  });

  it('does not overwrite an existing menu or currency', async () => {
    await db.menuItems.add({ name: 'Custom', priceMinor: 100, category: 'Food', active: 1, sortOrder: 0 });
    await db.settings.put({ key: 'currency', value: '₱' });
    await seedIfEmpty();
    expect(await db.menuItems.count()).toBe(1);
    expect((await db.settings.get('currency'))?.value).toBe('₱');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL — cannot resolve `./db` / `./test-utils`.

- [ ] **Step 3: Implement `src/db.ts`**

```ts
import Dexie, { type Table } from 'dexie';

export interface MenuItem {
  id?: number;
  name: string;
  priceMinor: number; // integer pence/centavos — see Global Constraints
  category: string;
  active: 0 | 1; // 1 = shown on the picker (IndexedDB can't index booleans)
  sortOrder: number;
}

export interface Tab {
  id?: number;
  tableNumber: number; // 1–14
  covers: number;
  status: 'open' | 'closed';
  openedAt: number; // epoch ms
  closedAt: number | null;
}

export interface OrderLine {
  id?: number;
  tabId: number;
  name: string; // denormalised from the menu at order time
  priceMinor: number;
  qty: number;
  paidQty: number; // 0..qty
  addedAt: number;
}

export interface Setting {
  key: string;
  value: string;
}

export const TABLE_NUMBERS = Array.from({ length: 14 }, (_, i) => i + 1);

class PosDb extends Dexie {
  menuItems!: Table<MenuItem, number>;
  tabs!: Table<Tab, number>;
  orderLines!: Table<OrderLine, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('cusina-pos');
    this.version(1).stores({
      menuItems: '++id, category, sortOrder',
      tabs: '++id, tableNumber, status, closedAt',
      orderLines: '++id, tabId',
      settings: 'key',
    });
  }
}

export const db = new PosDb();

// Placeholder starter menu — the user edits this in-app on the Menu screen.
const STARTER_MENU: Omit<MenuItem, 'id'>[] = [
  { name: 'Chicken Adobo', priceMinor: 1250, category: 'Food', active: 1, sortOrder: 0 },
  { name: 'Pork Sisig', priceMinor: 1300, category: 'Food', active: 1, sortOrder: 1 },
  { name: 'Beef Kare-Kare', priceMinor: 1450, category: 'Food', active: 1, sortOrder: 2 },
  { name: 'Lumpiang Shanghai', priceMinor: 750, category: 'Food', active: 1, sortOrder: 3 },
  { name: 'Pancit Canton', priceMinor: 1100, category: 'Food', active: 1, sortOrder: 4 },
  { name: 'Garlic Rice', priceMinor: 350, category: 'Food', active: 1, sortOrder: 5 },
  { name: 'Steamed Rice', priceMinor: 250, category: 'Food', active: 1, sortOrder: 6 },
  { name: 'Halo-Halo', priceMinor: 650, category: 'Food', active: 1, sortOrder: 7 },
  { name: 'San Miguel', priceMinor: 450, category: 'Drinks', active: 1, sortOrder: 8 },
  { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 9 },
  { name: 'Mango Juice', priceMinor: 320, category: 'Drinks', active: 1, sortOrder: 10 },
  { name: 'Sparkling Water', priceMinor: 250, category: 'Drinks', active: 1, sortOrder: 11 },
  { name: 'Still Water', priceMinor: 200, category: 'Drinks', active: 1, sortOrder: 12 },
  { name: 'Barako Coffee', priceMinor: 300, category: 'Drinks', active: 1, sortOrder: 13 },
];

export async function seedIfEmpty(): Promise<void> {
  if ((await db.menuItems.count()) === 0) {
    await db.menuItems.bulkAdd(STARTER_MENU as MenuItem[]);
  }
  if (!(await db.settings.get('currency'))) {
    await db.settings.put({ key: 'currency', value: '£' });
  }
}
```

Create `src/test-utils.ts`:

```ts
import { db } from './db';

export async function resetDb(): Promise<void> {
  await Promise.all([
    db.menuItems.clear(),
    db.tabs.clear(),
    db.orderLines.clear(),
    db.settings.clear(),
  ]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src/db.test.ts src/test-utils.ts
git commit -m "feat: add Dexie schema, starter menu seed, and test reset helper"
```

---

### Task 3: Domain operations (tabs, lines, payment, closing)

**Files:**
- Create: `src/ops.ts`
- Test: `src/ops.test.ts`

**Interfaces:**
- Consumes: `db`, `MenuItem`, `OrderLine`, `Tab` from `src/db.ts`.
- Produces (from `src/ops.ts`):
  - `openTab(tableNumber: number, covers?: number): Promise<number>` (returns existing open tab's id if one exists)
  - `getOpenTab(tableNumber: number): Promise<Tab | undefined>`
  - `addItem(tabId: number, item: MenuItem): Promise<void>` (merges into an existing line with same name+price)
  - `setLineQty(lineId: number, qty: number): Promise<void>` (clamps to ≥ paidQty; deletes line at 0)
  - `payLine(lineId: number): Promise<void>` / `unpayLine(lineId: number): Promise<void>`
  - `payAll(tabId: number): Promise<void>`
  - `setCovers(tabId: number, covers: number): Promise<void>` (min 1)
  - `tabTotals(lines: OrderLine[]): TabTotals` where `TabTotals = { totalMinor: number; paidMinor: number; outstandingMinor: number }`
  - `closeTab(tabId: number): Promise<void>` (throws if unpaid; deletes the tab if it has no lines)

- [ ] **Step 1: Write the failing test**

Create `src/ops.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type MenuItem } from './db';
import {
  addItem, closeTab, getOpenTab, openTab, payAll, payLine, unpayLine,
  setCovers, setLineQty, tabTotals,
} from './ops';
import { resetDb } from './test-utils';

const adobo: MenuItem = { name: 'Chicken Adobo', priceMinor: 1250, category: 'Food', active: 1, sortOrder: 0 };
const coke: MenuItem = { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 1 };

beforeEach(resetDb);

describe('tabs', () => {
  it('opens one tab per table and reuses the open one', async () => {
    const id1 = await openTab(3, 2);
    const id2 = await openTab(3, 4);
    expect(id2).toBe(id1);
    const tab = await getOpenTab(3);
    expect(tab?.covers).toBe(2);
    expect(tab?.status).toBe('open');
  });

  it('updates covers with a floor of 1', async () => {
    const id = await openTab(1, 2);
    await setCovers(id, 0);
    expect((await db.tabs.get(id))?.covers).toBe(1);
  });
});

describe('order lines', () => {
  it('merges repeat orders of the same item into one line', async () => {
    const tabId = await openTab(1);
    await addItem(tabId, adobo);
    await addItem(tabId, adobo);
    await addItem(tabId, coke);
    const lines = await db.orderLines.where({ tabId }).toArray();
    expect(lines).toHaveLength(2);
    expect(lines.find(l => l.name === 'Chicken Adobo')?.qty).toBe(2);
  });

  it('deletes a line when qty is set to 0, and never drops qty below paidQty', async () => {
    const tabId = await openTab(1);
    await addItem(tabId, adobo);
    const line = (await db.orderLines.where({ tabId }).toArray())[0];
    await db.orderLines.update(line.id!, { qty: 3, paidQty: 2 });
    await setLineQty(line.id!, 1); // below paidQty → clamps to 2
    expect((await db.orderLines.get(line.id!))?.qty).toBe(2);
    await db.orderLines.update(line.id!, { paidQty: 0 });
    await setLineQty(line.id!, 0);
    expect(await db.orderLines.get(line.id!)).toBeUndefined();
  });
});

describe('payment and totals', () => {
  it('pays and un-pays lines, computing totals in minor units', async () => {
    const tabId = await openTab(1);
    await addItem(tabId, adobo);
    await addItem(tabId, adobo);
    await addItem(tabId, coke);
    let lines = await db.orderLines.where({ tabId }).toArray();
    expect(tabTotals(lines)).toEqual({ totalMinor: 2780, paidMinor: 0, outstandingMinor: 2780 });

    const adoboLine = lines.find(l => l.name === 'Chicken Adobo')!;
    await payLine(adoboLine.id!);
    lines = await db.orderLines.where({ tabId }).toArray();
    expect(tabTotals(lines).paidMinor).toBe(2500);

    await unpayLine(adoboLine.id!);
    lines = await db.orderLines.where({ tabId }).toArray();
    expect(tabTotals(lines).paidMinor).toBe(0);

    await payAll(tabId);
    lines = await db.orderLines.where({ tabId }).toArray();
    expect(tabTotals(lines).outstandingMinor).toBe(0);
  });
});

describe('closing', () => {
  it('refuses to close a tab with unpaid items', async () => {
    const tabId = await openTab(2);
    await addItem(tabId, coke);
    await expect(closeTab(tabId)).rejects.toThrow();
  });

  it('closes a fully paid tab with a closedAt timestamp', async () => {
    const tabId = await openTab(2);
    await addItem(tabId, coke);
    await payAll(tabId);
    await closeTab(tabId);
    const tab = await db.tabs.get(tabId);
    expect(tab?.status).toBe('closed');
    expect(tab?.closedAt).toBeTypeOf('number');
  });

  it('deletes an empty tab instead of closing it', async () => {
    const tabId = await openTab(2);
    await closeTab(tabId);
    expect(await db.tabs.get(tabId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ops.test.ts`
Expected: FAIL — cannot resolve `./ops`.

- [ ] **Step 3: Implement `src/ops.ts`**

```ts
import { db, type MenuItem, type OrderLine, type Tab } from './db';

export async function openTab(tableNumber: number, covers = 1): Promise<number> {
  const existing = await getOpenTab(tableNumber);
  if (existing) return existing.id!;
  return db.tabs.add({ tableNumber, covers, status: 'open', openedAt: Date.now(), closedAt: null });
}

export function getOpenTab(tableNumber: number): Promise<Tab | undefined> {
  return db.tabs.where({ tableNumber }).filter(t => t.status === 'open').first();
}

export async function addItem(tabId: number, item: MenuItem): Promise<void> {
  const existing = await db.orderLines
    .where({ tabId })
    .filter(l => l.name === item.name && l.priceMinor === item.priceMinor)
    .first();
  if (existing) {
    await db.orderLines.update(existing.id!, { qty: existing.qty + 1 });
  } else {
    await db.orderLines.add({
      tabId, name: item.name, priceMinor: item.priceMinor,
      qty: 1, paidQty: 0, addedAt: Date.now(),
    });
  }
}

export async function setLineQty(lineId: number, qty: number): Promise<void> {
  const line = await db.orderLines.get(lineId);
  if (!line) return;
  const clamped = Math.max(line.paidQty, qty);
  if (clamped <= 0) await db.orderLines.delete(lineId);
  else await db.orderLines.update(lineId, { qty: clamped });
}

export async function payLine(lineId: number): Promise<void> {
  const line = await db.orderLines.get(lineId);
  if (line) await db.orderLines.update(lineId, { paidQty: line.qty });
}

export async function unpayLine(lineId: number): Promise<void> {
  await db.orderLines.update(lineId, { paidQty: 0 });
}

export async function payAll(tabId: number): Promise<void> {
  const lines = await db.orderLines.where({ tabId }).toArray();
  await db.orderLines.bulkPut(lines.map(l => ({ ...l, paidQty: l.qty })));
}

export async function setCovers(tabId: number, covers: number): Promise<void> {
  await db.tabs.update(tabId, { covers: Math.max(1, covers) });
}

export interface TabTotals {
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
}

export function tabTotals(lines: OrderLine[]): TabTotals {
  const totalMinor = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
  const paidMinor = lines.reduce((s, l) => s + l.priceMinor * l.paidQty, 0);
  return { totalMinor, paidMinor, outstandingMinor: totalMinor - paidMinor };
}

export async function closeTab(tabId: number): Promise<void> {
  const lines = await db.orderLines.where({ tabId }).toArray();
  if (lines.length === 0) {
    await db.tabs.delete(tabId);
    return;
  }
  if (tabTotals(lines).outstandingMinor !== 0) throw new Error('Tab has unpaid items');
  await db.tabs.update(tabId, { status: 'closed', closedAt: Date.now() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ops.ts src/ops.test.ts
git commit -m "feat: add tab, order-line, payment, and closing operations"
```

---

### Task 4: App shell, navigation, stylesheet

**Files:**
- Create: `src/styles.css`, `src/useCurrency.ts`, stub view files `src/views/FloorView.tsx`, `src/views/TableView.tsx`, `src/views/HistoryView.tsx`, `src/views/SummaryView.tsx`, `src/views/MenuSettings.tsx`, `src/views/MenuPicker.tsx`
- Modify: `src/App.tsx`, `src/main.tsx` (replace scaffold versions)
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `seedIfEmpty` from `src/db.ts`.
- Produces: `App` component with nav; view components with these exact props (stubs now, real implementations in Tasks 5–10 keep the same signatures): `FloorView({ onSelectTable }: { onSelectTable: (n: number) => void })`, `TableView({ tableNumber, onBack }: { tableNumber: number; onBack: () => void })`, `MenuPicker({ onPick }: { onPick: (item: MenuItem) => void })`, `HistoryView()`, `SummaryView()`, `MenuSettings()`. Also `useCurrency(): string` from `src/useCurrency.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/App.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { resetDb } from './test-utils';

beforeEach(resetDb);

describe('App', () => {
  it('shows the floor view by default and switches views via the nav', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Tables' })).toBeInTheDocument();
    expect(await screen.findByText('Table 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText(/no closed tabs/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(await screen.findByText(/currency symbol/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tables' }));
    expect(await screen.findByText('Table 14')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `App` is not exported / views missing.

- [ ] **Step 3: Implement shell, hook, and stubs**

Create `src/useCurrency.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export function useCurrency(): string {
  // `|| '£'` (not ??) so an empty stored value also falls back to the default
  return useLiveQuery(async () => (await db.settings.get('currency'))?.value, [], undefined) || '£';
}
```

Replace `src/App.tsx`:

```tsx
import { useState } from 'react';
import { FloorView } from './views/FloorView';
import { TableView } from './views/TableView';
import { HistoryView } from './views/HistoryView';
import { SummaryView } from './views/SummaryView';
import { MenuSettings } from './views/MenuSettings';

export type View =
  | { name: 'floor' }
  | { name: 'table'; tableNumber: number }
  | { name: 'history' }
  | { name: 'summary' }
  | { name: 'menu' };

const NAV = [
  { name: 'floor', label: 'Tables' },
  { name: 'history', label: 'History' },
  { name: 'summary', label: 'Summary' },
  { name: 'menu', label: 'Menu' },
] as const;

export function App() {
  const [view, setView] = useState<View>({ name: 'floor' });
  return (
    <div className="app">
      <nav className="topnav">
        {NAV.map(n => (
          <button
            key={n.name}
            className={view.name === n.name ? 'active' : ''}
            onClick={() => setView({ name: n.name })}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <main>
        {view.name === 'floor' && (
          <FloorView onSelectTable={t => setView({ name: 'table', tableNumber: t })} />
        )}
        {view.name === 'table' && (
          <TableView tableNumber={view.tableNumber} onBack={() => setView({ name: 'floor' })} />
        )}
        {view.name === 'history' && <HistoryView />}
        {view.name === 'summary' && <SummaryView />}
        {view.name === 'menu' && <MenuSettings />}
      </main>
    </div>
  );
}
```

Create the six stub views (real implementations replace them in Tasks 5–10, keeping these exact props):

`src/views/FloorView.tsx` (stub):

```tsx
import { TABLE_NUMBERS } from '../db';

export function FloorView({ onSelectTable }: { onSelectTable: (n: number) => void }) {
  return (
    <div className="floor">
      {TABLE_NUMBERS.map(n => (
        <button key={n} className="table-card free" onClick={() => onSelectTable(n)}>
          <span className="table-num">Table {n}</span>
        </button>
      ))}
    </div>
  );
}
```

`src/views/TableView.tsx` (stub):

```tsx
export function TableView({ tableNumber, onBack }: { tableNumber: number; onBack: () => void }) {
  return (
    <div className="table-view">
      <header>
        <button onClick={onBack}>← Tables</button>
        <h1>Table {tableNumber}</h1>
      </header>
    </div>
  );
}
```

`src/views/MenuPicker.tsx` (stub):

```tsx
import type { MenuItem } from '../db';

export function MenuPicker(_props: { onPick: (item: MenuItem) => void }) {
  return <div className="menu-picker" />;
}
```

`src/views/HistoryView.tsx` (stub):

```tsx
export function HistoryView() {
  return <p className="empty">No closed tabs yet.</p>;
}
```

`src/views/SummaryView.tsx` (stub):

```tsx
export function SummaryView() {
  return <p className="empty">No sales recorded yet.</p>;
}
```

`src/views/MenuSettings.tsx` (stub):

```tsx
export function MenuSettings() {
  return (
    <div className="menu-settings">
      <label className="currency-row">Currency symbol</label>
    </div>
  );
}
```

Replace `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seedIfEmpty } from './db';
import './styles.css';

seedIfEmpty().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
```

Create `src/styles.css` (the whole app stylesheet — later tasks only add markup, not CSS files):

```css
:root {
  --bg: #faf7f2;
  --card: #ffffff;
  --ink: #2b2118;
  --muted: #8a7f74;
  --accent: #7a3b2e;
  --free: #efe9e0;
  --unpaid: #f6c453;
  --paid-bg: #9fce8f;
  --danger: #c0392b;
  --radius: 12px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--ink);
  -webkit-tap-highlight-color: transparent;
}

button {
  font: inherit;
  min-height: 44px;
  border: none;
  border-radius: var(--radius);
  background: var(--card);
  color: var(--ink);
  padding: 0.5rem 0.9rem;
  cursor: pointer;
}
button:disabled { opacity: 0.4; cursor: default; }
button.big { width: 100%; background: var(--accent); color: #fff; font-weight: 600; }

input {
  font: inherit;
  min-height: 44px;
  border: 1px solid var(--muted);
  border-radius: var(--radius);
  padding: 0.4rem 0.7rem;
  max-width: 100%;
}

.app { max-width: 900px; margin: 0 auto; padding: 0.75rem; }

.topnav { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.topnav button { flex: 1; background: var(--free); }
.topnav button.active { background: var(--accent); color: #fff; }

/* Floor */
.floor {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.6rem;
}
.table-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  min-height: 88px;
  padding: 0.7rem;
  text-align: left;
}
.table-card.free { background: var(--free); color: var(--muted); }
.table-card.unpaid { background: var(--unpaid); }
.table-card.paid { background: var(--paid-bg); }
.table-num { font-weight: 700; }
.table-card .covers, .table-card .due { font-size: 0.85rem; }

/* Table view */
.table-view header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.table-view h1 { font-size: 1.3rem; margin: 0; }
.covers-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }
.lines { list-style: none; margin: 0 0 0.6rem; padding: 0; }
.line {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 0.5rem;
  background: var(--card);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.4rem;
}
.line.paid { background: var(--paid-bg); }
.qty-controls { display: flex; align-items: center; gap: 0.4rem; }
.totals {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.2rem;
  font-size: 1.05rem;
}
.actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }

/* Menu picker */
.menu-picker section h2 { font-size: 1rem; color: var(--muted); margin: 0.8rem 0 0.4rem; }
.menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.5rem;
}
.menu-grid button { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; }
.menu-grid button span { color: var(--muted); font-size: 0.85rem; }

/* Menu settings */
.menu-settings h2 { font-size: 1rem; margin: 1rem 0 0.4rem; }
.currency-row { display: flex; align-items: center; gap: 0.6rem; }
.currency-row input { width: 4rem; }
.item-form { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.menu-settings ul { list-style: none; margin: 0; padding: 0; }
.menu-settings li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  background: var(--card);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.4rem;
}
.menu-settings li > span { flex: 1; min-width: 10rem; }
.menu-settings li.inactive > span { color: var(--muted); text-decoration: line-through; }

/* History */
.history h2 { font-size: 1rem; color: var(--muted); margin: 1rem 0 0.4rem; }
.closed-tab {
  background: var(--card);
  border-radius: var(--radius);
  padding: 0.5rem 0.7rem;
  margin-bottom: 0.4rem;
}
.closed-tab summary { cursor: pointer; min-height: 32px; }
.closed-tab ul { list-style: none; margin: 0.4rem 0 0; padding: 0; color: var(--muted); }

/* Summary */
.summary .stat-row { display: flex; gap: 0.6rem; margin: 0.75rem 0; }
.summary .stat {
  flex: 1;
  background: var(--card);
  border-radius: var(--radius);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.summary .stat strong { font-size: 1.2rem; }
.summary .stat span { color: var(--muted); font-size: 0.85rem; }
.summary table { width: 100%; border-collapse: collapse; }
.summary th, .summary td { text-align: left; padding: 0.4rem 0.3rem; border-bottom: 1px solid var(--free); }

.empty { color: var(--muted); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS. Also run `npm run build` — expected: builds cleanly.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app shell with nav, stylesheet, currency hook, and view stubs"
```

---

### Task 5: Floor view (live 14-table grid)

**Files:**
- Modify: `src/views/FloorView.tsx` (replace stub)
- Test: `src/views/FloorView.test.tsx`

**Interfaces:**
- Consumes: `db`, `TABLE_NUMBERS` from `src/db.ts`; `openTab`, `addItem`, `payAll`, `tabTotals` from `src/ops.ts`; `formatMoney`; `useCurrency`.
- Produces: `FloorView({ onSelectTable })` — same props as the Task 4 stub.

- [ ] **Step 1: Write the failing test**

Create `src/views/FloorView.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MenuItem } from '../db';
import { addItem, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { FloorView } from './FloorView';

const adobo: MenuItem = { name: 'Chicken Adobo', priceMinor: 1250, category: 'Food', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('FloorView', () => {
  it('renders all 14 tables and calls onSelectTable on tap', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FloorView onSelectTable={onSelect} />);
    expect(await screen.findByText('Table 14')).toBeInTheDocument();
    expect(screen.getAllByText(/^Table \d+$/)).toHaveLength(14);
    await user.click(screen.getByText('Table 7'));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('shows covers and outstanding amount for open tabs, and Paid when settled', async () => {
    const unpaidTab = await openTab(5, 3);
    await addItem(unpaidTab, adobo);
    const paidTab = await openTab(9, 2);
    await addItem(paidTab, adobo);
    await payAll(paidTab);

    render(<FloorView onSelectTable={() => {}} />);
    expect(await screen.findByText('3 covers')).toBeInTheDocument();
    expect(await screen.findByText('£12.50 due')).toBeInTheDocument();
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/FloorView.test.tsx`
Expected: FAIL — stub renders no covers/amounts (first test may pass; second must fail).

- [ ] **Step 3: Replace `src/views/FloorView.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TABLE_NUMBERS } from '../db';
import { tabTotals } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

interface TableStatus {
  covers: number;
  outstandingMinor: number;
}

export function FloorView({ onSelectTable }: { onSelectTable: (n: number) => void }) {
  const currency = useCurrency();
  const statuses = useLiveQuery(async () => {
    const tabs = await db.tabs.where('status').equals('open').toArray();
    const byTable = new Map<number, TableStatus>();
    for (const tab of tabs) {
      const lines = await db.orderLines.where({ tabId: tab.id! }).toArray();
      byTable.set(tab.tableNumber, {
        covers: tab.covers,
        outstandingMinor: tabTotals(lines).outstandingMinor,
      });
    }
    return byTable;
  }, []);

  return (
    <div className="floor">
      {TABLE_NUMBERS.map(n => {
        const s = statuses?.get(n);
        const cls = !s ? 'free' : s.outstandingMinor > 0 ? 'unpaid' : 'paid';
        return (
          <button key={n} className={`table-card ${cls}`} onClick={() => onSelectTable(n)}>
            <span className="table-num">Table {n}</span>
            {s && <span className="covers">{s.covers} covers</span>}
            {s && (
              <span className="due">
                {s.outstandingMinor > 0 ? `${formatMoney(s.outstandingMinor, currency)} due` : 'Paid'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/FloorView.tsx src/views/FloorView.test.tsx
git commit -m "feat: floor view with live table status, covers, and amounts due"
```

---

### Task 6: Menu picker (tap to add items)

**Files:**
- Modify: `src/views/MenuPicker.tsx` (replace stub)
- Test: `src/views/MenuPicker.test.tsx`

**Interfaces:**
- Consumes: `db`, `MenuItem`, `seedIfEmpty`; `formatMoney`; `useCurrency`.
- Produces: `MenuPicker({ onPick }: { onPick: (item: MenuItem) => void })` — lists active menu items grouped by category; tapping an item calls `onPick(item)`.

- [ ] **Step 1: Write the failing test**

Create `src/views/MenuPicker.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, seedIfEmpty } from '../db';
import { resetDb } from '../test-utils';
import { MenuPicker } from './MenuPicker';

beforeEach(async () => {
  await resetDb();
  await seedIfEmpty();
});

describe('MenuPicker', () => {
  it('lists active items grouped by category and reports taps', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<MenuPicker onPick={onPick} />);
    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(await screen.findByText('Drinks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Chicken Adobo/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].name).toBe('Chicken Adobo');
  });

  it('hides inactive items', async () => {
    const adobo = await db.menuItems.where({ name: 'Chicken Adobo' }).first();
    await db.menuItems.update(adobo!.id!, { active: 0 });
    render(<MenuPicker onPick={() => {}} />);
    expect(await screen.findByText('Pork Sisig')).toBeInTheDocument();
    expect(screen.queryByText('Chicken Adobo')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/MenuPicker.test.tsx`
Expected: FAIL — stub renders nothing.

- [ ] **Step 3: Replace `src/views/MenuPicker.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MenuItem } from '../db';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

export function MenuPicker({ onPick }: { onPick: (item: MenuItem) => void }) {
  const currency = useCurrency();
  const items =
    useLiveQuery(
      () => db.menuItems.orderBy('sortOrder').filter(i => i.active === 1).toArray(),
      [],
    ) ?? [];
  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="menu-picker">
      {categories.map(cat => (
        <section key={cat}>
          <h2>{cat}</h2>
          <div className="menu-grid">
            {items
              .filter(i => i.category === cat)
              .map(i => (
                <button key={i.id} onClick={() => onPick(i)}>
                  {i.name}
                  <span>{formatMoney(i.priceMinor, currency)}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/MenuPicker.tsx src/views/MenuPicker.test.tsx
git commit -m "feat: menu picker with categories and tap-to-add"
```

---

### Task 7: Table view (tab, covers, pay per item, close)

**Files:**
- Modify: `src/views/TableView.tsx` (replace stub)
- Test: `src/views/TableView.test.tsx`

**Interfaces:**
- Consumes: `getOpenTab`, `openTab`, `addItem`, `setLineQty`, `payLine`, `unpayLine`, `payAll`, `setCovers`, `closeTab`, `tabTotals` from `src/ops.ts`; `db`; `MenuPicker` (Task 6); `formatMoney`; `useCurrency`.
- Produces: `TableView({ tableNumber, onBack })` — same props as the Task 4 stub.

- [ ] **Step 1: Write the failing test**

Create `src/views/TableView.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedIfEmpty } from '../db';
import { resetDb } from '../test-utils';
import { TableView } from './TableView';

beforeEach(async () => {
  await resetDb();
  await seedIfEmpty();
});

describe('TableView', () => {
  it('opens a table, adds items from the menu, and shows totals', async () => {
    const user = userEvent.setup();
    render(<TableView tableNumber={4} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));

    await user.click(await screen.findByRole('button', { name: 'Add items' }));
    await user.click(await screen.findByRole('button', { name: /Coke/ }));
    await user.click(screen.getByRole('button', { name: /Coke/ })); // qty 2

    expect(await screen.findByText('Total £5.60')).toBeInTheDocument();
    expect(screen.getByText('Due £5.60')).toBeInTheDocument();
  });

  it('adjusts covers with a floor of 1', async () => {
    const user = userEvent.setup();
    render(<TableView tableNumber={4} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));
    await user.click(await screen.findByRole('button', { name: 'increase covers' }));
    expect(await screen.findByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'decrease covers' }));
    await user.click(screen.getByRole('button', { name: 'decrease covers' }));
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('pays an item, pays all, and closes the table', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<TableView tableNumber={4} onBack={onBack} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));
    await user.click(await screen.findByRole('button', { name: 'Add items' }));
    await user.click(await screen.findByRole('button', { name: /Coke/ }));
    await user.click(await screen.findByRole('button', { name: /Chicken Adobo/ }));
    await user.click(screen.getByRole('button', { name: 'Hide menu' }));

    expect(screen.getByRole('button', { name: 'Close table' })).toBeDisabled();

    // pay the Coke line only
    const payButtons = await screen.findAllByRole('button', { name: 'Pay' });
    await user.click(payButtons[0]);
    expect(await screen.findByRole('button', { name: 'Paid ✓' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pay all' }));
    expect(await screen.findByText('Due £0.00')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Close table' });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/TableView.test.tsx`
Expected: FAIL — stub has no "Open table" button.

- [ ] **Step 3: Replace `src/views/TableView.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  addItem, closeTab, getOpenTab, openTab, payAll, payLine, unpayLine,
  setCovers, setLineQty, tabTotals,
} from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';
import { MenuPicker } from './MenuPicker';

export function TableView({ tableNumber, onBack }: { tableNumber: number; onBack: () => void }) {
  const currency = useCurrency();
  const [showMenu, setShowMenu] = useState(false);
  const tab = useLiveQuery(() => getOpenTab(tableNumber), [tableNumber]);
  const lines =
    useLiveQuery(
      () => (tab?.id ? db.orderLines.where({ tabId: tab.id }).sortBy('addedAt') : Promise.resolve([])),
      [tab?.id],
    ) ?? [];
  const totals = tabTotals(lines);

  async function handleClose() {
    if (!tab?.id) return;
    await closeTab(tab.id);
    onBack();
  }

  return (
    <div className="table-view">
      <header>
        <button onClick={onBack}>← Tables</button>
        <h1>Table {tableNumber}</h1>
      </header>

      {!tab ? (
        <button className="big" onClick={() => openTab(tableNumber)}>Open table</button>
      ) : (
        <>
          <div className="covers-row">
            Covers:
            <button aria-label="decrease covers" onClick={() => setCovers(tab.id!, tab.covers - 1)}>−</button>
            <span>{tab.covers}</span>
            <button aria-label="increase covers" onClick={() => setCovers(tab.id!, tab.covers + 1)}>+</button>
          </div>

          <ul className="lines">
            {lines.map(l => {
              const paid = l.qty > 0 && l.paidQty >= l.qty;
              return (
                <li key={l.id} className={paid ? 'line paid' : 'line'}>
                  <span className="line-name">{l.name}</span>
                  <span className="qty-controls">
                    <button aria-label={`decrease ${l.name}`} onClick={() => setLineQty(l.id!, l.qty - 1)}>−</button>
                    <span>{l.qty}</span>
                    <button aria-label={`increase ${l.name}`} onClick={() => setLineQty(l.id!, l.qty + 1)}>+</button>
                  </span>
                  <span>{formatMoney(l.priceMinor * l.qty, currency)}</span>
                  {paid ? (
                    <button onClick={() => unpayLine(l.id!)}>Paid ✓</button>
                  ) : (
                    <button onClick={() => payLine(l.id!)}>Pay</button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="totals">
            <span>Total {formatMoney(totals.totalMinor, currency)}</span>
            <span>Paid {formatMoney(totals.paidMinor, currency)}</span>
            <strong>Due {formatMoney(totals.outstandingMinor, currency)}</strong>
          </div>

          <div className="actions">
            <button className="big" onClick={() => setShowMenu(s => !s)}>
              {showMenu ? 'Hide menu' : 'Add items'}
            </button>
            <button className="big" disabled={totals.outstandingMinor === 0} onClick={() => payAll(tab.id!)}>
              Pay all
            </button>
            <button className="big" disabled={totals.outstandingMinor !== 0} onClick={handleClose}>
              Close table
            </button>
          </div>

          {showMenu && <MenuPicker onPick={item => addItem(tab.id!, item)} />}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/TableView.tsx src/views/TableView.test.tsx
git commit -m "feat: table view with covers, per-item payment, pay all, and close"
```

---

### Task 8: Menu settings (CRUD + currency)

**Files:**
- Modify: `src/views/MenuSettings.tsx` (replace stub)
- Test: `src/views/MenuSettings.test.tsx`

**Interfaces:**
- Consumes: `db`, `MenuItem`, `seedIfEmpty`; `formatMoney`, `parsePrice`; `useCurrency`.
- Produces: `MenuSettings()` — add/edit/hide/delete menu items; edit the currency-symbol setting. Must render the literal text "Currency symbol" (asserted by `src/App.test.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/views/MenuSettings.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, seedIfEmpty } from '../db';
import { resetDb } from '../test-utils';
import { MenuSettings } from './MenuSettings';

beforeEach(async () => {
  await resetDb();
  await seedIfEmpty();
});

describe('MenuSettings', () => {
  it('adds a new item with a parsed price', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    await user.type(await screen.findByPlaceholderText('Name'), 'Sinigang');
    await user.type(screen.getByPlaceholderText('Price'), '13.75');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Sinigang — £13.75/)).toBeInTheDocument();
    const saved = await db.menuItems.where({ name: 'Sinigang' }).first();
    expect(saved?.priceMinor).toBe(1375);
  });

  it('hides and shows an item', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    const row = (await screen.findByText(/Chicken Adobo/)).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Hide' }));
    expect((await db.menuItems.where({ name: 'Chicken Adobo' }).first())?.active).toBe(0);
  });

  it('deletes an item after confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const user = userEvent.setup();
    render(<MenuSettings />);
    const row = (await screen.findByText(/Coke/)).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(await db.menuItems.where({ name: 'Coke' }).count()).toBe(0);
    vi.unstubAllGlobals();
  });

  it('updates the currency symbol setting', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    const input = await screen.findByLabelText(/currency symbol/i);
    await user.clear(input);
    await user.type(input, '₱');
    expect((await db.settings.get('currency'))?.value).toBe('₱');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/MenuSettings.test.tsx`
Expected: FAIL — stub has no form.

- [ ] **Step 3: Replace `src/views/MenuSettings.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatMoney, parsePrice } from '../money';
import { useCurrency } from '../useCurrency';

interface Draft {
  name: string;
  price: string;
  category: string;
}

const emptyDraft: Draft = { name: '', price: '', category: 'Food' };

export function MenuSettings() {
  const currency = useCurrency();
  // Raw stored value (may be '') drives the input so clearing it doesn't
  // immediately re-inject the '£' fallback into the controlled field.
  const rawCurrency =
    useLiveQuery(async () => (await db.settings.get('currency'))?.value ?? '', [], '') ?? '';
  const items = useLiveQuery(() => db.menuItems.orderBy('sortOrder').toArray(), []) ?? [];
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function saveDraft(id?: number) {
    const priceMinor = parsePrice(draft.price);
    const name = draft.name.trim();
    const category = draft.category.trim() || 'Food';
    if (!name || priceMinor === null) return;
    if (id !== undefined) {
      await db.menuItems.update(id, { name, priceMinor, category });
    } else {
      await db.menuItems.add({ name, priceMinor, category, active: 1, sortOrder: items.length });
    }
    setDraft(emptyDraft);
    setEditingId(null);
  }

  const form = (id?: number) => (
    <div className="item-form">
      <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input placeholder="Price" inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
      <input placeholder="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
      <button onClick={() => saveDraft(id)}>Save</button>
      {id !== undefined && <button onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>Cancel</button>}
    </div>
  );

  return (
    <div className="menu-settings">
      <label className="currency-row">
        Currency symbol
        <input
          value={rawCurrency}
          onChange={e => db.settings.put({ key: 'currency', value: e.target.value })}
        />
      </label>

      <h2>Add item</h2>
      {editingId === null && form()}

      <h2>Items</h2>
      <ul>
        {items.map(i =>
          editingId === i.id ? (
            <li key={i.id}>{form(i.id)}</li>
          ) : (
            <li key={i.id} className={i.active ? '' : 'inactive'}>
              <span>{i.name} — {formatMoney(i.priceMinor, currency)} ({i.category})</span>
              <button
                onClick={() => {
                  setEditingId(i.id!);
                  setDraft({ name: i.name, price: (i.priceMinor / 100).toFixed(2), category: i.category });
                }}
              >
                Edit
              </button>
              <button onClick={() => db.menuItems.update(i.id!, { active: i.active ? 0 : 1 })}>
                {i.active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => { if (confirm(`Delete ${i.name}?`)) db.menuItems.delete(i.id!); }}>
                Delete
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/MenuSettings.tsx src/views/MenuSettings.test.tsx
git commit -m "feat: menu settings with item CRUD and currency symbol"
```

---

### Task 9: History view (closed tabs by day)

**Files:**
- Modify: `src/views/HistoryView.tsx` (replace stub)
- Test: `src/views/HistoryView.test.tsx`

**Interfaces:**
- Consumes: `db`, `Tab`; `tabTotals`; `formatMoney`; `useCurrency`; ops for test setup.
- Produces: `HistoryView()` — closed tabs newest-first, grouped by calendar day, each expandable (`<details>`) to show its lines. Must render "No closed tabs yet." when empty (asserted by `src/App.test.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/views/HistoryView.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MenuItem } from '../db';
import { addItem, closeTab, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { HistoryView } from './HistoryView';

const coke: MenuItem = { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('HistoryView', () => {
  it('shows an empty message when there is no history', async () => {
    render(<HistoryView />);
    expect(await screen.findByText(/no closed tabs/i)).toBeInTheDocument();
  });

  it('lists a closed tab with its total and expandable lines', async () => {
    const user = userEvent.setup();
    const tabId = await openTab(6, 2);
    await addItem(tabId, coke);
    await addItem(tabId, coke);
    await payAll(tabId);
    await closeTab(tabId);

    render(<HistoryView />);
    const summary = await screen.findByText(/Table 6, 2 covers — £5.60/);
    expect(summary).toBeInTheDocument();
    await user.click(summary);
    expect(await screen.findByText(/2× Coke — £5.60/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/HistoryView.test.tsx`
Expected: FAIL — stub never lists closed tabs (second test fails).

- [ ] **Step 3: Replace `src/views/HistoryView.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Tab } from '../db';
import { tabTotals } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

function ClosedTab({ tab, currency }: { tab: Tab; currency: string }) {
  const lines = useLiveQuery(() => db.orderLines.where({ tabId: tab.id! }).toArray(), [tab.id]) ?? [];
  const totals = tabTotals(lines);
  const time = new Date(tab.closedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <details className="closed-tab">
      <summary>
        {time} — Table {tab.tableNumber}, {tab.covers} covers — {formatMoney(totals.totalMinor, currency)}
      </summary>
      <ul>
        {lines.map(l => (
          <li key={l.id}>
            {l.qty}× {l.name} — {formatMoney(l.priceMinor * l.qty, currency)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function HistoryView() {
  const currency = useCurrency();
  const tabs =
    useLiveQuery(async () => (await db.tabs.where('status').equals('closed').sortBy('closedAt')).reverse(), []) ?? [];

  if (tabs.length === 0) return <p className="empty">No closed tabs yet.</p>;

  const byDay = new Map<string, Tab[]>();
  for (const t of tabs) {
    const day = new Date(t.closedAt!).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(t);
  }

  return (
    <div className="history">
      {[...byDay.entries()].map(([day, dayTabs]) => (
        <section key={day}>
          <h2>{day}</h2>
          {dayTabs.map(t => (
            <ClosedTab key={t.id} tab={t} currency={currency} />
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/HistoryView.tsx src/views/HistoryView.test.tsx
git commit -m "feat: order history grouped by day with expandable tabs"
```

---

### Task 10: Daily summary (takings, covers, items sold)

**Files:**
- Modify: `src/ops.ts` (add `daySummary`), `src/views/SummaryView.tsx` (replace stub)
- Test: `src/ops.test.ts` (add a describe block), `src/views/SummaryView.test.tsx`

**Interfaces:**
- Consumes: `db`; `closeTab`/`payAll` etc. for test setup; `formatMoney`; `useCurrency`.
- Produces (added to `src/ops.ts`): `daySummary(dayStart: number, dayEnd: number): Promise<DaySummary>` where `DaySummary = { tabCount: number; coverCount: number; takingsMinor: number; items: { name: string; qty: number; amountMinor: number }[] }` — aggregates tabs whose `closedAt` is in `[dayStart, dayEnd)`, items sorted by qty desc. `SummaryView()` with a date picker defaulting to today.

- [ ] **Step 1: Write the failing ops test**

Append to `src/ops.test.ts` (import `daySummary` from `./ops` and `type MenuItem` already imported):

```ts
describe('daySummary', () => {
  it('aggregates takings, covers, and items for tabs closed in the window', async () => {
    const t1 = await openTab(1, 2);
    await addItem(t1, adobo);
    await addItem(t1, coke);
    await payAll(t1);
    await closeTab(t1);

    const t2 = await openTab(2, 3);
    await addItem(t2, coke);
    await payAll(t2);
    await closeTab(t2);

    const openStill = await openTab(3, 4); // open tab must be excluded
    await addItem(openStill, coke);

    const now = Date.now();
    const summary = await daySummary(now - 60_000, now + 60_000);
    expect(summary.tabCount).toBe(2);
    expect(summary.coverCount).toBe(5);
    expect(summary.takingsMinor).toBe(1810); // 1250 + 280 + 280
    expect(summary.items).toEqual([
      { name: 'Coke', qty: 2, amountMinor: 560 },
      { name: 'Chicken Adobo', qty: 1, amountMinor: 1250 },
    ]);
  });

  it('excludes tabs closed outside the window', async () => {
    const t1 = await openTab(1);
    await addItem(t1, coke);
    await payAll(t1);
    await closeTab(t1);
    const summary = await daySummary(0, 1000); // window in 1970
    expect(summary.tabCount).toBe(0);
    expect(summary.takingsMinor).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ops.test.ts`
Expected: FAIL — `daySummary` is not exported.

- [ ] **Step 3: Implement `daySummary` in `src/ops.ts`**

Append:

```ts
export interface DaySummary {
  tabCount: number;
  coverCount: number;
  takingsMinor: number;
  items: { name: string; qty: number; amountMinor: number }[];
}

export async function daySummary(dayStart: number, dayEnd: number): Promise<DaySummary> {
  const tabs = await db.tabs.where('closedAt').between(dayStart, dayEnd, true, false).toArray();
  const itemMap = new Map<string, { name: string; qty: number; amountMinor: number }>();
  let takingsMinor = 0;
  let coverCount = 0;
  for (const tab of tabs) {
    coverCount += tab.covers;
    const lines = await db.orderLines.where({ tabId: tab.id! }).toArray();
    for (const l of lines) {
      takingsMinor += l.priceMinor * l.paidQty;
      const entry = itemMap.get(l.name) ?? { name: l.name, qty: 0, amountMinor: 0 };
      entry.qty += l.paidQty;
      entry.amountMinor += l.priceMinor * l.paidQty;
      itemMap.set(l.name, entry);
    }
  }
  const items = [...itemMap.values()].sort((a, b) => b.qty - a.qty);
  return { tabCount: tabs.length, coverCount, takingsMinor, items };
}
```

(Open tabs have `closedAt: null`, which IndexedDB cannot index, so they are automatically absent from the `closedAt` index — no extra filtering needed.)

Run: `npx vitest run src/ops.test.ts` — expected: PASS.

- [ ] **Step 4: Write the failing view test**

Create `src/views/SummaryView.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MenuItem } from '../db';
import { addItem, closeTab, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { SummaryView } from './SummaryView';

const coke: MenuItem = { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('SummaryView', () => {
  it("shows today's takings, tables, covers, and items sold", async () => {
    const tabId = await openTab(3, 4);
    await addItem(tabId, coke);
    await addItem(tabId, coke);
    await payAll(tabId);
    await closeTab(tabId);

    render(<SummaryView />);
    // £5.60 appears both in the takings stat and the item amount cell
    expect(await screen.findAllByText('£5.60')).toHaveLength(2);
    expect(await screen.findByText('takings')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument(); // covers
    expect(await screen.findByRole('cell', { name: 'Coke' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('shows an empty state for a day with no sales', async () => {
    render(<SummaryView />);
    expect(await screen.findByText(/nothing sold/i)).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/views/SummaryView.test.tsx` — expected: FAIL (stub).

- [ ] **Step 5: Replace `src/views/SummaryView.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { daySummary } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

function toDateInputValue(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function SummaryView() {
  const currency = useCurrency();
  const [day, setDay] = useState(() => toDateInputValue(new Date()));
  const summary = useLiveQuery(() => {
    const start = new Date(`${day}T00:00:00`).getTime();
    return daySummary(start, start + 24 * 60 * 60 * 1000);
  }, [day]);

  return (
    <div className="summary">
      <input type="date" aria-label="Summary date" value={day} onChange={e => setDay(e.target.value)} />
      {summary && (
        <>
          <div className="stat-row">
            <div className="stat"><strong>{formatMoney(summary.takingsMinor, currency)}</strong><span>takings</span></div>
            <div className="stat"><strong>{summary.tabCount}</strong><span>tables</span></div>
            <div className="stat"><strong>{summary.coverCount}</strong><span>covers</span></div>
          </div>
          <h2>Items sold</h2>
          {summary.items.length === 0 ? (
            <p className="empty">Nothing sold this day.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {summary.items.map(i => (
                  <tr key={i.name}>
                    <td>{i.name}</td>
                    <td>{i.qty}</td>
                    <td>{formatMoney(i.amountMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ops.ts src/ops.test.ts src/views/SummaryView.tsx src/views/SummaryView.test.tsx
git commit -m "feat: daily sales summary with takings, covers, and items sold"
```

---

### Task 11: PWA, build verification, README

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon.svg`, `README.md`

**Interfaces:**
- Consumes: the finished app.
- Produces: an installable, offline-capable production build (`npm run build` output in `dist/`).

- [ ] **Step 1: Install and configure vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

Update `vite.config.ts` plugins:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Cusina Ko POS',
        short_name: 'Cusina POS',
        description: 'Offline table and order tracking for Cusina Ko',
        display: 'standalone',
        start_url: '.',
        background_color: '#faf7f2',
        theme_color: '#7a3b2e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#7a3b2e"/>
  <text x="50" y="64" font-family="Georgia, serif" font-size="44" fill="#faf7f2"
        text-anchor="middle" font-weight="bold">CK</text>
</svg>
```

Add to `index.html` `<head>`: `<link rel="icon" href="/icon.svg" />` and `<meta name="theme-color" content="#7a3b2e" />`.

- [ ] **Step 2: Verify tests and build**

Run: `npx vitest run` — expected: PASS.
Run: `npm run build` — expected: builds cleanly; output mentions the generated service worker (`sw.js`) and manifest.

- [ ] **Step 3: Manual smoke test**

Run `npm run preview` in the background, then in a browser (or via the Playwright MCP tools) at the preview URL:
1. Floor shows 14 tables. Tap Table 5 → Open table → Add items → tap two menu items → totals update instantly.
2. Pay one line → line turns paid. Pay all → Close table → back on floor, Table 5 is free again.
3. History shows the closed tab under today; Summary shows the takings and items.
4. Menu screen: add an item, change the currency symbol, confirm prices re-render.
5. Reload the page — all data persists (IndexedDB).

- [ ] **Step 4: Write `README.md`**

```markdown
# Cusina Ko POS

Offline, single-device table & order tracker for Cusina Ko (14 tables).

- **Run in dev:** `npm install && npm run dev`
- **Tests:** `npm test`
- **Production build:** `npm run build`, then serve `dist/` from any static host
  (or `npm run preview` locally). Installable as a PWA; works fully offline.

All data lives in the browser's IndexedDB (database `cusina-pos`) on the device
where the app is used — there is no server. Clearing browser site data erases
menu, tabs, and history.

## Screens

- **Tables** — live floor view of tables 1–14 with covers and amount due.
- **Table** — open a tab, set covers, tap-to-add items, pay per item / pay all, close.
- **History** — closed tabs grouped by day.
- **Summary** — daily takings, table count, covers, items sold.
- **Menu** — add/edit/hide/delete items, set currency symbol.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: PWA install/offline support, app icon, and README"
```

---

## Verification (end-to-end)

1. `npx vitest run` — full suite green (unit: money, db, ops; component: all six views + App nav).
2. `npm run build` — clean production build with service worker + manifest.
3. Manual/Playwright smoke test per Task 11 Step 3, including a **page reload** to prove persistence and a **DevTools → Network → Offline** check to prove the built app loads with no network.
4. Data-integrity spot check: with one item paid on a two-item tab, "Close table" is disabled and `closeTab` throws; covers never drop below 1; qty never drops below paidQty.

## Out of scope for v1 (explicitly agreed or deferred)

- Multi-device sync, printing, payment-method (cash/card) recording, discounts/service charge, splitting one line across payers, user accounts. The Dexie schema (integer money, per-line `paidQty`) leaves room for these later without migration pain.
