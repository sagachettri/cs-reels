import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getReel, getRelatedReels } from '../services/reelService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errors';
import { capitalize, formatDate, formatDuration } from '../utils/format';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import ReelActions from '../components/ReelActions';
import ReportModal from '../components/ReportModal';
import ResourceList from '../components/ResourceList';
import AIExplainPanel from '../components/AIExplainPanel';
import QuizPanel from '../components/QuizPanel';
import ReelGridCard from '../components/ReelGridCard';
import { FlagIcon } from '../components/Icons';

export default function ReelDetail() {
  const { id } = useParams();
  const [reel, setReel] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  usePageTitle(reel?.title || 'Reel');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setVideoFailed(false);
    try {
      const [reelData, relatedData] = await Promise.all([
        getReel(id),
        getRelatedReels(id).catch(() => ({ reels: [] })), // related reels are a bonus, never block the page
      ]);
      setReel(reelData.reel);
      setRelated(relatedData.reels);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this reel.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patchReel = useCallback((patch) => setReel((current) => (current ? { ...current, ...patch } : current)), []);

  if (loading) return <Loader label="Loading reel…" />;
  if (error) {
    return (
      <div className="page">
        <ErrorMessage message={error} onRetry={load} />
        <p>
          <Link to="/feed">Back to reels</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page detail">
      <div className="detail-main">
        <div className="detail-video">
          {videoFailed ? (
            <div className="player-error" role="alert">
              <p>This video could not be loaded.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVideoFailed(false)}>
                Try again
              </button>
            </div>
          ) : (
            <video
              src={reel.videoUrl}
              poster={reel.thumbnailUrl || undefined}
              controls
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
            />
          )}
        </div>

        <div className="detail-info">
          <div className="reel-badges">
            {reel.category && (
              <Link to={`/category/${reel.category.slug}`} className="badge badge-link">
                {reel.category.name}
              </Link>
            )}
            <span className={`badge level-${reel.level}`}>{capitalize(reel.level)}</span>
            {reel.durationSec ? <span className="badge">{formatDuration(reel.durationSec)}</span> : null}
            {reel.status !== 'published' && <span className="badge badge-warn">{capitalize(reel.status)}</span>}
          </div>
          <h1>{reel.title}</h1>
          <p>{reel.description}</p>
          {reel.keyTakeaway && (
            <p className="takeaway">
              <strong>Key takeaway:</strong> {reel.keyTakeaway}
            </p>
          )}
          {reel.tags.length > 0 && (
            <ul className="tag-list" aria-label="Tags">
              {reel.tags.map((tag) => (
                <li key={tag}>
                  <Link to={`/search?q=${encodeURIComponent(tag)}`}>#{tag}</Link>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            By {reel.creator} · {formatDate(reel.createdAt)}
          </p>

          <div className="button-row">
            <ReelActions reel={reel} onChange={patchReel} className="inline" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(true)}>
              <FlagIcon /> Report
            </button>
          </div>
        </div>
      </div>

      <ResourceList resources={reel.resources} />
      <AIExplainPanel reelId={reel.id} />
      <QuizPanel reelId={reel.id} />

      {related.length > 0 && (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading">Related reels</h2>
          <div className="grid">
            {related.map((item) => (
              <ReelGridCard key={item.id} reel={item} />
            ))}
          </div>
        </section>
      )}

      {reporting && <ReportModal reel={reel} onClose={() => setReporting(false)} />}
    </div>
  );
}
