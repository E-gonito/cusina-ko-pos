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
