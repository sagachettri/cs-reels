import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

const initialState = { items: [], page: 0, hasMore: false, total: 0, loading: true, loadingMore: false, error: '' };

// Loads a paginated list of reels. `fetchPage(page)` must return { reels, pagination }.
// Whenever `key` changes (new category, new search...) the list restarts from page 1.
export function usePagedReels(fetchPage, key) {
  const [state, setState] = useState(initialState);
  const fetchRef = useRef(fetchPage);
  const stateRef = useRef(state);
  const requestId = useRef(0);
  fetchRef.current = fetchPage;
  stateRef.current = state;

  const load = useCallback(async (page, replace) => {
    const id = ++requestId.current; // older responses are ignored if a newer request started
    setState((s) => ({ ...(replace ? initialState : s), loading: replace, loadingMore: !replace, error: '' }));
    try {
      const data = await fetchRef.current(page);
      if (id !== requestId.current) return;
      setState((s) => {
        const existing = replace ? [] : s.items;
        const fresh = data.reels.filter((reel) => !existing.some((item) => item.id === reel.id));
        return {
          items: [...existing, ...fresh],
          page,
          hasMore: data.pagination.hasMore,
          total: data.pagination.total,
          loading: false,
          loadingMore: false,
          error: '',
        };
      });
    } catch (error) {
      if (id !== requestId.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        error: getErrorMessage(error, 'Could not load reels.'),
      }));
    }
  }, []);

  useEffect(() => {
    load(1, true);
  }, [key, load]);

  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (!s.hasMore || s.loading || s.loadingMore || s.error) return;
    load(s.page + 1, false);
  }, [load]);

  const retry = useCallback(() => {
    const s = stateRef.current;
    if (s.items.length === 0) load(1, true);
    else load(s.page + 1, false);
  }, [load]);

  const updateItem = useCallback((id, patch) => {
    setState((s) => ({ ...s, items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }, []);

  return { ...state, loadMore, retry, updateItem };
}
