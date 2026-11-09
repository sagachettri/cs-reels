import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminReports, updateAdminReport } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errors';
import { REPORT_REASONS, formatDate } from '../../utils/format';
import Loader from '../Loader';
import ErrorMessage from '../ErrorMessage';
import EmptyState from '../EmptyState';

export default function ManageReportsTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getAdminReports({ status, limit: 30 }));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load reports.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(report, payload, message) {
    try {
      await updateAdminReport(report.id, payload);
      showToast(message, 'success');
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the report.'), 'error');
    }
  }

  const reasonLabel = (value) => REPORT_REASONS.find((r) => r.value === value)?.label || value;

  return (
    <>
      <div className="filter-row">
        <label htmlFor="report-status">Show</label>
        <select id="report-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
        </select>
      </div>

      {loading && <Loader label="Loading reports…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!loading && !error && data?.reports.length === 0 && <EmptyState title="No reports here" message="Nothing to review." />}

      <ul className="admin-list">
        {!loading &&
          data?.reports.map((report) => (
            <li key={report.id} className="card admin-row admin-row-wrap">
              <div className="admin-row-main">
                <strong>{reasonLabel(report.reason)}</strong>
                {report.reel ? <Link to={`/reels/${report.reel.id}`}>{report.reel.title}</Link> : <span>Reel deleted</span>}
                {report.details && <span className="small">&ldquo;{report.details}&rdquo;</span>}
                <span className="muted small">
                  {report.reporter?.name} · {formatDate(report.createdAt)}
                </span>
              </div>
              {report.status === 'open' && (
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => act(report, { status: 'dismissed' }, 'Report dismissed.')}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => act(report, { status: 'reviewed' }, 'Marked as reviewed.')}
                  >
                    Reviewed
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => act(report, { status: 'actioned', unpublishReel: true }, 'Reel unpublished.')}
                  >
                    Unpublish reel
                  </button>
                </div>
              )}
            </li>
          ))}
      </ul>
    </>
  );
}
