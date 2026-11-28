// F-05 UI behavior (AC-05-07): queue states, confirm modal, success toast, 409 handling.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustodianRequestsPage from './CustodianRequestsPage';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 12,
  status: 'PENDING',
  purpose: 'Embedded systems lab assignment 3',
  requestedDays: 7,
  createdAt: '2026-11-07T03:15:00.000Z',
  borrower: { id: 3, name: 'Borrower One', email: 'borrower1@lendlab.test' },
  item: { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', location: { code: 'HW-LAB' } },
  ...over,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => sessionStorage.setItem('lendlab.token', 'tok'));
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('CustodianRequestsPage states', () => {
  it('shows a loading message while the queue loads', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<CustodianRequestsPage />);
    expect(screen.getByText('Loading requests…')).toBeInTheDocument();
  });

  it('shows the empty message when nothing is pending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { requests: [] }));
    render(<CustodianRequestsPage />);
    expect(await screen.findByText('No pending requests for your locations.')).toBeInTheDocument();
  });

  it('shows an error alert with Retry, and Retry reloads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<CustodianRequestsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server. Try again.');

    fetchSpy.mockResolvedValue(json(200, { requests: [row()] }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('LAP-001')).toBeInTheDocument();
  });

  it('lists borrower, asset tag, item, purpose, days and a Check out button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { requests: [row()] }));
    render(<CustodianRequestsPage />);

    const table = await screen.findByRole('table');
    const cells = within(table);
    expect(cells.getByText('Borrower One')).toBeInTheDocument();
    expect(cells.getByText('LAP-001')).toBeInTheDocument();
    expect(cells.getByText('Dell Latitude 5440')).toBeInTheDocument();
    expect(cells.getByText('Embedded systems lab assignment 3')).toBeInTheDocument();
    expect(cells.getByText('7')).toBeInTheDocument();
    expect(cells.getByRole('button', { name: 'Check out' })).toBeInTheDocument();
  });
});

describe('checkout flow', () => {
  async function openConfirm() {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { requests: [row()] }));
    render(<CustodianRequestsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Check out' }));
    return { user, fetchSpy };
  }

  it('asks for confirmation with asset tag, borrower, days and a due date', async () => {
    await openConfirm();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Hand over LAP-001 to Borrower One for 7 days?');
    expect(dialog).toHaveTextContent(/Due: \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}/);
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('Cancel closes the dialog without calling the API', async () => {
    const { user, fetchSpy } = await openConfirm();
    const callsBefore = fetchSpy.mock.calls.length;
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);
  });

  it('Confirm checks out, removes the row and shows a success toast with the due date', async () => {
    const { user, fetchSpy } = await openConfirm();
    fetchSpy.mockResolvedValueOnce(
      json(201, {
        loan: {
          id: 5, status: 'ACTIVE', requestId: 12,
          checkedOutAt: '2026-11-07T03:20:00.000Z', dueAt: '2026-11-14T03:20:00.000Z',
          item: { id: 1, assetTag: 'LAP-001', status: 'ON_LOAN' }, borrower: { id: 3, name: 'Borrower One' },
        },
      }),
    );
    fetchSpy.mockResolvedValue(json(200, { requests: [] }));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Checked out — due 14 Nov 2026');
    await waitFor(() => expect(screen.queryByText('LAP-001')).not.toBeInTheDocument());
    const post = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(String(post![0])).toBe('/api/custodian/requests/12/checkout');
  });

  it('a 409 shows the server message in a red alert and reloads the queue', async () => {
    const { user, fetchSpy } = await openConfirm();
    fetchSpy.mockResolvedValueOnce(
      json(409, { error: { code: 'REQUEST_NOT_PENDING', message: 'This request is no longer pending.' } }),
    );
    fetchSpy.mockResolvedValue(json(200, { requests: [] }));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This request is no longer pending.');
    expect(await screen.findByText('No pending requests for your locations.')).toBeInTheDocument();
  });

  it('ignores a second click on Confirm while the first is in flight', async () => {
    const { user, fetchSpy } = await openConfirm();
    fetchSpy.mockReturnValue(new Promise(() => {}));
    const confirm = within(await screen.findByRole('dialog')).getByRole('button', { name: /Confirm|Checking out/ });
    await user.dblClick(confirm);

    const posts = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(posts).toHaveLength(1);
  });
});

// F-06 (Sprint 2), TEST-06-08 / AC-06-07: reject a pending request with a reason.
describe('reject a request (F-06)', () => {
  async function openReject() {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { requests: [row()] }));
    const user = userEvent.setup();
    render(<CustodianRequestsPage />);
    await screen.findByText('LAP-001');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    return { user, fetchSpy };
  }
  const posts = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

  it('blocks a reason shorter than 5 characters without calling the API', async () => {
    const { user, fetchSpy } = await openReject();
    expect(screen.getByRole('dialog', { name: 'Reject request' })).toHaveTextContent('LAP-001');

    await user.type(screen.getByLabelText(/Reason/), 'abcd');
    await user.click(screen.getByRole('button', { name: 'Reject request' }));

    expect(await screen.findByText('Reason must be 5–200 characters.')).toBeInTheDocument();
    expect(posts(fetchSpy)).toHaveLength(0);
  });

  it('sends the reason once, removes the row and shows a toast', async () => {
    const { user, fetchSpy } = await openReject();
    await user.type(screen.getByLabelText(/Reason/), 'Booked for a class');
    fetchSpy.mockResolvedValueOnce(
      json(200, { request: { id: 12, status: 'REJECTED', decisionNote: 'Booked for a class', item: { id: 1, assetTag: 'LAP-001', status: 'AVAILABLE' } } }),
    );
    fetchSpy.mockResolvedValue(json(200, { requests: [] }));

    await user.click(screen.getByRole('button', { name: 'Reject request' }));

    expect(await screen.findByText('Request rejected — LAP-001 is available again.')).toBeInTheDocument();
    expect(await screen.findByText('No pending requests for your locations.')).toBeInTheDocument();
    const sent = posts(fetchSpy);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toContain('/api/custodian/requests/12/reject');
    expect(JSON.parse(String((sent[0][1] as RequestInit).body))).toEqual({ reason: 'Booked for a class' });
  });
});

