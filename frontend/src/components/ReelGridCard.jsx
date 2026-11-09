import { useState } from 'react';
import { Link } from 'react-router-dom';
import { capitalize, formatDuration } from '../utils/format';
import { HeartIcon } from './Icons';

export default function ReelGridCard({ reel }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = reel.thumbnailUrl && !imageFailed;

  return (
    <Link to={`/reels/${reel.id}`} className="grid-card">
      <div className="grid-thumb">
        {showImage ? (
          <img src={reel.thumbnailUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="grid-thumb-fallback" aria-hidden="true">▶</div>
        )}
        {reel.durationSec ? <span className="duration">{formatDuration(reel.durationSec)}</span> : null}
      </div>
      <div className="grid-body">
        <h3>{reel.title}</h3>
        <p className="muted small">
          {reel.category?.name} · {capitalize(reel.level)}
        </p>
        <p className="muted small likes-line">
          <HeartIcon filled={reel.liked} /> {reel.likesCount}
        </p>
      </div>
    </Link>
  );
}
