import { Link } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext';

// Shown when a signed-in user opens a page meant for the other role (F-02, AC-02-07).
export default function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <div className="text-center py-5">
      <h1 className="h3">You do not have access to this page.</h1>
      <Link to={user ? homePathFor(user.role) : '/login'}>Go to your home page</Link>
    </div>
  );
}
