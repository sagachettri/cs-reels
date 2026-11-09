import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import api from '../services/api';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

export const ok = (data) => Promise.resolve({ data: { success: true, data } });

export function apiError(status, code, message) {
  return Promise.reject(Object.assign(new Error(message), { response: { status, data: { success: false, error: { code, message } } } }));
}

export const makeUser = (overrides = {}) => ({
  id: 'u1', name: 'Soni Singh', email: 'soni@example.com', role: 'user', createdAt: '2026-01-01T00:00:00Z', ...overrides,
});

export const makeReel = (overrides = {}) => ({
  id: 'r1',
  title: 'Binary search intuition',
  description: 'Why halving the search space is so fast.',
  videoUrl: 'https://ik.example.com/v.mp4',
  thumbnailUrl: 'https://ik.example.com/t.jpg',
  durationSec: 45,
  category: { id: 'c1', name: 'DSA', slug: 'dsa' },
  tags: ['search', 'arrays'],
  level: 'beginner',
  keyTakeaway: 'Halve the range each step.',
  resources: [{ title: 'MDN docs', url: 'https://developer.mozilla.org', type: 'docs' }],
  creator: 'Admin',
  creditName: '',
  status: 'published',
  likesCount: 3,
  savesCount: 1,
  liked: false,
  saved: false,
  createdAt: '2026-02-01T00:00:00Z',
  ...overrides,
});

export const pagination = (total = 1) => ({ page: 1, limit: 8, total, totalPages: 1, hasMore: false });

// routes: { 'GET /reels': (config) => Promise }. Unlisted routes fail loudly so tests never hit a silent gap.
export function mockApi(routes) {
  const handler = (method) => (url, ...args) => {
    const key = `${method} ${url}`;
    const fn = routes[key];
    if (!fn) return Promise.reject(new Error(`Unmocked API call: ${key}`));
    return fn(...args);
  };
  api.get.mockImplementation(handler('GET'));
  api.post.mockImplementation(handler('POST'));
  api.patch.mockImplementation(handler('PATCH'));
  api.delete.mockImplementation(handler('DELETE'));
}

export const baseRoutes = (user = null) => ({
  'GET /auth/me': () => (user ? ok({ user }) : apiError(401, 'UNAUTHORIZED', 'Please log in to continue.')),
  'GET /categories': () => ok({ categories: [{ id: 'c1', name: 'DSA', slug: 'dsa', description: 'Algorithms', reelCount: 1 }] }),
});

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

export { vi };
