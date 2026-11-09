import { Link } from 'react-router-dom';

export default function CategoryChips({ categories, activeSlug }) {
  if (!categories || categories.length === 0) return null;
  return (
    <nav className="chips" aria-label="Topics">
      <Link to="/feed" className={`chip ${!activeSlug ? 'chip-active' : ''}`}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/category/${category.slug}`}
          className={`chip ${activeSlug === category.slug ? 'chip-active' : ''}`}
          aria-current={activeSlug === category.slug ? 'page' : undefined}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
