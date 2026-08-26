import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedIfEmpty } from '../db';
import { resetDb } from '../test-utils';
import { TableView } from './TableView';

beforeEach(async () => {
  await resetDb();
  await seedIfEmpty();
});

describe('TableView', () => {
  it('opens a table, adds items from the menu, and shows totals', async () => {
    const user = userEvent.setup();
    render(<TableView tableNumber={4} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));

    await user.click(await screen.findByRole('button', { name: 'Add items' }));
    await user.click(await screen.findByRole('button', { name: /Coke/ }));
    await user.click(screen.getByRole('button', { name: /Coke/ })); // qty 2

    expect(await screen.findByText('Total £5.60')).toBeInTheDocument();
    expect(screen.getByText('Due £5.60')).toBeInTheDocument();
  });

  it('adjusts covers with a floor of 1', async () => {
    const user = userEvent.setup();
    render(<TableView tableNumber={4} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));
    await user.click(await screen.findByRole('button', { name: 'increase covers' }));
    expect(await screen.findByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'decrease covers' }));
    await user.click(screen.getByRole('button', { name: 'decrease covers' }));
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('pays an item, pays all, and closes the table', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<TableView tableNumber={4} onBack={onBack} />);
    await user.click(await screen.findByRole('button', { name: 'Open table' }));
    await user.click(await screen.findByRole('button', { name: 'Add items' }));
    await user.click(await screen.findByRole('button', { name: /Coke/ }));
    await user.click(await screen.findByRole('button', { name: /Chicken Adobo/ }));
    await user.click(screen.getByRole('button', { name: 'Hide menu' }));

    expect(screen.getByRole('button', { name: 'Close table' })).toBeDisabled();

    // pay the Coke line only
    const payButtons = await screen.findAllByRole('button', { name: 'Pay' });
    await user.click(payButtons[0]);
    expect(await screen.findByRole('button', { name: 'Paid ✓' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pay all' }));
    expect(await screen.findByText('Due £0.00')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Close table' });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(onBack).toHaveBeenCalled();
  });
});
