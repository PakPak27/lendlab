// F-10 (Sprint 2), TEST-10-09 / AC-10-08: inventory list, add item with server errors, status change.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryPage from './InventoryPage';

const hw = { id: 1, code: 'HW-LAB', name: 'CPE Hardware Lab' };
const laptop = { id: 2, name: 'Laptop' };
const items = [
  { id: 1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', description: null, status: 'AVAILABLE', category: laptop, location: hw },
  { id: 6, assetTag: 'ARD-003', name: 'ESP32 DevKit Set', description: null, status: 'MAINTENANCE', category: { id: 3, name: 'Microcontroller Kit' }, location: hw },
  { id: 2, assetTag: 'LAP-002', name: 'Dell Latitude 5440', description: null, status: 'ON_LOAN', category: laptop, location: hw },
  { id: 9, assetTag: 'LAP-009', name: 'Old laptop', description: null, status: 'RETIRED', category: laptop, location: hw },
];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

type Handler = (init?: RequestInit) => Response;
function mockApi(handlers: { create?: Handler; status?: Handler } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/categories')) return json(200, { categories: [laptop, { id: 3, name: 'Microcontroller Kit' }] });
    if (url.endsWith('/api/custodian/items') && init?.method === 'POST') return handlers.create!(init);
    if (/\/api\/custodian\/items\/\d+\/status$/.test(url)) return handlers.status!(init);
    if (url.endsWith('/api/custodian/items')) return json(200, { items });
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
}
const posts = (spy: { mock: { calls: Array<[unknown, unknown?]> } }) =>
  spy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

beforeEach(() => sessionStorage.setItem('lendlab.token', 'tok'));
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('InventoryPage (F-10)', () => {
  it('lists every item with its status and only the allowed status buttons', async () => {
    mockApi();
    render(<InventoryPage />);

    const table = await screen.findByRole('table');
    const row = (tag: string) => within(within(table).getByText(tag).closest('tr') as HTMLElement);
    expect(row('LAP-001').getByRole('button', { name: 'Set to Maintenance' })).toBeInTheDocument();
    expect(row('LAP-001').getByRole('button', { name: 'Retire' })).toBeInTheDocument();
    expect(row('ARD-003').getByRole('button', { name: 'Set to Available' })).toBeInTheDocument();
    expect(row('LAP-002').queryByRole('button', { name: /Set to|Retire/ })).not.toBeInTheDocument();
    expect(row('LAP-009').getByText('Retired')).toBeInTheDocument();
    expect(row('LAP-009').queryByRole('button', { name: /Set to|Retire|Edit/ })).not.toBeInTheDocument();
  });

  it('adds an item and shows server errors under the fields', async () => {
    let attempt = 0;
    const spy = mockApi({
      create: () => {
        attempt += 1;
        if (attempt === 1) return json(409, { error: { code: 'ASSET_TAG_TAKEN', message: 'This asset tag is already used.' } });
        return json(201, { item: { ...items[0], id: 20, assetTag: 'LAP-010', name: 'Dell Latitude 7450' } });
      },
    });
    const user = userEvent.setup();
    render(<InventoryPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const form = screen.getByRole('form', { name: 'Add item' });
    await user.type(within(form).getByLabelText(/Asset tag/), 'LAP-001');
    await user.type(within(form).getByLabelText(/Name/), 'Dell Latitude 7450');
    await user.selectOptions(within(form).getByLabelText(/Category/), 'Laptop');
    await user.click(within(form).getByRole('button', { name: 'Save item' }));

    expect(await within(form).findByText('This asset tag is already used.')).toBeInTheDocument();

    await user.clear(within(form).getByLabelText(/Asset tag/));
    await user.type(within(form).getByLabelText(/Asset tag/), 'LAP-010');
    await user.click(within(form).getByRole('button', { name: 'Save item' }));

    expect(await screen.findByText('Item LAP-010 added.')).toBeInTheDocument();
    const sent = posts(spy).filter(([u]) => String(u).endsWith('/api/custodian/items'));
    expect(sent).toHaveLength(2);
    expect(JSON.parse(String((sent[1][1] as RequestInit).body))).toMatchObject({
      assetTag: 'LAP-010',
      name: 'Dell Latitude 7450',
      categoryId: 2,
      locationId: 1,
    });
  });

  it('blocks an invalid asset tag in the form without calling the API', async () => {
    const spy = mockApi({ create: () => json(201, {}) });
    const user = userEvent.setup();
    render(<InventoryPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const form = screen.getByRole('form', { name: 'Add item' });
    await user.type(within(form).getByLabelText(/Asset tag/), 'lap 1');
    await user.type(within(form).getByLabelText(/Name/), 'Spare');
    await user.click(within(form).getByRole('button', { name: 'Save item' }));

    expect(await within(form).findByText('Use upper-case letters, digits and single hyphens, e.g. LAP-010.')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(0);
  });

  it('sets an item to Maintenance and shows a toast', async () => {
    const spy = mockApi({ status: () => json(200, { item: { ...items[0], status: 'MAINTENANCE' } }) });
    const user = userEvent.setup();
    render(<InventoryPage />);
    const table = await screen.findByRole('table');

    await user.click(within(within(table).getByText('LAP-001').closest('tr') as HTMLElement).getByRole('button', { name: 'Set to Maintenance' }));

    expect(await screen.findByText('LAP-001 is now Maintenance.')).toBeInTheDocument();
    const sent = posts(spy);
    expect(String(sent[0][0])).toContain('/api/custodian/items/1/status');
    expect(JSON.parse(String((sent[0][1] as RequestInit).body))).toEqual({ status: 'MAINTENANCE' });
  });
});
