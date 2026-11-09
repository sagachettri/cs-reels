import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAdminReel, getAdminReels, updateAdminReel } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errors';
import { capitalize } from '../../utils/format';
import Loader from '../Loader';
import ErrorMessage from '../ErrorMessage';
import EmptyState from '../EmptyState';
import EditReelModal from './EditReelModal';

export default function ManageReelsTab({ categories }) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminReels({
        page,
        limit: 10,
        ...(status ? { status } : {}),
        ...(submittedQuery ? { q: submittedQuery } : {}),
      });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load reels.'));
    } finally {
      setLoading(false);
    }
  }, [page, status, submittedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(reel) {
    const next = reel.status === 'published' ? 'draft' : 'published';
    try {
      await updateAdminReel(reel.id, { status: next });
      showToast(next === 'published' ? 'Reel published.' : 'Reel moved to drafts.', 'success');
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not change the status.'), 'error');
    }
  }

  async function handleDelete(reel) {
    if (!window.confirm(`Delete "${reel.title}" permanently? Its likes, saves and video file are removed too.`)) return;
    try {
      await deleteAdminReel(reel.id);
      showToast('Reel deleted.', 'success');
      if (data.reels.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not delete the reel.'), 'error');
    }
  }

  return (
    <>
      <form
        className="filter-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedQuery(query.trim());
        }}
      >
        <label htmlFor="admin-reel-search" className="sr-only">
          Search reels
        </label>
        <input
          id="admin-reel-search"
          type="search"
          placeholder="Search title, description, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label htmlFor="admin-reel-status" className="sr-only">
          Status
        </label>
        <select
          id="admin-reel-status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-sm">
          Search
        </button>
      </form>

      {loading && <Loader label="Loading reels…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && data && data.reels.length === 0 && (
        <EmptyState title="No reels found" message="Upload a reel or change the filters.">
          <Link to="/admin/upload" className="btn btn-primary">
            Upload a reel
          </Link>
        </EmptyState>
      )}

      {!loading && !error && data && data.reels.length > 0 && (
        <>
          <ul className="admin-list">
            {data.reels.map((reel) => (
              <li key={reel.id} className="card admin-row">
                <div className="admin-row-main">
                  <Link to={`/reels/${reel.id}`}>
                    <strong>{reel.title}</strong>
                  </Link>
                  <span className="muted small">
                    {reel.category?.name} · {capitalize(reel.level)} · {reel.likesCount} likes · {reel.savesCount} saves
                  </span>
                </div>
                <span className={`badge ${reel.status === 'published' ? 'badge-ok' : 'badge-warn'}`}>
                  {capitalize(reel.status)}
                </span>
                <div className="admin-row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(reel)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => togglePublish(reel)}>
                    {reel.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(reel)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="pager">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span className="muted small">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!data.pagination.hasMore}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {editing && (
        <EditReelModal
          reel={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}
