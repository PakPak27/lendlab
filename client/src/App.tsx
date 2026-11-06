import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { homePathFor, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import ForbiddenPage from './pages/ForbiddenPage';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import { CustodianRequestsPlaceholder, MyBorrowingPlaceholder } from './pages/Placeholders';

// Role-aware navigation (F-02): borrowers see Catalog and My Borrowing, custodians see Requests.
function NavLinks() {
  const { user } = useAuth();
  if (!user) return null;
  const links =
    user.role === 'CUSTODIAN'
      ? [{ to: '/custodian/requests', label: 'Requests' }]
      : [
          { to: '/catalog', label: 'Catalog' },
          { to: '/my', label: 'My Borrowing' },
        ];
  return (
    <ul className="navbar-nav me-auto">
      {links.map((l) => (
        <li className="nav-item" key={l.to}>
          <NavLink className="nav-link" to={l.to}>
            {l.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  return (
    <nav className="navbar navbar-expand bg-primary" data-bs-theme="dark">
      <div className="container">
        <Link className="navbar-brand fw-bold" to={user ? homePathFor(user.role) : '/login'}>
          LendLab
        </Link>
        <NavLinks />
        {user && (
          <div className="d-flex align-items-center gap-2 text-white">
            <span>{user.name}</span>
            <span className="badge text-bg-light">{user.role === 'CUSTODIAN' ? 'Custodian' : 'Borrower'}</span>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <>
      <Header />
      <main className="container py-4">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={loading ? null : <Navigate to={user ? homePathFor(user.role) : '/login'} replace />}
          />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute roles={['BORROWER', 'CUSTODIAN']}>
                <CatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute roles={['BORROWER']}>
                <MyBorrowingPlaceholder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/custodian/requests"
            element={
              <ProtectedRoute roles={['CUSTODIAN']}>
                <CustodianRequestsPlaceholder />
              </ProtectedRoute>
            }
          />
          <Route path="/forbidden" element={<ProtectedRoute><ForbiddenPage /></ProtectedRoute>} />
          <Route
            path="*"
            element={
              <div className="text-center py-5">
                <h1 className="h3">Page not found</h1>
                <Link to="/">Go to the home page</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
