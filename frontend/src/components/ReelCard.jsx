import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReelPlayer from './ReelPlayer';
import ReelActions from './ReelActions';
import ReportModal from './ReportModal';
import { FlagIcon, InfoIcon } from './Icons';
import { capitalize } from '../utils/format';

// One full-screen item of the vertical feed.
export default function ReelCard({ reel, index, active, loadVideo, muted, onToggleMute, onActivate, onChange }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Tell the feed when this card is mostly on screen, so only that reel plays.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onActivate(index);
      },
      { threshold: 0.6 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onActivate]);

  return (
    <article ref={ref} className="reel-card" aria-label={reel.title}>
      <ReelPlayer reel={reel} active={active} loadVideo={loadVideo} muted={muted} onToggleMute={onToggleMute} />

      <div className="reel-overlay">
        <div className="reel-meta">
          <div className="reel-badges">
            {reel.category && (
              <Link to={`/category/${reel.category.slug}`} className="badge badge-link">
                {reel.category.name}
              </Link>
            )}
            <span className={`badge level-${reel.level}`}>{capitalize(reel.level)}</span>
          </div>
          <h2 className="reel-title">{reel.title}</h2>
          <p className={`reel-desc ${expanded ? 'is-open' : ''}`}>{reel.description}</p>
          {reel.description.length > 90 && (
            <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
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
          <p className="reel-creator">By {reel.creator}</p>
        </div>

        <div className="reel-side">
          <ReelActions reel={reel} onChange={(patch) => onChange(reel.id, patch)} />
          <Link to={`/reels/${reel.id}`} className="action-btn" aria-label="Open details, quiz and AI explanation">
            <InfoIcon />
            <span>Learn</span>
          </Link>
          <button type="button" className="action-btn" onClick={() => setReporting(true)} aria-label="Report this reel">
            <FlagIcon />
            <span>Report</span>
          </button>
        </div>
      </div>

      {reporting && <ReportModal reel={reel} onClose={() => setReporting(false)} />}
    </article>
  );
}
