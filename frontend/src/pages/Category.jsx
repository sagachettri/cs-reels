import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFeed } from '../services/reelService';
import { usePagedReels } from '../hooks/usePagedReels';
import { useCategories } from '../hooks/useCategories';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEVELS, capitalize } from '../utils/format';
import CategoryChips from '../components/CategoryChips';
import ReelGridList from '../components/ReelGridList';

export default function Category() {
  const { slug } = useParams();
  const [level, setLevel] = useState('');
  const { categories } = useCategories();
  const current = categories.find((c) => c.slug === slug);
  usePageTitle(current?.name || 'Topic');

  const paged = usePagedReels(
    (page) => getFeed({ page, limit: 12, category: slug, ...(level ? { level } : {}) }),
    `${slug}|${level}`
  );

  return (
    <div className="page">
      <CategoryChips categories={categories} activeSlug={slug} />
      <h1>{current?.name || 'Topic'}</h1>
      {current?.description && <p className="muted">{current.description}</p>}

      <div className="filter-row">
        <label htmlFor="level-filter">Level</label>
        <select id="level-filter" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {LEVELS.map((item) => (
            <option key={item} value={item}>
              {capitalize(item)}
            </option>
          ))}
        </select>
      </div>

      <ReelGridList
        paged={paged}
        emptyTitle="No reels here yet"
        emptyMessage="Try another level or topic."
        emptyAction={
          <Link className="btn btn-ghost" to="/categories">
            All topics
          </Link>
        }
      />
    </div>
  );
}
