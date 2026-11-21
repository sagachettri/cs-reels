import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { recordView } from '../services/learningService';

const MIN_SECONDS = 3; // shorter than this is a scroll-past, not watching
const COMPLETE_RATIO = 0.85;

// Reports REAL watching to the server (only for logged-in students, only after a few seconds).
//  playing:       true while the reel is actually being watched
//  flushOnStop:   send as soon as watching stops (feed). Otherwise send when the page or reel is left (detail page).
export function useWatchTracker(reel, playing, { flushOnStop = false } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const reelRef = useRef(reel);
  const watch = useRef({ startedAt: null, elapsedMs: 0 });
  reelRef.current = reel;

  function flush() {
    const seconds = watch.current.elapsedMs / 1000;
    watch.current.elapsedMs = 0;
    const current = reelRef.current;
    if (!current?.id || seconds < MIN_SECONDS) return;

    const duration = current.durationSec;
    const watchedSec = Math.round(duration ? Math.min(seconds, duration) : seconds);
    const completed = duration ? seconds >= duration * COMPLETE_RATIO : false;
    recordView(current.id, { watchedSec, completed }).catch(() => {
      /* tracking must never disturb the student */
    });
  }

  useEffect(() => {
    if (!userId || !playing) return undefined;
    watch.current.startedAt = Date.now();
    return () => {
      watch.current.elapsedMs += Date.now() - watch.current.startedAt;
      watch.current.startedAt = null;
      if (flushOnStop) flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, userId, flushOnStop]);

  const reelId = reel?.id;
  useEffect(
    () => () => flush(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reelId, userId]
  );
}
