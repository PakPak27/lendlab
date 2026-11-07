// F-04 My Borrowing (AC-04-05, AC-04-07): own requests, status text, due date in Bangkok time, states.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';

const borrower = { id: 3, email: 'borrower1@lendlab.test', name: 'Borrower One', role: 'BORROWER', locationIds: [] };

const pending = {
  id: 13,
  status: 'PENDING',
  purpose: 'Video project',
  requestedDays: 1,
  createdAt: '2026-11-07T05:00:00.000Z',
  item: { id: 7, assetTag: 'CAM-001', name: 'Canon EOS M50', status: 'RESERVED' },
  loan: null,
};
const onLoan = {
  id: 12,
  status: 'FULFILLED',
  purpose: 'Embedded systems lab',
  requestedDays: 7,
  createdAt: '2026-11-07T03:15:00.000Z',
  item: { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', status: 'ON_LOAN' },
  loan: { id: 5, status: 'ACTIVE', checkedOutAt: '2026-11-07T03:20:00.000Z', dueAt: '2026-11-14T03:20:00.000Z' },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function mockMine(reply: () => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) return json(200, { user: borrower });
    if (url.endsWith('/api/requests/mine')) return reply();
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
}

function renderMy() {
  sessionStorage.setItem('lendlab.token', 'tok');
  return render(
    <MemoryRouter initialEntries={['/my']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const rowFor = (assetTag: string) => screen.getByText(assetTag).closest('[data-testid="borrow-row"]') as HTMLElement;

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('My Borrowing', () => {
  it('lists requests in the order the server returns them (newest first)', async () => {
    mockMine(() => json(200, { requests: [pending, onLoan] }));
    renderMy();

    await screen.findByText('CAM-001');
    const tags = screen.getAllByTestId('borrow-row').map((r) => within(r).getByText(/^[A-Z]{3}-\d{3}$/).textContent);
    expect(tags).toEqual(['CAM-001', 'LAP-001']);
  });

  it('shows Pending with no due date for a request that is not checked out yet', async () => {
    mockMine(() => json(200, { requests: [pending] }));
    renderMy();

    const row = within(await screen.findByText('CAM-001').then(() => rowFor('CAM-001')));
    expect(row.getByText('Pending')).toBeInTheDocument();
    expect(row.getByText('Canon EOS M50')).toBeInTheDocument();
    expect(row.getByText('1 day')).toBeInTheDocument();
    expect(row.getByLabelText('No due date yet')).toBeInTheDocument();
  });

  it('shows On loan and the due date in Bangkok time once checked out', async () => {
    mockMine(() => json(200, { requests: [onLoan] }));
    renderMy();

    const row = within(await screen.findByText('LAP-001').then(() => rowFor('LAP-001')));
    expect(row.getByText('On loan')).toBeInTheDocument();
    expect(row.getByText('7 days')).toBeInTheDocument();
    // 03:20 UTC = 10:20 in Bangkok (UTC+7)
    expect(row.getByText(/14 Nov 2026, 10:20/)).toBeInTheDocument();
  });

  it('shows the empty state with a link to the catalog', async () => {
    mockMine(() => json(200, { requests: [] }));
    renderMy();

    expect(await screen.findByText(/You have no requests yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the catalog' })).toHaveAttribute('href', '/catalog');
  });

  it('shows the error with Retry, and Retry loads again', async () => {
    let calls = 0;
    mockMine(() => {
      calls += 1;
      return calls === 1
        ? json(500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
        : json(200, { requests: [pending] });
    });
    renderMy();

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('CAM-001')).toBeInTheDocument();
  });
});
