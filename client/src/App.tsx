import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';

// App shell. Role-aware navigation and protected routes are added in Issues #4-#5.
export default function App() {
  return (
    <>
      <nav className="navbar navbar-expand bg-primary" data-bs-theme="dark">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            LendLab
          </Link>
        </div>
      </nav>
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
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
