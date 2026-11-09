import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GridIcon, HomeIcon, SearchIcon, BookmarkIcon, UserIcon } from './Icons';

// Thumb-friendly navigation, shown only on small screens.
export default function BottomNav() {
  const { user } = useAuth();

  return (
    <nav className="bottom-nav" aria-label="Mobile">
      <NavLink to="/feed">
        <HomeIcon />
        <span>Reels</span>
      </NavLink>
      <NavLink to="/categories">
        <GridIcon />
        <span>Topics</span>
      </NavLink>
      <NavLink to="/search">
        <SearchIcon />
        <span>Search</span>
      </NavLink>
      <NavLink to="/saved">
        <BookmarkIcon />
        <span>Saved</span>
      </NavLink>
      <NavLink to={user ? '/profile' : '/login'}>
        <UserIcon />
        <span>{user ? 'Profile' : 'Log in'}</span>
      </NavLink>
    </nav>
  );
}
