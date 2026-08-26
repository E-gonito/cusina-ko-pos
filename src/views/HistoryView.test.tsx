import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MenuItem } from '../db';
import { addItem, closeTab, openTab, payAll } from '../ops';
import { resetDb } from '../test-utils';
import { HistoryView } from './HistoryView';

const coke: MenuItem = { name: 'Coke', priceMinor: 280, category: 'Drinks', active: 1, sortOrder: 0 };

beforeEach(resetDb);

describe('HistoryView', () => {
  it('shows an empty message when there is no history', async () => {
    render(<HistoryView />);
    expect(await screen.findByText(/no closed tabs/i)).toBeInTheDocument();
  });

  it('lists a closed tab with its total and expandable lines', async () => {
    const user = userEvent.setup();
    const tabId = await openTab(6, 2);
    await addItem(tabId, coke);
    await addItem(tabId, coke);
    await payAll(tabId);
    await closeTab(tabId);

    render(<HistoryView />);
    const summary = await screen.findByText(/Table 6, 2 covers — £5.60/);
    expect(summary).toBeInTheDocument();
    await user.click(summary);
    expect(await screen.findByText(/2× Coke — £5.60/)).toBeInTheDocument();
  });
});
