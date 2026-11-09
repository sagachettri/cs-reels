import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="page admin-page">
      <nav className="admin-tabs" aria-label="Admin">
        <NavLink to="/admin" end>
          Dashboard
        </NavLink>
        <NavLink to="/admin/upload">Upload reel</NavLink>
        <NavLink to="/admin/reels">Manage content</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
