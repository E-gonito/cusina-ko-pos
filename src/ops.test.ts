import { beforeEach, describe, expect, it } from 'vitest';
import { db, type MenuItem } from './db';
import {
  addItem, closeTab, daySummary, getOpenTab, openTab, payAll, payLine, unpayLine,
  setCovers, setDiscount, setLineQty, tabTotals,
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

  it('closes the addItem race: concurrent adds of the same item merge into one line', async () => {
    const tabId = await openTab(1);
    await Promise.all([addItem(tabId, adobo), addItem(tabId, adobo)]);
    const lines = await db.orderLines.where({ tabId }).toArray();
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
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
    expect(tabTotals(lines)).toEqual({
      grossMinor: 2780, discountMinor: 0, totalMinor: 2780, paidMinor: 0, outstandingMinor: 2780,
    });

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

describe('discount', () => {
  it('clamps the discount to 0–100 whole percent', async () => {
    const tabId = await openTab(4);
    await setDiscount(tabId, -10);
    expect((await db.tabs.get(tabId))?.discountPct).toBe(0);
    await setDiscount(tabId, 150);
    expect((await db.tabs.get(tabId))?.discountPct).toBe(100);
    await setDiscount(tabId, 12.4);
    expect((await db.tabs.get(tabId))?.discountPct).toBe(12);
  });

  it('applies the percentage to totals and paid amounts', async () => {
    const tabId = await openTab(4);
    await addItem(tabId, adobo); // 1250
    await addItem(tabId, coke); // 280 → gross 1530
    let lines = await db.orderLines.where({ tabId }).toArray();
    expect(tabTotals(lines, 10)).toEqual({
      grossMinor: 1530, discountMinor: 153, totalMinor: 1377, paidMinor: 0, outstandingMinor: 1377,
    });

    const cokeLine = lines.find(l => l.name === 'Coke')!;
    await payLine(cokeLine.id!);
    lines = await db.orderLines.where({ tabId }).toArray();
    // paid gross 280 → 10% off → 252
    expect(tabTotals(lines, 10).paidMinor).toBe(252);
    expect(tabTotals(lines, 10).outstandingMinor).toBe(1377 - 252);
  });

  it('lets a fully paid discounted tab close, and blocks a partly paid one', async () => {
    const tabId = await openTab(4);
    await setDiscount(tabId, 15);
    await addItem(tabId, adobo);
    await addItem(tabId, coke);
    await expect(closeTab(tabId)).rejects.toThrow();
    await payAll(tabId);
    await closeTab(tabId);
    expect((await db.tabs.get(tabId))?.status).toBe('closed');
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

  it('reports takings net of discounts', async () => {
    const t1 = await openTab(1, 2);
    await setDiscount(t1, 10);
    await addItem(t1, coke);
    await addItem(t1, coke); // gross paid 560 → 10% off → 504
    await payAll(t1);
    await closeTab(t1);

    const now = Date.now();
    const summary = await daySummary(now - 60_000, now + 60_000);
    expect(summary.takingsMinor).toBe(504);
    expect(summary.discountMinor).toBe(56);
    // item breakdown stays gross; the discount is reported separately
    expect(summary.items).toEqual([{ name: 'Coke', qty: 2, amountMinor: 560 }]);
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
