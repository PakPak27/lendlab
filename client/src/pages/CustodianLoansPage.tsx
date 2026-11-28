import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../api/client';
import { formatDateTime } from '../lib/format';

// F-07 Active loans and returns (/custodian/loans): active loans in the custodian's locations,
// soonest due first, and recording a return with an optional "needs maintenance" (FR-11, FR-19, BR-10).

export interface ActiveLoan {
  id: number;
  status: 'ACTIVE';
  checkedOutAt: string;
  dueAt: string;
  isOverdue?: boolean; // F-08
  item: { id: number; assetTag: string; name: string; location: { code: string } };
  borrower: { id: number; name: string; email: string };
}

interface ReturnResult {
  loan: { id: number; item: { assetTag: string; status: string } };
}

const when = (iso: string) => formatDateTime(iso).replace(',', '');

export default function CustodianLoansPage() {
  const [rows, setRows] = useState<ActiveLoan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [returning, setReturning] = useState<ActiveLoan | null>(null);
  const [needsMaintenance, setNeedsMaintenance] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // a double click must not send two returns

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch<{ loans: ActiveLoan[] }>('/api/custodian/loans');
      setRows(res.loans);
    } catch (err) {
      setRows(null);
      setLoadError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openReturn(row: ActiveLoan) {
    setNeedsMaintenance(false);
    setReturning(row);
  }

  async function confirmReturn() {
    if (!returning || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const { loan } = await apiFetch<ReturnResult>(`/api/custodian/loans/${returning.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ needsMaintenance }),
      });
      const where = loan.item.status === 'MAINTENANCE' ? 'in Maintenance' : 'Available';
      setToast(`Return recorded — ${loan.item.assetTag} is ${where}.`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      setReturning(null);
    }
    await load(); // the row leaves the list; on a 409 the list shows the real state
  }

  return (
    <div data-testid="page-custodian-loans">
      <h1 className="h3 mb-1">Loans</h1>
      <p className="text-secondary mb-3">Active loans in your locations, soonest due first.</p>

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

      {!loadError && rows === null && <p role="status">Loading loans…</p>}
      {rows && rows.length === 0 && <p className="text-secondary">No active loans in your locations.</p>}

      {rows && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle table-cards">
            <thead>
              <tr>
                <th>Asset tag</th>
                <th>Item</th>
                <th>Borrower</th>
                <th>Checked out</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isOverdue ? 'table-danger' : undefined}>
                  <td data-label="Asset tag" className="font-monospace fw-semibold">
                    {row.item.assetTag}
                  </td>
                  <td data-label="Item">{row.item.name}</td>
                  <td data-label="Borrower">{row.borrower.name}</td>
                  <td data-label="Checked out">{when(row.checkedOutAt)}</td>
                  <td data-label="Due">
                    <span className={row.isOverdue ? 'text-danger fw-semibold' : undefined}>{when(row.dueAt)}</span>
                    {row.isOverdue && <span className="badge text-bg-danger ms-2">Overdue</span>}
                  </td>
                  <td className="text-end">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openReturn(row)}>
                      Return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {returning && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="return-title">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id="return-title">
                    Record return
                  </h2>
                </div>
                <div className="modal-body">
                  <p>
                    Record the return of {returning.item.assetTag} from {returning.borrower.name}?
                  </p>
                  <div className="form-check">
                    <input
                      id="needs-maintenance"
                      type="checkbox"
                      className="form-check-input"
                      checked={needsMaintenance}
                      onChange={(e) => setNeedsMaintenance(e.target.checked)}
                    />
                    <label htmlFor="needs-maintenance" className="form-check-label">
                      Needs maintenance
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setReturning(null)}>
                    Back
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmReturn()}>
                    {busy ? 'Recording…' : 'Record return'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
}
