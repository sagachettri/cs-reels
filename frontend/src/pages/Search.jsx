import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchReels } from '../services/reelService';
import { usePagedReels } from '../hooks/usePagedReels';
import { useCategories } from '../hooks/useCategories';
import { usePageTitle } from '../hooks/usePageTitle';
import CategoryChips from '../components/CategoryChips';
import ReelGridList from '../components/ReelGridList';
import EmptyState from '../components/EmptyState';

function Results({ q }) {
  const paged = usePagedReels((page) => searchReels({ q, page, limit: 12 }), q);
  return (
    <>
      {!paged.loading && !paged.error && <p className="muted">{paged.total} result(s) for &ldquo;{q}&rdquo;</p>}
      <ReelGridList
        paged={paged}
        emptyTitle="No reels found"
        emptyMessage="Try a different word, a tag like “arrays”, or a topic name."
      />
    </>
  );
}

export default function Search() {
  usePageTitle('Search');
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [text, setText] = useState(q);
  const { categories } = useCategories();

  useEffect(() => setText(q), [q]);

  function handleSubmit(event) {
    event.preventDefault();
    const next = text.trim();
    if (next) setParams({ q: next });
  }

  return (
    <div className="page">
      <h1>Search</h1>
      <form className="search-form" onSubmit={handleSubmit} role="search">
        <label htmlFor="search-input" className="sr-only">
          Search by title, description, tag or topic
        </label>
        <input
          id="search-input"
          type="search"
          placeholder="Search by title, tag or topic…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={100}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {q ? (
        <Results q={q} />
      ) : (
        <>
          <EmptyState title="What do you want to learn?" message="Type a word above or pick a topic." />
          <CategoryChips categories={categories} />
        </>
      )}
    </div>
  );
}
