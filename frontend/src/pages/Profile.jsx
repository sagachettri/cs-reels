import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProfile, updateProfile } from '../services/reelService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/format';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function Profile() {
  usePageTitle('Profile');
  const { user, setUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((data) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your activity.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setNameError('');
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const data = await updateProfile({ name: name.trim() });
      setUser(data.user);
      showToast('Profile updated.', 'success');
    } catch (err) {
      setNameError(getErrorMessage(err, 'Could not update your name.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    showToast('You have been logged out.', 'success');
    navigate('/');
  }

  return (
    <div className="page narrow">
      <div className="card">
        <h1>{user.name}</h1>
        <p className="muted">
          {user.email} · Joined {formatDate(user.createdAt)}
          {user.role === 'admin' && <span className="badge badge-warn"> Admin</span>}
        </p>

        {error && <ErrorMessage message={error} />}
        {!stats && !error && <Loader label="Loading activity…" />}
        {stats && (
          <div className="stat-row">
            <Link to="/saved" className="stat">
              <strong>{stats.savedCount}</strong>
              <span>Saved</span>
            </Link>
            <Link to="/liked" className="stat">
              <strong>{stats.likedCount}</strong>
              <span>Liked</span>
            </Link>
          </div>
        )}

        <form onSubmit={handleSave}>
          <label htmlFor="profile-name">Display name</label>
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          {nameError && (
            <p className="form-error" role="alert">
              {nameError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving || name.trim() === user.name}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </form>

        <div className="button-row">
          {user.role === 'admin' && (
            <Link to="/admin" className="btn btn-ghost">
              Admin dashboard
            </Link>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
