import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MenuItem } from '../db';
import { addItem, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { FloorView } from './FloorView';

const adobo: MenuItem = { name: 'Chicken Adobo', priceMinor: 1250, category: 'Food', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('FloorView', () => {
  it('renders all 14 tables and calls onSelectTable on tap', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FloorView onSelectTable={onSelect} />);
    expect(await screen.findByText('Table 14')).toBeInTheDocument();
    expect(screen.getAllByText(/^Table \d+$/)).toHaveLength(14);
    await user.click(screen.getByText('Table 7'));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('shows covers and outstanding amount for open tabs, and Paid when settled', async () => {
    const unpaidTab = await openTab(5, 3);
    await addItem(unpaidTab, adobo);
    const paidTab = await openTab(9, 2);
    await addItem(paidTab, adobo);
    await payAll(paidTab);

    render(<FloorView onSelectTable={() => {}} />);
    expect(await screen.findByText('3 covers')).toBeInTheDocument();
    expect(await screen.findByText('£12.50 due')).toBeInTheDocument();
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });
});
