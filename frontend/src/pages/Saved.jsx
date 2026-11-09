import { Link } from 'react-router-dom';
import { getSavedReels } from '../services/reelService';
import { usePagedReels } from '../hooks/usePagedReels';
import { usePageTitle } from '../hooks/usePageTitle';
import ReelGridList from '../components/ReelGridList';

export default function Saved() {
  usePageTitle('Saved reels');
  const paged = usePagedReels((page) => getSavedReels({ page, limit: 12 }), 'Saved');

  return (
    <div className="page">
      <h1>Saved reels</h1>
      <ReelGridList
        paged={paged}
        emptyTitle="Nothing here yet"
        emptyMessage="Tap the bookmark on any reel to keep it here for later."
        emptyAction={
          <Link className="btn btn-primary" to="/feed">
            Browse reels
          </Link>
        }
      />
    </div>
  );
}
