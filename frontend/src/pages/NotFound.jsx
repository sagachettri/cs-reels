import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <EmptyState title="Page not found" message="That page does not exist.">
      <Link className="btn btn-primary" to="/feed">
        Back to reels
      </Link>
    </EmptyState>
  );
}
