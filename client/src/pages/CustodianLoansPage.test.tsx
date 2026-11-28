// F-07 (Sprint 2), TEST-07-07 / AC-07-07: active loans list and recording a return.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustodianLoansPage from './CustodianLoansPage';

const loan = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 5,
  status: 'ACTIVE',
  checkedOutAt: '2026-11-20T03:00:00.000Z',
  dueAt: '2026-11-27T03:00:00.000Z',
  isOverdue: false,
  item: { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', location: { code: 'HW-LAB' } },
  borrower: { id: 3, name: 'Borrower One', email: 'borrower1@lendlab.test' },
  ...over,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const posts = (spy: { mock: { calls: Array<[unknown, unknown?]> } }) =>
  spy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

beforeEach(() => sessionStorage.setItem('lendlab.token', 'tok'));
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('CustodianLoansPage (F-07)', () => {
  it('shows the empty message when there are no active loans', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { loans: [] }));
    render(<CustodianLoansPage />);
    expect(await screen.findByText('No active loans in your locations.')).toBeInTheDocument();
  });

  it('lists asset tag, item, borrower and due date with a Return button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { loans: [loan()] }));
    render(<CustodianLoansPage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('LAP-001')).toBeInTheDocument();
    expect(within(table).getByText('Borrower One')).toBeInTheDocument();
    expect(within(table).getByText('27 Nov 2026 10:00')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Return' })).toBeInTheDocument();
  });

  it('records a return with Needs maintenance, removes the row and shows a toast', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { loans: [loan()] }));
    const user = userEvent.setup();
    render(<CustodianLoansPage />);
    await screen.findByText('LAP-001');

    await user.click(screen.getByRole('button', { name: 'Return' }));
    const dialog = screen.getByRole('dialog', { name: 'Record return' });
    expect(dialog).toHaveTextContent('Record the return of LAP-001 from Borrower One?');
    await user.click(within(dialog).getByLabelText('Needs maintenance'));
    spy.mockResolvedValueOnce(json(200, { loan: { id: 5, status: 'RETURNED', item: { id: 1, assetTag: 'LAP-001', status: 'MAINTENANCE' } } }));
    spy.mockResolvedValue(json(200, { loans: [] }));
    await user.click(within(dialog).getByRole('button', { name: 'Record return' }));

    expect(await screen.findByText('Return recorded — LAP-001 is in Maintenance.')).toBeInTheDocument();
    expect(await screen.findByText('No active loans in your locations.')).toBeInTheDocument();
    const sent = posts(spy);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toContain('/api/custodian/loans/5/return');
    expect(JSON.parse(String((sent[0][1] as RequestInit).body))).toEqual({ needsMaintenance: true });
  });

  it('a 409 shows the server message and reloads the list', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { loans: [loan()] }));
    const user = userEvent.setup();
    render(<CustodianLoansPage />);
    await screen.findByText('LAP-001');

    await user.click(screen.getByRole('button', { name: 'Return' }));
    spy.mockResolvedValueOnce(json(409, { error: { code: 'LOAN_NOT_ACTIVE', message: 'This loan has already been returned.' } }));
    spy.mockResolvedValue(json(200, { loans: [] }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record return' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This loan has already been returned.');
    expect(await screen.findByText('No active loans in your locations.')).toBeInTheDocument();
  });
});
