import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { resetDb } from './test-utils';

beforeEach(resetDb);

describe('App', () => {
  it('shows the floor view by default and switches views via the nav', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Tables' })).toBeInTheDocument();
    expect(await screen.findByText('Table 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText(/no closed tabs/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(await screen.findByText(/currency symbol/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tables' }));
    expect(await screen.findByText('Table 14')).toBeInTheDocument();
  });
});
