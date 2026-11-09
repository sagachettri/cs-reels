import { useCallback, useEffect, useRef, useState } from 'react';
import ReelCard from './ReelCard';
import Loader from './Loader';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

// The vertical, snap-scrolling feed. Exactly one reel is "active" (playing) at a time.
export default function ReelFeed({ reels, hasMore, loadingMore, loadMore, onChange }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true); // browsers only allow autoplay with sound off

  const handleActivate = useCallback((index) => setActiveIndex(index), []);
  const toggleMute = useCallback(() => setMuted((value) => !value), []);

  // Fetch the next page when the viewer gets near the end.
  useEffect(() => {
    if (hasMore && activeIndex >= reels.length - 3) loadMore();
  }, [activeIndex, reels.length, hasMore, loadMore]);

  function scrollByCard(direction) {
    const container = containerRef.current;
    if (container) container.scrollBy({ top: direction * container.clientHeight, behavior: 'smooth' });
  }

  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return; // do not hijack keys used by buttons and links
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      scrollByCard(1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      scrollByCard(-1);
    }
  }

  return (
    <div className="feed-shell">
      <div
        ref={containerRef}
        className="reel-feed"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Reels feed. Use the up and down arrow keys to move between reels."
      >
        {reels.map((reel, index) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            index={index}
            active={index === activeIndex}
            loadVideo={Math.abs(index - activeIndex) <= 1}
            muted={muted}
            onToggleMute={toggleMute}
            onActivate={handleActivate}
            onChange={onChange}
          />
        ))}
        {loadingMore && (
          <div className="reel-card reel-card-end">
            <Loader label="Loading more reels…" />
          </div>
        )}
        {!hasMore && !loadingMore && reels.length > 0 && (
          <div className="reel-card reel-card-end">
            <p className="muted">You have reached the end. Check back soon for new reels!</p>
          </div>
        )}
      </div>

      <div className="feed-arrows">
        <button type="button" className="icon-btn" onClick={() => scrollByCard(-1)} aria-label="Previous reel">
          <ChevronUpIcon />
        </button>
        <button type="button" className="icon-btn" onClick={() => scrollByCard(1)} aria-label="Next reel">
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  );
}
