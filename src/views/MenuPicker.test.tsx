import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, type MenuItem } from '../db';
import { resetDb } from '../test-utils';
import { MenuPicker } from './MenuPicker';

// Fixed test fixture — independent of the app's editable starter menu.
const TEST_MENU: MenuItem[] = [
  { name: 'Chicken Adobo', priceMinor: 1250, category: 'Food', active: 1, sortOrder: 0 },
  { name: 'Pork Sisig', priceMinor: 1300, category: 'Food', active: 1, sortOrder: 1 },
  { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 2 },
];

beforeEach(async () => {
  await resetDb();
  await db.menuItems.bulkAdd(TEST_MENU);
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
