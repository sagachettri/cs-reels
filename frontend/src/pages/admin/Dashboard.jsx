import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats } from '../../services/adminService';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getErrorMessage } from '../../utils/errors';
import Loader from '../../components/Loader';
import ErrorMessage from '../../components/ErrorMessage';

const LABELS = [
  ['publishedReels', 'Published reels'],
  ['draftReels', 'Drafts'],
  ['users', 'Users'],
  ['likes', 'Likes'],
  ['saves', 'Saves'],
  ['categories', 'Categories'],
  ['openReports', 'Open reports'],
];

export default function Dashboard() {
  usePageTitle('Admin dashboard');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setError('');
    getAdminStats()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, 'Could not load statistics.')));
  }

  useEffect(load, []);

  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!data) return <Loader label="Loading statistics…" />;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stat-grid">
        {LABELS.map(([key, label]) => (
          <div className="card stat-card" key={key}>
            <strong>{data.stats[key]}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="button-row">
        <Link to="/admin/upload" className="btn btn-primary">
          Upload a reel
        </Link>
        <Link to="/admin/reels" className="btn btn-ghost">
          Manage content
        </Link>
      </div>

      <h2>Most liked reels</h2>
      {data.topReels.length === 0 ? (
        <p className="muted">No published reels yet.</p>
      ) : (
        <ol className="top-list">
          {data.topReels.map((reel) => (
            <li key={reel.id}>
              <Link to={`/reels/${reel.id}`}>{reel.title}</Link>
              <span className="muted small">
                {reel.likesCount} likes · {reel.savesCount} saves
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
