import { db, type MenuItem, type OrderLine, type Tab } from './db';

export async function openTab(tableNumber: number, covers = 1): Promise<number> {
  return db.transaction('rw', db.tabs, db.orderLines, async () => {
    const existing = await getOpenTab(tableNumber);
    if (existing) return existing.id!;
    return db.tabs.add({ tableNumber, covers, status: 'open', openedAt: Date.now(), closedAt: null });
  });
}

export function getOpenTab(tableNumber: number): Promise<Tab | undefined> {
  return db.tabs.where({ tableNumber }).filter(t => t.status === 'open').first();
}

export async function addItem(tabId: number, item: MenuItem): Promise<void> {
  return db.transaction('rw', db.orderLines, async () => {
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
  });
}

export async function setLineQty(lineId: number, qty: number): Promise<void> {
  return db.transaction('rw', db.orderLines, async () => {
    const line = await db.orderLines.get(lineId);
    if (!line) return;
    const clamped = Math.max(line.paidQty, qty);
    if (clamped <= 0) await db.orderLines.delete(lineId);
    else await db.orderLines.update(lineId, { qty: clamped });
  });
}

export async function payLine(lineId: number): Promise<void> {
  return db.transaction('rw', db.orderLines, async () => {
    const line = await db.orderLines.get(lineId);
    if (line) await db.orderLines.update(lineId, { paidQty: line.qty });
  });
}

export async function unpayLine(lineId: number): Promise<void> {
  await db.orderLines.update(lineId, { paidQty: 0 });
}

export async function payAll(tabId: number): Promise<void> {
  return db.transaction('rw', db.orderLines, async () => {
    const lines = await db.orderLines.where({ tabId }).toArray();
    await db.orderLines.bulkPut(lines.map(l => ({ ...l, paidQty: l.qty })));
  });
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
  return db.transaction('rw', db.tabs, db.orderLines, async () => {
    const lines = await db.orderLines.where({ tabId }).toArray();
    if (lines.length === 0) {
      await db.tabs.delete(tabId);
      return;
    }
    if (tabTotals(lines).outstandingMinor !== 0) throw new Error('Tab has unpaid items');
    await db.tabs.update(tabId, { status: 'closed', closedAt: Date.now() });
  });
}

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
