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
