import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { reportReel } from '../services/interactionService';
import { getErrorMessage } from '../utils/errors';
import { REPORT_REASONS } from '../utils/format';

export default function ReportModal({ reel, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [reason, setReason] = useState('inaccurate');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user) {
      showToast('Log in to report a reel.', 'info');
      navigate('/login', { state: { from: location.pathname + location.search } });
      onClose();
    }
  }, [user, navigate, location, onClose, showToast]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await reportReel(reel.id, { reason, details: details.trim() || undefined });
      showToast(result.message || 'Report sent. Thank you!', 'success');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send your report.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="report-title">Report this reel</h2>
        <p className="muted">{reel.title}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="report-reason">What is wrong?</label>
          <select id="report-reason" ref={firstField} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="report-details">More details (optional)</label>
          <textarea
            id="report-details"
            rows={3}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
