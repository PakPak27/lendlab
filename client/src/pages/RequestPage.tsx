import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { fetchItem, type CatalogItemDetail } from '../api/items';
import { createBorrowRequest } from '../api/requests';
import StatusBadge from '../components/StatusBadge';

// F-04 request form (/catalog/:id/request). Client checks mirror the server rules (BR-04, BR-14)
// for quick feedback; the server is still the authority and its 400/409 answers are shown here.

const PURPOSE_MIN = 5;
const PURPOSE_MAX = 200;
const DAYS_MIN = 1;
const DAYS_MAX = 14;

export const NOT_AVAILABLE_MESSAGE = 'This item is no longer available. Please choose another item.';

type FieldErrors = Partial<Record<'purpose' | 'requestedDays', string>>;

export function validateRequestForm(purpose: string, days: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = purpose.trim();
  if (trimmed.length < PURPOSE_MIN) errors.purpose = `Purpose must be at least ${PURPOSE_MIN} characters.`;
  else if (trimmed.length > PURPOSE_MAX) errors.purpose = `Purpose must be at most ${PURPOSE_MAX} characters.`;
  if (!/^\d+$/.test(days.trim())) errors.requestedDays = 'Loan length must be a whole number of days.';
  else {
    const n = Number(days);
    if (n < DAYS_MIN || n > DAYS_MAX) errors.requestedDays = `Loan length must be ${DAYS_MIN}–${DAYS_MAX} days.`;
  }
  return errors;
}

type ItemState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; notFound: boolean }
  | { kind: 'loaded'; item: CatalogItemDetail };

export default function RequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [itemState, setItemState] = useState<ItemState>({ kind: 'loading' });
  const [purpose, setPurpose] = useState('');
  const [days, setDays] = useState('7');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<{ message: string; notAvailable: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      setItemState({ kind: 'error', message: 'The requested item was not found.', notFound: true });
      return;
    }
    fetchItem(itemId)
      .then((item) => !cancelled && setItemState({ kind: 'loaded', item }))
      .catch((err) => {
        if (cancelled) return;
        const notFound = err instanceof ApiError && err.status === 404;
        setItemState({
          kind: 'error',
          message: notFound ? 'The requested item was not found.' : err instanceof Error ? err.message : 'Error',
          notFound,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || itemState.kind !== 'loaded') return;
    setAlert(null);
    const errors = validateRequestForm(purpose, days);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const created = await createBorrowRequest({
        itemId: itemState.item.id,
        purpose: purpose.trim(),
        requestedDays: Number(days),
      });
      navigate('/my', { state: { flash: `Request submitted for ${created.item.assetTag}.` } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.details) {
        const map: FieldErrors = {};
        for (const d of err.details) {
          if (d.field === 'purpose' || d.field === 'requestedDays') map[d.field] ??= d.message;
        }
        setFieldErrors(map);
        if (Object.keys(map).length === 0) setAlert({ message: err.message, notAvailable: false });
      } else if (err instanceof ApiError && err.status === 409) {
        setAlert({ message: NOT_AVAILABLE_MESSAGE, notAvailable: true });
      } else {
        setAlert({ message: err instanceof Error ? err.message : 'An unexpected error occurred.', notAvailable: false });
      }
    } finally {
      setSaving(false);
    }
  }

  if (itemState.kind === 'loading') {
    return (
      <div className="d-flex align-items-center gap-2 py-4" role="status">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>Loading item…</span>
      </div>
    );
  }

  if (itemState.kind === 'error') {
    return (
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <div className="alert alert-danger" role="alert">
          {itemState.message}
        </div>
        <Link to="/catalog">Back to the catalog</Link>
      </div>
    );
  }

  const { item } = itemState;
  const unavailable = item.status !== 'AVAILABLE';
  const trimmedLength = purpose.trim().length;

  return (
    <div className="mx-auto" style={{ maxWidth: 560 }} data-testid="page-request">
      <h1 className="h3 mb-3">Request equipment</h1>

      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-semibold font-monospace">{item.assetTag}</div>
              <div>{item.name}</div>
              <div className="text-secondary small">{item.location.name}</div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>

      {alert && (
        <div className="alert alert-danger" role="alert">
          {alert.message}{' '}
          {alert.notAvailable && <Link to="/catalog">Back to the catalog</Link>}
        </div>
      )}

      {unavailable && !alert ? (
        <div className="alert alert-warning" role="alert">
          {NOT_AVAILABLE_MESSAGE} <Link to="/catalog">Back to the catalog</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="purpose" className="form-label">
              Purpose <span className="text-danger">*</span>
            </label>
            <textarea
              id="purpose"
              rows={3}
              maxLength={PURPOSE_MAX + 50}
              className={`form-control${fieldErrors.purpose ? ' is-invalid' : ''}`}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              aria-describedby="purpose-help"
            />
            <div className="d-flex justify-content-between">
              {fieldErrors.purpose ? (
                <div className="invalid-feedback d-block">{fieldErrors.purpose}</div>
              ) : (
                <div className="form-text">Why you need the item ({PURPOSE_MIN}–{PURPOSE_MAX} characters).</div>
              )}
              <div id="purpose-help" className={`form-text ${trimmedLength > PURPOSE_MAX ? 'text-danger' : ''}`}>
                {trimmedLength}/{PURPOSE_MAX}
              </div>
            </div>
          </div>

          <div className="mb-3" style={{ maxWidth: 220 }}>
            <label htmlFor="requestedDays" className="form-label">
              Loan length (days) <span className="text-danger">*</span>
            </label>
            <input
              id="requestedDays"
              type="number"
              inputMode="numeric"
              min={DAYS_MIN}
              max={DAYS_MAX}
              step={1}
              className={`form-control${fieldErrors.requestedDays ? ' is-invalid' : ''}`}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            {fieldErrors.requestedDays && <div className="invalid-feedback">{fieldErrors.requestedDays}</div>}
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving || Boolean(alert?.notAvailable)}>
              {saving ? 'Submitting…' : 'Submit request'}
            </button>
            <Link to="/catalog" className="btn btn-outline-secondary">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
