import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

// Login and register pages: logged-in users are sent to where they were heading.
export default function GuestRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session…" />;
  if (user) return <Navigate to={location.state?.from || '/feed'} replace />;
  return <Outlet />;
}
