import { useEffect, useState } from 'react';
import { getCategories } from '../services/reelService';
import { getErrorMessage } from '../utils/errors';

export function useCategories() {
  const [state, setState] = useState({ categories: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => {
        if (!cancelled) setState({ categories: data.categories, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ categories: [], loading: false, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
