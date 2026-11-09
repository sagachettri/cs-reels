import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { likeReel, unlikeReel, saveReel, unsaveReel } from '../services/interactionService';
import { getErrorMessage } from '../utils/errors';
import { BookmarkIcon, HeartIcon } from './Icons';

// Like and Save buttons. The UI updates instantly and rolls back if the server says no.
export default function ReelActions({ reel, onChange, className = '' }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState({ like: false, save: false });

  function requireLogin() {
    showToast('Log in to like and save reels.', 'info');
    navigate('/login', { state: { from: location.pathname + location.search } });
  }

  async function toggleLike() {
    if (!user) return requireLogin();
    if (busy.like) return;
    const was = reel.liked;
    setBusy((b) => ({ ...b, like: true }));
    onChange({ liked: !was, likesCount: Math.max(0, reel.likesCount + (was ? -1 : 1)) });
    try {
      const result = was ? await unlikeReel(reel.id) : await likeReel(reel.id);
      onChange({ liked: result.liked, likesCount: result.likesCount });
    } catch (error) {
      onChange({ liked: was, likesCount: reel.likesCount });
      showToast(getErrorMessage(error, 'Could not update your like.'), 'error');
    } finally {
      setBusy((b) => ({ ...b, like: false }));
    }
  }

  async function toggleSave() {
    if (!user) return requireLogin();
    if (busy.save) return;
    const was = reel.saved;
    setBusy((b) => ({ ...b, save: true }));
    onChange({ saved: !was, savesCount: Math.max(0, reel.savesCount + (was ? -1 : 1)) });
    try {
      const result = was ? await unsaveReel(reel.id) : await saveReel(reel.id);
      onChange({ saved: result.saved, savesCount: result.savesCount });
      showToast(result.saved ? 'Saved to your list.' : 'Removed from saved.', 'success');
    } catch (error) {
      onChange({ saved: was, savesCount: reel.savesCount });
      showToast(getErrorMessage(error, 'Could not update your saved list.'), 'error');
    } finally {
      setBusy((b) => ({ ...b, save: false }));
    }
  }

  return (
    <div className={`reel-actions ${className}`}>
      <button
        type="button"
        className={`action-btn ${reel.liked ? 'is-on' : ''}`}
        onClick={toggleLike}
        aria-pressed={reel.liked}
        aria-label={reel.liked ? 'Unlike this reel' : 'Like this reel'}
      >
        <HeartIcon filled={reel.liked} />
        <span>{reel.likesCount}</span>
      </button>
      <button
        type="button"
        className={`action-btn ${reel.saved ? 'is-on' : ''}`}
        onClick={toggleSave}
        aria-pressed={reel.saved}
        aria-label={reel.saved ? 'Remove from saved' : 'Save this reel'}
      >
        <BookmarkIcon filled={reel.saved} />
        <span>{reel.saved ? 'Saved' : 'Save'}</span>
      </button>
    </div>
  );
}
