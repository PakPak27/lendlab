import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { homePathFor, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import { CatalogPlaceholder, CustodianRequestsPlaceholder, MyBorrowingPlaceholder } from './pages/Placeholders';

function Header() {
  const { user, signOut } = useAuth();
  return (
    <nav className="navbar navbar-expand bg-primary" data-bs-theme="dark">
      <div className="container">
        <Link className="navbar-brand fw-bold" to={user ? homePathFor(user.role) : '/login'}>
          LendLab
        </Link>
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

// App shell. Role-aware navigation and the /forbidden page are added by F-02.
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
          <Route path="/catalog" element={<ProtectedRoute><CatalogPlaceholder /></ProtectedRoute>} />
          <Route path="/my" element={<ProtectedRoute><MyBorrowingPlaceholder /></ProtectedRoute>} />
          <Route
            path="/custodian/requests"
            element={<ProtectedRoute><CustodianRequestsPlaceholder /></ProtectedRoute>}
          />
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
