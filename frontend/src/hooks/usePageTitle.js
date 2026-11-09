import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | CS Reels` : 'CS Reels';
  }, [title]);
}
