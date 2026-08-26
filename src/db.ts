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
    this.version(2).stores({
      menuItems: '++id, name, category, sortOrder',
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
