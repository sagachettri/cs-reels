import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import EmptyState from './EmptyState';
import ReelGridCard from './ReelGridCard';

// Shared by Search, Category, Saved and Liked pages. `paged` is the result of usePagedReels().
export default function ReelGridList({ paged, emptyTitle, emptyMessage, emptyAction }) {
  const { items, loading, loadingMore, error, hasMore, loadMore, retry } = paged;

  if (loading) return <Loader label="Loading reels…" />;
  if (error && items.length === 0) return <ErrorMessage message={error} onRetry={retry} />;
  if (items.length === 0) {
    return (
      <EmptyState title={emptyTitle} message={emptyMessage}>
        {emptyAction}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="grid">
        {items.map((reel) => (
          <ReelGridCard key={reel.id} reel={reel} />
        ))}
      </div>
      {error && <ErrorMessage message={error} onRetry={retry} />}
      {loadingMore && <Loader label="Loading more…" />}
      {hasMore && !loadingMore && !error && (
        <div className="center">
          <button type="button" className="btn btn-ghost" onClick={loadMore}>
            Load more
          </button>
        </div>
      )}
    </>
  );
}
