import { Link } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';
import { usePageTitle } from '../hooks/usePageTitle';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function Categories() {
  usePageTitle('Topics');
  const { categories, loading, error } = useCategories();

  return (
    <div className="page">
      <h1>Topics</h1>
      <p className="muted">Choose a subject to see its reels.</p>
      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && categories.length === 0 && (
        <EmptyState title="No topics yet" message="Topics will appear once an admin creates them." />
      )}
      <div className="grid grid-wide">
        {categories.map((category) => (
          <Link key={category.id} to={`/category/${category.slug}`} className="card topic-card">
            <h2>{category.name}</h2>
            {category.description && <p className="muted">{category.description}</p>}
            <p className="small">
              {category.reelCount} {category.reelCount === 1 ? 'reel' : 'reels'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
