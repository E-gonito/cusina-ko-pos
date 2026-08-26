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
