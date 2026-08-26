import Dexie, { type Table } from "dexie";

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
	status: "open" | "closed";
	openedAt: number; // epoch ms
	closedAt: number | null;
	discountPct?: number; // 0–100 whole-bill % discount; absent = 0
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
		super("cusina-pos");
		this.version(1).stores({
			menuItems: "++id, category, sortOrder",
			tabs: "++id, tableNumber, status, closedAt",
			orderLines: "++id, tabId",
			settings: "key",
		});
		this.version(2).stores({
			menuItems: "++id, name, category, sortOrder",
		});
	}
}

export const db = new PosDb();

// Placeholder starter menu — the user edits this in-app on the Menu screen.
const STARTER_MENU: Omit<MenuItem, "id">[] = [
	{
		name: "Buffet",
		priceMinor: 1499,
		category: "Food",
		active: 1,
		sortOrder: 0,
	},
	{
		name: "Halo-Halo",
		priceMinor: 1200,
		category: "Food",
		active: 1,
		sortOrder: 1,
	},
	{
		name: "San Miguel 330ml",
		priceMinor: 450,
		category: "Drinks",
		active: 1,
		sortOrder: 2,
	},
	{
		name: "Margarita",
		priceMinor: 1200,
		category: "Drinks",
		active: 1,
		sortOrder: 3,
	},
	{
		name: "Corona 330ml",
		priceMinor: 499,
		category: "Drinks",
		active: 1,
		sortOrder: 4,
	},
	{
		name: "Fosters 440ml",
		priceMinor: 499,
		category: "Drinks",
		active: 1,
		sortOrder: 5,
	},
	{
		name: "Budweiser 300ml",
		priceMinor: 399,
		category: "Drinks",
		active: 1,
		sortOrder: 6,
	},
	{
		name: "Red Horse 330ml",
		priceMinor: 699,
		category: "Drinks",
		active: 1,
		sortOrder: 7,
	},
	{
		name: "Beer Bucket",
		priceMinor: 3000,
		category: "Drinks",
		active: 1,
		sortOrder: 8,
	},
	{
		name: "Coke",
		priceMinor: 299,
		category: "Drinks",
		active: 1,
		sortOrder: 9,
	},
	{
		name: "Sprite",
		priceMinor: 299,
		category: "Drinks",
		active: 1,
		sortOrder: 10,
	},
	{
		name: "Lemonade",
		priceMinor: 299,
		category: "Drinks",
		active: 1,
		sortOrder: 11,
	},
	{
		name: "Bottled Water",
		priceMinor: 150,
		category: "Drinks",
		active: 1,
		sortOrder: 12,
	},
];

export async function seedIfEmpty(): Promise<void> {
	if ((await db.menuItems.count()) === 0) {
		await db.menuItems.bulkAdd(STARTER_MENU as MenuItem[]);
	}
	if (!(await db.settings.get("currency"))) {
		await db.settings.put({ key: "currency", value: "£" });
	}
}
