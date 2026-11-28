// F-04 request form (TEST-04-12 / AC-04-07): field validation, 409 handling, success redirect.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { validateRequestForm } from './RequestPage';

const borrower = { id: 3, email: 'borrower1@lendlab.test', name: 'Borrower One', role: 'BORROWER', locationIds: [] };
const lap1 = {
  id: 1,
  assetTag: 'LAP-001',
  name: 'Dell Latitude 5440',
  description: '14-inch laptop',
  category: { id: 2, name: 'Laptop', maxLoanDays: 7 },
  location: { id: 1, code: 'HW-LAB', name: 'CPE Hardware Lab' },
  status: 'AVAILABLE',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

type Handler = (init?: RequestInit) => Response | Promise<Response>;

function mockApi(handlers: { item?: Handler; create?: Handler; mine?: Handler }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) return json(200, { user: borrower });
    if (/\/api\/items\/\d+$/.test(url)) return (handlers.item ?? (() => json(200, { item: lap1 })))(init);
    if (url.endsWith('/api/requests') && init?.method === 'POST') return handlers.create!(init);
    if (url.endsWith('/api/requests/mine')) return (handlers.mine ?? (() => json(200, { requests: [] })))(init);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
}

function renderAt(path: string) {
  sessionStorage.setItem('lendlab.token', 'tok');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const createCalls = (spy: ReturnType<typeof mockApi>) =>
  spy.mock.calls.filter(([u, init]) => String(u).endsWith('/api/requests') && init?.method === 'POST');

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('request form', () => {
  it('shows the item summary, a purpose field and a loan length defaulting to 7 days', async () => {
    mockApi({});
    renderAt('/catalog/1/request');

    expect(await screen.findByText('LAP-001')).toBeInTheDocument();
    expect(screen.getByText('Dell Latitude 5440')).toBeInTheDocument();
    expect(screen.getByText('CPE Hardware Lab')).toBeInTheDocument();
    expect(screen.getByLabelText(/Purpose/)).toHaveValue('');
    expect(screen.getByLabelText(/Loan length/)).toHaveValue(7);
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('empty purpose shows an inline error and sends nothing (TEST-04-12)', async () => {
    const spy = mockApi({ create: () => json(201, {}) });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Purpose must be at least 5 characters.')).toBeInTheDocument();
    expect(createCalls(spy)).toHaveLength(0);
  });

  // Lab 6 Part D regression test (BR-14, AC-04-04): a 4-character purpose was accepted.
  it('a 4-character purpose shows the minimum-length error and sends nothing (Lab 6 UAT)', async () => {
    const spy = mockApi({ create: () => json(201, {}) });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'abcd');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Purpose must be at least 5 characters.')).toBeInTheDocument();
    expect(createCalls(spy)).toHaveLength(0);
  });

  it('a loan length of 15 shows an inline error and sends nothing', async () => {
    const spy = mockApi({ create: () => json(201, {}) });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.clear(screen.getByLabelText(/Loan length/));
    await user.type(screen.getByLabelText(/Loan length/), '15');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    // F-04 v0.3 (CHG-01): the Laptop maximum is 7 days, so the message names the category.
    expect(await screen.findByText('Loan length for Laptop items must be 1–7 days.')).toBeInTheDocument();
    expect(createCalls(spy)).toHaveLength(0);
  });

  it('a 409 answer shows "no longer available" with a link back to the catalog (TEST-04-12)', async () => {
    mockApi({
      create: () =>
        json(409, { error: { code: 'ITEM_NOT_AVAILABLE', message: 'This item is not available to request.' } }),
    });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText(/This item is no longer available\. Please choose another item\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the catalog' })).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled();
  });

  it('shows server field errors from a 400 under the matching field', async () => {
    mockApi({
      create: () =>
        json(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request is invalid.',
            details: [{ field: 'purpose', message: 'Purpose must be at most 200 characters.' }],
          },
        }),
    });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Purpose must be at most 200 characters.')).toBeInTheDocument();
  });

  it('sends the trimmed purpose and days, then shows My Borrowing with a success message', async () => {
    const created = {
      id: 12,
      status: 'PENDING',
      purpose: 'Lab assignment',
      requestedDays: 3,
      createdAt: '2026-11-07T03:15:00.000Z',
      item: { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', status: 'RESERVED' },
      loan: null,
    };
    const spy = mockApi({
      create: () => json(201, { request: created }),
      mine: () => json(200, { requests: [created] }),
    });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), '  Lab assignment  ');
    await user.clear(screen.getByLabelText(/Loan length/));
    await user.type(screen.getByLabelText(/Loan length/), '3');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Request submitted for LAP-001.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Borrowing' })).toBeInTheDocument();
    const body = JSON.parse(String(createCalls(spy)[0][1]?.body));
    expect(body).toEqual({ itemId: 1, purpose: 'Lab assignment', requestedDays: 3 });
  });

  it('does not offer the form for an item that is not Available', async () => {
    mockApi({ item: () => json(200, { item: { ...lap1, status: 'RESERVED' } }) });
    renderAt('/catalog/1/request');

    expect(await screen.findByText(/This item is no longer available/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
  });

  it('shows "not found" for an unknown item', async () => {
    mockApi({ item: () => json(404, { error: { code: 'ITEM_NOT_FOUND', message: 'The requested item was not found.' } }) });
    renderAt('/catalog/99999/request');

    expect(await screen.findByText('The requested item was not found.')).toBeInTheDocument();
  });

  it('disables the submit button while saving', async () => {
    let release: (r: Response) => void = () => {};
    mockApi({ create: () => new Promise<Response>((resolve) => (release = resolve)) });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByRole('button', { name: 'Submitting…' })).toBeDisabled();
    release(json(409, { error: { code: 'ITEM_NOT_AVAILABLE', message: 'x' } }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Submitting…' })).not.toBeInTheDocument());
  });
});

// CHG-01 (Issue #50), TEST-04-17 / AC-04-09: the form shows and enforces the category maximum.
describe('per-category maximum loan length in the form (CHG-01)', () => {
  it('laptop form shows max 7 and blocks 8', async () => {
    const spy = mockApi({ create: () => json(201, {}) });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    const days = screen.getByLabelText(/Loan length/);
    // #56: the label text is exactly the F-04 v0.3 contract wording.
    expect(screen.getByLabelText('Loan length (days, max 7) *')).toBe(days);
    expect(days).toHaveAttribute('max', '7');
    expect(days).toHaveValue(7);

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.clear(days);
    await user.type(days, '8');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Loan length for Laptop items must be 1–7 days.')).toBeInTheDocument();
    expect(createCalls(spy)).toHaveLength(0);
  });

  it('camera form defaults to 3 and blocks 4', async () => {
    const cam1 = { ...lap1, id: 7, assetTag: 'CAM-001', name: 'Canon EOS M50', category: { id: 1, name: 'Camera', maxLoanDays: 3 } };
    const spy = mockApi({ item: () => json(200, { item: cam1 }), create: () => json(201, {}) });
    renderAt('/catalog/7/request');
    await screen.findByText('CAM-001');
    const user = userEvent.setup();

    const days = screen.getByLabelText(/Loan length/);
    expect(screen.getByLabelText('Loan length (days, max 3) *')).toBe(days);
    expect(days).toHaveValue(3);

    await user.type(screen.getByLabelText(/Purpose/), 'Event video shoot');
    await user.clear(days);
    await user.type(days, '4');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Loan length for Camera items must be 1–3 days.')).toBeInTheDocument();
    expect(createCalls(spy)).toHaveLength(0);
  });

  it.each([
    ['7', 7, 'Laptop', {}],
    ['8', 7, 'Laptop', { requestedDays: 'Loan length for Laptop items must be 1–7 days.' }],
    ['3', 3, 'Camera', {}],
    ['4', 3, 'Camera', { requestedDays: 'Loan length for Camera items must be 1–3 days.' }],
  ])('validateRequestForm days %j with max %i (%s)', (days, max, name, expected) => {
    expect(validateRequestForm('abcde', days, { name, maxLoanDays: max })).toEqual(expected);
  });
});

describe('validateRequestForm (mirrors BR-04 and BR-14)', () => {
  it.each([
    ['abcde', '7', {}],
    ['abcd', '7', { purpose: 'Purpose must be at least 5 characters.' }],
    ['   abcd   ', '7', { purpose: 'Purpose must be at least 5 characters.' }],
    ['a'.repeat(201), '7', { purpose: 'Purpose must be at most 200 characters.' }],
    ['abcde', '0', { requestedDays: 'Loan length must be 1–14 days.' }],
    ['abcde', '14', {}],
    ['abcde', '2.5', { requestedDays: 'Loan length must be a whole number of days.' }],
    ['abcde', '', { requestedDays: 'Loan length must be a whole number of days.' }],
  ])('purpose %j, days %j', (purpose, days, expected) => {
    expect(validateRequestForm(purpose, days)).toEqual(expected);
  });
});

// F-08 (Sprint 2), TEST-08-06 / AC-08-06: a 409 OVERDUE_LOAN shows the server message, not "no longer available".
describe('borrower rule refusals (F-08)', () => {
  it('shows the overdue message from the server and keeps the form', async () => {
    mockApi({
      create: () =>
        json(409, {
          error: { code: 'OVERDUE_LOAN', message: 'You have an overdue loan. Return it before requesting another item.' },
        }),
    });
    renderAt('/catalog/1/request');
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Purpose/), 'Lab assignment');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText(/You have an overdue loan\. Return it before requesting another item\./)).toBeInTheDocument();
    expect(screen.queryByText(/no longer available/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Borrowing' })).toHaveAttribute('href', '/my');
    expect(screen.getByLabelText(/Purpose/)).toHaveValue('Lab assignment');
  });
});
