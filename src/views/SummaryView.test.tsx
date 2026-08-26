import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MenuItem } from '../db';
import { addItem, closeTab, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { SummaryView } from './SummaryView';

const coke: MenuItem = { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('SummaryView', () => {
  it("shows today's takings, tables, covers, and items sold", async () => {
    const tabId = await openTab(3, 4);
    await addItem(tabId, coke);
    await addItem(tabId, coke);
    await payAll(tabId);
    await closeTab(tabId);

    render(<SummaryView />);
    // £5.60 appears both in the takings stat and the item amount cell
    expect(await screen.findAllByText('£5.60')).toHaveLength(2);
    expect(await screen.findByText('takings')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument(); // covers
    expect(await screen.findByRole('cell', { name: 'Coke' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('shows an empty state for a day with no sales', async () => {
    render(<SummaryView />);
    expect(await screen.findByText(/nothing sold/i)).toBeInTheDocument();
  });
});
