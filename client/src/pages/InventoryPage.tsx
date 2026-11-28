import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../api/client';

// F-10 Inventory management (/custodian/inventory): items in the custodian's locations, add, edit,
// and status changes Available <-> Maintenance, either -> Retired (FR-13, FR-14, BR-13).

type InvStatus = 'AVAILABLE' | 'RESERVED' | 'ON_LOAN' | 'MAINTENANCE' | 'RETIRED';
interface Ref {
  id: number;
  name: string;
}
interface Loc extends Ref {
  code: string;
}
export interface InventoryItem {
  id: number;
  assetTag: string;
  name: string;
  description: string | null;
  status: InvStatus;
  category: Ref;
  location: Loc;
}

const STATUS: Record<InvStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Available', className: 'text-bg-success' },
  RESERVED: { label: 'Reserved', className: 'text-bg-warning' },
  ON_LOAN: { label: 'On Loan', className: 'text-bg-primary' },
  MAINTENANCE: { label: 'Maintenance', className: 'text-bg-secondary' },
  RETIRED: { label: 'Retired', className: 'text-bg-dark' },
};

const ASSET_TAG = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
type Fields = 'assetTag' | 'name' | 'categoryId' | 'locationId' | 'description';
type FormState = { mode: 'add' | 'edit'; id?: number; assetTag: string; name: string; categoryId: string; locationId: string; description: string };

export function validateItemForm(f: FormState): Partial<Record<Fields, string>> {
  const e: Partial<Record<Fields, string>> = {};
  const tag = f.assetTag.trim();
  if (f.mode === 'add') {
    if (tag.length < 3 || tag.length > 20) e.assetTag = 'Asset tag must be 3–20 characters.';
    else if (!ASSET_TAG.test(tag)) e.assetTag = 'Use upper-case letters, digits and single hyphens, e.g. LAP-010.';
  }
  const name = f.name.trim();
  if (name.length < 2 || name.length > 100) e.name = 'Name must be 2–100 characters.';
  if (!f.categoryId) e.categoryId = 'Choose a category.';
  if (!f.locationId) e.locationId = 'Choose a location.';
  if (f.description.trim().length > 500) e.description = 'Description must be at most 500 characters.';
  return e;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [categories, setCategories] = useState<Ref[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<InvStatus | ''>('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [inv, cats] = await Promise.all([
        apiFetch<{ items: InventoryItem[] }>('/api/custodian/items'),
        apiFetch<{ categories: Ref[] }>('/api/categories'),
      ]);
      setItems(inv.items);
      setCategories(cats.categories ?? []);
    } catch (err) {
      setItems(null);
      setLoadError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The custodian's locations, taken from their inventory.
  const locations = useMemo(() => {
    const map = new Map<number, Loc>();
    for (const i of items ?? []) map.set(i.location.id, i.location);
    return [...map.values()];
  }, [items]);

  const shown = (items ?? []).filter((i) => !filter || i.status === filter);

  function openAdd() {
    setErrors({});
    setForm({ mode: 'add', assetTag: '', name: '', categoryId: '', locationId: locations[0] ? String(locations[0].id) : '', description: '' });
  }

  function openEdit(i: InventoryItem) {
    setErrors({});
    setForm({
      mode: 'edit',
      id: i.id,
      assetTag: i.assetTag,
      name: i.name,
      categoryId: String(i.category.id),
      locationId: String(i.location.id),
      description: i.description ?? '',
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    const found = validateItemForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = {
      ...(form.mode === 'add' ? { assetTag: form.assetTag.trim() } : {}),
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      locationId: Number(form.locationId),
      description: form.description.trim() || null,
    };
    setBusy(true);
    try {
      const res = await apiFetch<{ item: InventoryItem }>(
        form.mode === 'add' ? '/api/custodian/items' : `/api/custodian/items/${form.id}`,
        { method: form.mode === 'add' ? 'POST' : 'PATCH', body: JSON.stringify(body) },
      );
      setToast(form.mode === 'add' ? `Item ${res.item.assetTag} added.` : `Item ${res.item.assetTag} updated.`);
      setForm(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ASSET_TAG_TAKEN') setErrors({ assetTag: err.message });
      else if (err instanceof ApiError && err.status === 400 && err.details?.length) {
        const map: Partial<Record<Fields, string>> = {};
        for (const d of err.details) map[d.field as Fields] ??= d.message;
        setErrors(map);
      } else setErrors({ name: err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(i: InventoryItem, to: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED') {
    if (to === 'RETIRED' && !window.confirm(`Retire ${i.assetTag}? Retired items cannot be brought back.`)) return;
    setActionError(null);
    try {
      await apiFetch(`/api/custodian/items/${i.id}/status`, { method: 'POST', body: JSON.stringify({ status: to }) });
      setToast(`${i.assetTag} is now ${STATUS[to].label}.`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    }
    await load();
  }

  const field = (name: Fields) => ({
    className: `form-control${errors[name] ? ' is-invalid' : ''}`,
    'aria-invalid': errors[name] ? true : undefined,
  });
  const err = (name: Fields) => (errors[name] ? <div className="invalid-feedback d-block">{errors[name]}</div> : null);

  return (
    <div data-testid="page-inventory">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Inventory</h1>
          <p className="text-secondary mb-0">Items in your locations. Add items, edit them and change their status.</p>
        </div>
        {!form && (
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            Add item
          </button>
        )}
      </div>

      {toast && (
        <div className="alert alert-success d-flex justify-content-between" role="status">
          <span>{toast}</span>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setToast(null)} />
        </div>
      )}
      {actionError && (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      )}
      {loadError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {form && (
        <form
          className="card card-body mb-4"
          aria-label={form.mode === 'add' ? 'Add item' : 'Edit item'}
          onSubmit={(e) => void save(e)}
          noValidate
        >
          <h2 className="h5">{form.mode === 'add' ? 'Add item' : `Edit ${form.assetTag}`}</h2>
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label htmlFor="inv-tag" className="form-label">
                Asset tag <span className="text-danger">*</span>
              </label>
              <input
                id="inv-tag"
                {...field('assetTag')}
                value={form.assetTag}
                disabled={form.mode === 'edit'}
                onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
              />
              {err('assetTag')}
            </div>
            <div className="col-12 col-md-8">
              <label htmlFor="inv-name" className="form-label">
                Name <span className="text-danger">*</span>
              </label>
              <input id="inv-name" {...field('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {err('name')}
            </div>
            <div className="col-12 col-md-6">
              <label htmlFor="inv-category" className="form-label">
                Category <span className="text-danger">*</span>
              </label>
              <select
                id="inv-category"
                className={`form-select${errors.categoryId ? ' is-invalid' : ''}`}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err('categoryId')}
            </div>
            <div className="col-12 col-md-6">
              <label htmlFor="inv-location" className="form-label">
                Location <span className="text-danger">*</span>
              </label>
              <select
                id="inv-location"
                className={`form-select${errors.locationId ? ' is-invalid' : ''}`}
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                <option value="">Choose…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {err('locationId')}
            </div>
            <div className="col-12">
              <label htmlFor="inv-description" className="form-label">
                Description
              </label>
              <textarea
                id="inv-description"
                rows={2}
                {...field('description')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {err('description')}
            </div>
          </div>
          <div className="d-flex gap-2 mt-3">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save item'}
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!loadError && items === null && <p role="status">Loading inventory…</p>}

      {items && (
        <div className="d-flex align-items-center gap-2 mb-2">
          <label htmlFor="inv-filter" className="form-label mb-0 small text-secondary">
            Show
          </label>
          <select
            id="inv-filter"
            className="form-select form-select-sm w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as InvStatus | '')}
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS) as InvStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
          <span className="small text-secondary">{shown.length} items</span>
        </div>
      )}

      {items && shown.length === 0 && <p className="text-secondary">No items to show.</p>}

      {items && shown.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle table-cards">
            <thead>
              <tr>
                <th>Asset tag</th>
                <th>Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id}>
                  <td data-label="Asset tag" className="font-monospace fw-semibold">
                    {i.assetTag}
                  </td>
                  <td data-label="Name">{i.name}</td>
                  <td data-label="Category">{i.category.name}</td>
                  <td data-label="Location">{i.location.code}</td>
                  <td data-label="Status">
                    <span className={`badge status-badge ${STATUS[i.status].className}`}>{STATUS[i.status].label}</span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex flex-wrap gap-2 justify-content-end">
                      {i.status !== 'RETIRED' && (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(i)}>
                          Edit
                        </button>
                      )}
                      {i.status === 'AVAILABLE' && (
                        <button type="button" className="btn btn-outline-warning btn-sm" onClick={() => void changeStatus(i, 'MAINTENANCE')}>
                          Set to Maintenance
                        </button>
                      )}
                      {i.status === 'MAINTENANCE' && (
                        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => void changeStatus(i, 'AVAILABLE')}>
                          Set to Available
                        </button>
                      )}
                      {(i.status === 'AVAILABLE' || i.status === 'MAINTENANCE') && (
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void changeStatus(i, 'RETIRED')}>
                          Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
