import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../api/client';

interface QueueRow {
  id: number;
  purpose: string;
  requestedDays: number;
  createdAt: string;
  borrower: { id: number; name: string; email: string };
  item: { id: number; assetTag: string; name: string; location: { code: string } };
}

interface LoanResult {
  loan: { dueAt: string };
}

// Dates are shown in Bangkok time (SDS section 3).
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const formatDate = (d: Date) => dateFormat.format(d);
const formatDateTime = (d: Date) => dateTimeFormat.format(d).replace(',', '');

// F-05: pending requests for the custodian's locations, with a confirm step before checkout.
export default function CustodianRequestsPage() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<QueueRow | null>(null);
  const [busy, setBusy] = useState(false);
  // F-06: reject dialog state (reason is checked here and again by the server, BR-09).
  const [rejecting, setRejecting] = useState<QueueRow | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const inFlight = useRef(false); // synchronous guard: a double click must not send two checkouts

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch<{ requests: QueueRow[] }>('/api/custodian/requests');
      setRows(res.requests);
    } catch (err) {
      setRows(null);
      setLoadError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmCheckout() {
    if (!confirming || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const { loan } = await apiFetch<LoanResult>(`/api/custodian/requests/${confirming.id}/checkout`, { method: 'POST' });
      setToast(`Checked out — due ${formatDate(new Date(loan.dueAt))}`);
      setConfirming(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
      setConfirming(null);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    await load(); // the row leaves the queue; on a 409 the queue is refreshed to the real state
  }

  function openReject(row: QueueRow) {
    setReason('');
    setReasonError(null);
    setRejecting(row);
  }

  async function confirmReject() {
    if (!rejecting || inFlight.current) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5 || trimmed.length > 200) {
      setReasonError('Reason must be 5–200 characters.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    let reload = true;
    try {
      await apiFetch(`/api/custodian/requests/${rejecting.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: trimmed }),
      });
      setToast(`Request rejected — ${rejecting.item.assetTag} is available again.`);
      setRejecting(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setReasonError(err.details?.[0]?.message ?? err.message);
        reload = false;
      } else {
        setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
        setRejecting(null);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    if (reload) await load();
  }

  const dueFor = (row: QueueRow) => formatDateTime(new Date(Date.now() + row.requestedDays * 86_400_000));

  return (
    <div data-testid="page-custodian-requests">
      <h1 className="h3 mb-3">Requests</h1>

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

      {!loadError && rows === null && <p role="status">Loading requests…</p>}

      {rows && rows.length === 0 && <p className="text-secondary">No pending requests for your locations.</p>}

      {rows && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Requested on</th>
                <th>Borrower</th>
                <th>Asset tag</th>
                <th>Item</th>
                <th>Purpose</th>
                <th>Days</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(new Date(row.createdAt))}</td>
                  <td>{row.borrower.name}</td>
                  <td>{row.item.assetTag}</td>
                  <td>{row.item.name}</td>
                  <td>{row.purpose}</td>
                  <td>{row.requestedDays}</td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(row)}>
                        Check out
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => openReject(row)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="reject-title">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id="reject-title">
                    Reject request
                  </h2>
                </div>
                <div className="modal-body">
                  <p>
                    Reject the request for {rejecting.item.assetTag} by {rejecting.borrower.name}?
                  </p>
                  <label htmlFor="reject-reason" className="form-label">
                    Reason <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="reject-reason"
                    className={`form-control${reasonError ? ' is-invalid' : ''}`}
                    rows={3}
                    maxLength={200}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setReasonError(null);
                    }}
                    aria-describedby="reject-reason-help"
                  />
                  {reasonError && <div className="invalid-feedback d-block">{reasonError}</div>}
                  <div id="reject-reason-help" className="form-text d-flex justify-content-between">
                    <span>The borrower sees this reason (5–200 characters).</span>
                    <span>{reason.trim().length}/200</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setRejecting(null)}>
                    Back
                  </button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirmReject()}>
                    {busy ? 'Rejecting…' : 'Reject request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}

      {confirming && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id="confirm-title">
                    Confirm checkout
                  </h2>
                </div>
                <div className="modal-body">
                  <p className="mb-1">
                    Hand over {confirming.item.assetTag} to {confirming.borrower.name} for {confirming.requestedDays} days?
                  </p>
                  <p className="mb-0 text-secondary">Due: {dueFor(confirming)}</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmCheckout()}>
                    {busy ? 'Checking out…' : 'Confirm'}
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
