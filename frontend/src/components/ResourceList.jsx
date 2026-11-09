import { capitalize } from '../utils/format';

export default function ResourceList({ resources }) {
  if (!resources || resources.length === 0) return null;
  return (
    <section className="card" aria-labelledby="resources-heading">
      <h2 id="resources-heading">Go deeper</h2>
      <ul className="resource-list">
        {resources.map((resource) => (
          <li key={`${resource.url}-${resource.title}`}>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              {resource.title}
            </a>
            <span className="badge">{capitalize(resource.type)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
