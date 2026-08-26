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
