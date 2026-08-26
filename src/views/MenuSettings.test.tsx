import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, seedIfEmpty } from '../db';
import { resetDb } from '../test-utils';
import { MenuSettings } from './MenuSettings';

beforeEach(async () => {
  await resetDb();
  await seedIfEmpty();
});

describe('MenuSettings', () => {
  it('adds a new item with a parsed price', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    await user.type(await screen.findByPlaceholderText('Name'), 'Sinigang');
    await user.type(screen.getByPlaceholderText('Price'), '13.75');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Sinigang — £13.75/)).toBeInTheDocument();
    const saved = await db.menuItems.where({ name: 'Sinigang' }).first();
    expect(saved?.priceMinor).toBe(1375);
  });

  it('hides and shows an item', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    const row = (await screen.findByText(/Chicken Adobo/)).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Hide' }));
    expect((await db.menuItems.where({ name: 'Chicken Adobo' }).first())?.active).toBe(0);
  });

  it('deletes an item after confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const user = userEvent.setup();
    render(<MenuSettings />);
    const row = (await screen.findByText(/Coke/)).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(await db.menuItems.where({ name: 'Coke' }).count()).toBe(0);
    vi.unstubAllGlobals();
  });

  it('updates the currency symbol setting', async () => {
    const user = userEvent.setup();
    render(<MenuSettings />);
    const input = await screen.findByLabelText(/currency symbol/i);
    await user.clear(input);
    await user.type(input, '₱');
    expect((await db.settings.get('currency'))?.value).toBe('₱');
  });
});
