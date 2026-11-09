import { Link } from 'react-router-dom';
import { getFeed } from '../services/reelService';
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
  const paged = usePagedReels((page) => getFeed({ page, limit: 8 }), 'feed');

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
        <CategoryChips categories={categories} />
      </div>
      {body}
    </div>
  );
}
