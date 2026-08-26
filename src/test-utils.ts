import { db } from './db';

export async function resetDb(): Promise<void> {
  await Promise.all([
    db.menuItems.clear(),
    db.tabs.clear(),
    db.orderLines.clear(),
    db.settings.clear(),
  ]);
}
