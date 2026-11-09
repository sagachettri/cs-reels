import { Link } from 'react-router-dom';
import { getLikedReels } from '../services/reelService';
import { usePagedReels } from '../hooks/usePagedReels';
import { usePageTitle } from '../hooks/usePageTitle';
import ReelGridList from '../components/ReelGridList';

export default function Liked() {
  usePageTitle('Liked reels');
  const paged = usePagedReels((page) => getLikedReels({ page, limit: 12 }), 'Liked');

  return (
    <div className="page">
      <h1>Liked reels</h1>
      <ReelGridList
        paged={paged}
        emptyTitle="Nothing here yet"
        emptyMessage="Reels you like will show up here."
        emptyAction={
          <Link className="btn btn-primary" to="/feed">
            Browse reels
          </Link>
        }
      />
    </div>
  );
}
