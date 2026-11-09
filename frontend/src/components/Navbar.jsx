import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SearchIcon } from './Icons';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function handleSearch(event) {
    event.preventDefault();
    const text = query.trim();
    if (text) navigate(`/search?q=${encodeURIComponent(text)}`);
  }

  async function handleLogout() {
    await logout();
    showToast('You have been logged out.', 'success');
    navigate('/');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="CS Reels home">
        <span className="brand-mark" aria-hidden="true">▶</span> CS Reels
      </Link>

      <nav className="nav-links" aria-label="Main">
        <NavLink to="/feed">Reels</NavLink>
        <NavLink to="/categories">Topics</NavLink>
        {user && <NavLink to="/saved">Saved</NavLink>}
        {user && <NavLink to="/liked">Liked</NavLink>}
        {user && <NavLink to="/chat">AI Tutor</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>

      <form className="nav-search" onSubmit={handleSearch} role="search">
        <label htmlFor="nav-search-input" className="sr-only">
          Search reels
        </label>
        <input
          id="nav-search-input"
          type="search"
          placeholder="Search reels…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="icon-btn" aria-label="Search">
          <SearchIcon />
        </button>
      </form>

      <div className="nav-actions">
        {user ? (
          <>
            <Link to="/profile" className="nav-user">
              {user.name.split(' ')[0]}
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
