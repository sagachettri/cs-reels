import { Link, useSearchParams } from 'react-router-dom';
import { getFeed } from '../services/reelService';
import { getRecommended } from '../services/learningService';
import { usePagedReels } from '../hooks/usePagedReels';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import ReelFeed from '../components/ReelFeed';
import CategoryChips from '../components/CategoryChips';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function Feed() {
  usePageTitle('Reels');
  const { user } = useAuth();
  const { categories } = useCategories();
  const [params, setParams] = useSearchParams();
  const forYou = Boolean(user) && params.get('tab') === 'for-you';
  const paged = usePagedReels(
    (page) => (forYou ? getRecommended({ page, limit: 8 }) : getFeed({ page, limit: 8 })),
    forYou ? 'for-you' : 'feed'
  );

  let body;
  if (paged.loading) {
    body = <Loader label="Loading reels…" />;
  } else if (paged.error && paged.items.length === 0) {
    body = <ErrorMessage message={paged.error} onRetry={paged.retry} />;
  } else if (paged.items.length === 0) {
    body = (
      <EmptyState title="No reels yet" message="New reels will appear here as soon as they are published.">
        {user?.role === 'admin' && (
          <Link className="btn btn-primary" to="/admin/upload">
            Upload the first reel
          </Link>
        )}
      </EmptyState>
    );
  } else {
    body = (
      <ReelFeed
        reels={paged.items}
        hasMore={paged.hasMore}
        loadingMore={paged.loadingMore}
        loadMore={paged.loadMore}
        onChange={paged.updateItem}
      />
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-chips">
        {user && (
          <div className="feed-tabs" role="tablist" aria-label="Feed type">
            <button type="button" role="tab" aria-selected={!forYou} className={`feed-tab ${!forYou ? 'is-active' : ''}`} onClick={() => setParams({})}>
              Latest
            </button>
            <button type="button" role="tab" aria-selected={forYou} className={`feed-tab ${forYou ? 'is-active' : ''}`} onClick={() => setParams({ tab: 'for-you' })}>
              For you
            </button>
          </div>
        )}
        <CategoryChips categories={categories} />
      </div>
      {body}
    </div>
  );
}
