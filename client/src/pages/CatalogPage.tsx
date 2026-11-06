import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCatalog, type CatalogItem, type ItemStatus } from '../api/items';
import { useAuth } from '../auth/AuthContext';
import StatusBadge, { statusLabel } from '../components/StatusBadge';

// F-03 Equipment Catalog (contract docs/sprints/sprint-1/F-03-catalog.md).
// Borrowers can request Available items; other statuses show a disabled button.
// Custodians see the catalog without Request controls. The server enforces all rules.

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; items: CatalogItem[] };

const FILTERS: Array<{ value: ItemStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'ON_LOAN', label: 'On Loan' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

function RequestControl({ item }: { item: CatalogItem }) {
  const label = `Request ${item.assetTag}`;
  if (item.status === 'AVAILABLE') {
    return (
      <Link to={`/catalog/${item.id}/request`} className="btn btn-sm btn-primary" aria-label={label}>
        Request
      </Link>
    );
  }
  return (
    <button type="button" className="btn btn-sm btn-outline-secondary" disabled aria-label={label} title={statusLabel(item.status)}>
      Request
    </button>
  );
}

export default function CatalogPage() {
  const { user } = useAuth();
  const isBorrower = user?.role === 'BORROWER';
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async (filter: ItemStatus | '') => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'loaded', items: await fetchCatalog(filter) });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'An unexpected error occurred.' });
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  return (
    <div data-testid="page-catalog">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <h1 className="h3 mb-0">Catalog</h1>
        <div>
          <label htmlFor="status-filter" className="form-label mb-1 small">
            Status
          </label>
          <select
            id="status-filter"
            className="form-select form-select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ItemStatus | '')}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="d-flex align-items-center gap-2 py-4" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Loading catalog…</span>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void load(status)}>
            Retry
          </button>
        </div>
      )}

      {state.kind === 'loaded' && state.items.length === 0 && (
        <p className="text-secondary py-4">No items match this filter.</p>
      )}

      {state.kind === 'loaded' && state.items.length > 0 && (
        <div className="catalog-list">
          <div className="catalog-head d-none d-sm-grid text-secondary small fw-semibold border-bottom pb-2">
            <span>Asset tag</span>
            <span>Item</span>
            <span>Category</span>
            <span>Location</span>
            <span>Status</span>
            {isBorrower && <span className="visually-hidden">Action</span>}
          </div>
          {state.items.map((item) => (
            <div key={item.id} data-testid="catalog-item" className="catalog-row border-bottom py-2">
              <span className="fw-semibold font-monospace">{item.assetTag}</span>
              <span>{item.name}</span>
              <span className="text-secondary">{item.category.name}</span>
              <span className="text-secondary">{item.location.name}</span>
              <span>
                <StatusBadge status={item.status} />
              </span>
              {isBorrower && (
                <span className="text-sm-end">
                  <RequestControl item={item} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
