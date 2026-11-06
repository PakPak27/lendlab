// F-03 UI behavior (AC-03-05, TEST-03-06): catalog states, status badges, Request button rules, status filter.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';

const borrower = { id: 3, email: 'borrower1@lendlab.test', name: 'Borrower One', role: 'BORROWER', locationIds: [] };
const custodian = { id: 5, email: 'custodian.hw@lendlab.test', name: 'Hardware Lab Custodian', role: 'CUSTODIAN', locationIds: [1] };

const hwLab = { id: 1, code: 'HW-LAB', name: 'CPE Hardware Lab' };
const items = [
  { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', category: { id: 2, name: 'Laptop' }, location: hwLab, status: 'AVAILABLE' },
  { id: 6, assetTag: 'ARD-003', name: 'ESP32 DevKit Set', category: { id: 3, name: 'Microcontroller Kit' }, location: hwLab, status: 'MAINTENANCE' },
  { id: 2, assetTag: 'LAP-002', name: 'Dell Latitude 5440', category: { id: 2, name: 'Laptop' }, location: hwLab, status: 'RESERVED' },
];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

type ItemsReply = () => Response | Promise<Response>;

// Answers /api/auth/me with the given user and /api/items with `itemsReply`.
function mockApi(user: typeof borrower | typeof custodian, itemsReply: ItemsReply) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) return json(200, { user });
    if (url.includes('/api/items')) return itemsReply();
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
}

function renderCatalog() {
  sessionStorage.setItem('lendlab.token', 'tok');
  return render(
    <MemoryRouter initialEntries={['/catalog']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const rowFor = (assetTag: string) => screen.getByText(assetTag).closest('[data-testid="catalog-item"]') as HTMLElement;

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('catalog states (TEST-03-06)', () => {
  it('shows "Loading catalog…" while the request is pending', async () => {
    mockApi(borrower, () => new Promise<Response>(() => {}));
    renderCatalog();
    expect(await screen.findByText('Loading catalog…')).toBeInTheDocument();
  });

  it('shows the empty message when no item matches', async () => {
    mockApi(borrower, () => json(200, { items: [] }));
    renderCatalog();
    expect(await screen.findByText('No items match this filter.')).toBeInTheDocument();
  });

  it('shows the server message and a Retry button on error, and Retry loads again', async () => {
    let calls = 0;
    mockApi(borrower, () => {
      calls += 1;
      return calls === 1
        ? json(500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
        : json(200, { items });
    });
    renderCatalog();

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('LAP-001')).toBeInTheDocument();
  });
});

describe('catalog list for a borrower (AC-03-05)', () => {
  it('shows asset tag, name, category, location and the status as text', async () => {
    mockApi(borrower, () => json(200, { items }));
    renderCatalog();

    const row = within(await waitFor(() => rowFor('LAP-001')));
    expect(row.getByText('Dell Latitude 5440')).toBeInTheDocument();
    expect(row.getByText('Laptop')).toBeInTheDocument();
    expect(row.getByText('CPE Hardware Lab')).toBeInTheDocument();
    expect(row.getByText('Available')).toBeInTheDocument();
    expect(within(rowFor('ARD-003')).getByText('Maintenance')).toBeInTheDocument();
    expect(within(rowFor('LAP-002')).getByText('Reserved')).toBeInTheDocument();
  });

  it('enables Request only for Available items and links it to the request form', async () => {
    mockApi(borrower, () => json(200, { items }));
    renderCatalog();
    await screen.findByText('LAP-001');

    const available = within(rowFor('LAP-001')).getByRole('link', { name: 'Request LAP-001' });
    expect(available).toHaveAttribute('href', '/catalog/1/request');

    for (const tag of ['ARD-003', 'LAP-002']) {
      const button = within(rowFor(tag)).getByRole('button', { name: `Request ${tag}` });
      expect(button).toBeDisabled();
    }
  });
});

describe('catalog for a custodian', () => {
  it('shows the items but no Request controls', async () => {
    mockApi(custodian, () => json(200, { items }));
    renderCatalog();

    await screen.findByText('LAP-001');
    expect(screen.queryByRole('link', { name: /^Request / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Request / })).not.toBeInTheDocument();
  });
});

describe('status filter (AC-03-02 in the UI)', () => {
  it('reloads with ?status= when a status is chosen, and without it for "All"', async () => {
    const fetchSpy = mockApi(borrower, () => json(200, { items }));
    renderCatalog();
    await screen.findByText('LAP-001');
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Status'), 'AVAILABLE');
    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([u]) => String(u).endsWith('/api/items?status=AVAILABLE'))).toBe(true),
    );

    await user.selectOptions(screen.getByLabelText('Status'), '');
    await waitFor(() => expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toMatch(/\/api\/items$/));
  });
});
