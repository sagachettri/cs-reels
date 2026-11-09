import { useEffect, useState } from 'react';
import { updateAdminReel } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errors';
import ReelFields, { fromReel, toApiFields } from './ReelFields';

export default function EditReelModal({ reel, categories, onClose, onSaved }) {
  const { showToast } = useToast();
  const [values, setValues] = useState(() => fromReel(reel));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await updateAdminReel(reel.id, toApiFields(values));
      showToast('Reel updated.', 'success');
      onSaved(data.reel);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your changes.'));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-title">Edit reel</h2>
        <p className="muted small">The video file itself cannot be replaced. Upload a new reel instead.</p>
        <form onSubmit={handleSubmit}>
          <ReelFields values={values} onChange={setValues} categories={categories} idPrefix="edit" />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
