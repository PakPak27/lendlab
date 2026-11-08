import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { homePathFor, useAuth } from '../auth/AuthContext';

// F-01 login screen: labelled fields, button disabled while submitting,
// 400 -> inline field errors, 401 -> red alert, network error -> retry message.
export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!loading && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setAlert(null);
    setFieldErrors({});
    try {
      await signIn(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.details) {
        const map: Record<string, string> = {};
        for (const d of err.details) map[d.field] ??= d.message;
        setFieldErrors(map);
      } else if (err instanceof ApiError) {
        setAlert(err.message);
      } else {
        setAlert('Cannot reach the server. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-3">Sign in</h1>
      {alert && (
        <div className="alert alert-danger" role="alert">
          {alert}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`form-control${fieldErrors.password ? ' is-invalid' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password && <div className="invalid-feedback">{fieldErrors.password}</div>}
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
