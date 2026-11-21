import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProgress, getRecommended } from '../services/learningService';
import { getQuizAttempts } from '../services/quizService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errors';
import { capitalize, formatDate } from '../utils/format';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import ReelGridCard from '../components/ReelGridCard';

const STATUS = {
  'not-started': { label: 'Not started', className: '' },
  'in-progress': { label: 'In progress', className: '' },
  'needs-practice': { label: 'Needs practice', className: 'badge-warn' },
  strong: { label: 'Strong', className: 'badge-ok' },
};

function weekday(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

function StatCard({ value, label, note }) {
  return (
    <div className="card stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small className="muted">{note}</small>}
    </div>
  );
}

export default function Progress() {
  usePageTitle('My progress');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recommended, setRecommended] = useState([]);
  const [attempts, setAttempts] = useState({ items: [], page: 0, hasMore: false, loading: false });

  const loadAttempts = useCallback(async (page) => {
    setAttempts((a) => ({ ...a, loading: true }));
    try {
      const result = await getQuizAttempts({ page, limit: 5 });
      setAttempts((a) => ({
        items: page === 1 ? result.attempts : [...a.items, ...result.attempts],
        page,
        hasMore: result.pagination.hasMore,
        loading: false,
      }));
    } catch {
      setAttempts((a) => ({ ...a, loading: false }));
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    setData(null);
    try {
      setData(await getProgress());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your progress.'));
      return;
    }
    getRecommended({ limit: 3 })
      .then((result) => setRecommended(result.reels))
      .catch(() => setRecommended([]));
    loadAttempts(1);
  }, [loadAttempts]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="page">
        <ErrorMessage message={error} onRetry={load} />
      </div>
    );
  }
  if (!data) return <Loader label="Loading your progress…" />;

  const { summary, categories, weekly } = data;
  const hasActivity = summary.reelsWatched + summary.quizzesAttempted + summary.savedCount + summary.likedCount > 0;
  const maxDay = Math.max(1, ...weekly.map((d) => Math.max(d.views, d.quizzes)));

  return (
    <div className="page">
      <h1>My learning progress</h1>
      <p className="muted">Every number here is counted from what you have actually watched, saved and answered.</p>

      {!hasActivity && (
        <EmptyState
          title="Your journey starts here"
          message="Watch a reel for a few seconds, save one you like, or take a quiz, and your progress will appear on this page."
        >
          <Link className="btn btn-primary" to="/feed">
            Watch your first reel
          </Link>
        </EmptyState>
      )}

      {hasActivity && (
        <>
          <div className="stat-grid">
            <StatCard value={summary.reelsWatched} label="Reels watched" note={`${summary.reelsCompleted} finished`} />
            <StatCard value={summary.quizzesAttempted} label="Quizzes taken" note={`${summary.distinctQuizzes} different quizzes`} />
            <StatCard
              value={summary.averageScore === null ? '–' : `${summary.averageScore}%`}
              label="Average quiz score"
              note={summary.bestScore === null ? 'No quizzes yet' : `Best ${summary.bestScore}%`}
            />
            <StatCard
              value={summary.currentStreak}
              label={summary.currentStreak === 1 ? 'Day streak' : 'Day streak'}
              note={`Longest ${summary.longestStreak}`}
            />
            <StatCard value={summary.savedCount} label="Saved reels" />
            <StatCard value={summary.likedCount} label="Liked reels" />
          </div>

          <section className="card" aria-labelledby="week-heading">
            <h2 id="week-heading">Last 7 days</h2>
            <div className="week-chart" role="list">
              {weekly.map((day) => (
                <div key={day.date} className="week-col" role="listitem" aria-label={`${weekday(day.date)}: ${day.views} reels watched, ${day.quizzes} quizzes`}>
                  <div className="week-bars">
                    <span className="bar bar-views" style={{ height: `${(day.views / maxDay) * 100}%` }} title={`${day.views} reels watched`} />
                    <span className="bar bar-quizzes" style={{ height: `${(day.quizzes / maxDay) * 100}%` }} title={`${day.quizzes} quizzes`} />
                  </div>
                  <small>{weekday(day.date)}</small>
                  <small className="muted">
                    {day.views}/{day.quizzes}
                  </small>
                </div>
              ))}
            </div>
            <p className="muted small">
              <span className="legend legend-views" /> reels watched &nbsp; <span className="legend legend-quizzes" /> quizzes
              taken
            </p>
          </section>

          <section className="card" aria-labelledby="topics-progress-heading">
            <h2 id="topics-progress-heading">By topic</h2>
            <ul className="topic-progress">
              {categories.map((category) => {
                const percent = category.totalReels ? Math.round((category.watched / category.totalReels) * 100) : 0;
                const status = STATUS[category.status];
                return (
                  <li key={category.id}>
                    <div className="topic-head">
                      <strong>{category.name}</strong>
                      <span className={`badge ${status.className}`}>{status.label}</span>
                    </div>
                    <div
                      className="meter"
                      role="progressbar"
                      aria-label={`${category.name} reels watched`}
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <p className="muted small">
                      Watched {category.watched} of {category.totalReels} reels
                      {category.averageScore !== null && ` · quiz average ${category.averageScore}% over ${category.quizAttempts} attempt${category.quizAttempts === 1 ? '' : 's'}`}
                      {category.status === 'needs-practice' && (
                        <>
                          {' · '}
                          <Link to={`/category/${category.slug}`}>Practice this topic</Link>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card" aria-labelledby="history-heading">
            <h2 id="history-heading">Quiz history</h2>
            {attempts.items.length === 0 && !attempts.loading && (
              <p className="muted">No quizzes yet. Open any reel and use &ldquo;Test yourself&rdquo;.</p>
            )}
            <ul className="admin-list">
              {attempts.items.map((attempt) => (
                <li key={attempt.id} className="admin-row">
                  <div className="admin-row-main">
                    {attempt.reel ? <Link to={`/reels/${attempt.reel.id}`}>{attempt.reel.title}</Link> : <span>Reel removed</span>}
                    <span className="muted small">
                      {capitalize(attempt.difficulty)} · {formatDate(attempt.createdAt)}
                    </span>
                  </div>
                  <strong>
                    {attempt.score}/{attempt.total} ({attempt.percentage}%)
                  </strong>
                  {attempt.reel && (
                    <Link to={`/reels/${attempt.reel.id}`} className="btn btn-ghost btn-sm">
                      Retake
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {attempts.loading && <Loader label="Loading…" />}
            {attempts.hasMore && !attempts.loading && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadAttempts(attempts.page + 1)}>
                Show older attempts
              </button>
            )}
          </section>
        </>
      )}

      {recommended.length > 0 && (
        <section aria-labelledby="next-heading">
          <h2 id="next-heading">Recommended next</h2>
          <div className="grid">
            {recommended.map((reel) => (
              <ReelGridCard key={reel.id} reel={reel} />
            ))}
          </div>
          <p>
            <Link to="/feed?tab=for-you">See your full &ldquo;For you&rdquo; feed</Link>
          </p>
        </section>
      )}
    </div>
  );
}
