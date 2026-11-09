import { useEffect, useRef, useState } from 'react';
import { PlayIcon, VolumeIcon } from './Icons';

// One vertical video. Only the active reel plays; neighbours may preload; the rest show only the poster.
export default function ReelPlayer({ reel, active, loadVideo, muted, onToggleMute }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(true);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted, loadVideo, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      const playing = video.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(() => setPaused(true)); // the browser refused autoplay: show the play button
      }
    } else {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* video metadata not loaded yet */
      }
    }
  }, [active, loadVideo, attempt]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      const playing = video.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    } else {
      video.pause();
    }
  }

  function retry() {
    setFailed(false);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="player">
      {!loadVideo && reel.thumbnailUrl && <img className="player-poster" src={reel.thumbnailUrl} alt="" />}

      {loadVideo && !failed && (
        <video
          key={attempt}
          ref={videoRef}
          className="player-video"
          src={reel.videoUrl}
          poster={reel.thumbnailUrl || undefined}
          loop
          playsInline
          muted={muted}
          preload={active ? 'auto' : 'metadata'}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onError={() => setFailed(true)}
          onTimeUpdate={(event) => {
            const { currentTime, duration } = event.currentTarget;
            if (duration) setProgress((currentTime / duration) * 100);
          }}
        />
      )}

      {failed && (
        <div className="player-error" role="alert">
          <p>This video could not be loaded.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadVideo && !failed && (
        <>
          <button
            type="button"
            className="player-tap"
            onClick={togglePlay}
            aria-label={paused ? `Play ${reel.title}` : `Pause ${reel.title}`}
          >
            {paused && (
              <span className="player-play" aria-hidden="true">
                <PlayIcon />
              </span>
            )}
          </button>
          <button
            type="button"
            className="player-mute"
            onClick={onToggleMute}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          >
            <VolumeIcon muted={muted} />
          </button>
          <div className="player-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
