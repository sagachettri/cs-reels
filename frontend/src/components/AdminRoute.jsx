import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';
import EmptyState from './EmptyState';

// Hiding the admin links is only cosmetic: the real protection is requireRole('admin') on the server.
export default function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session…" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.role !== 'admin') {
    return (
      <EmptyState title="Admins only" message="Your account does not have access to this area.">
        <Link className="btn btn-primary" to="/feed">
          Back to reels
        </Link>
      </EmptyState>
    );
  }
  return <Outlet />;
}
