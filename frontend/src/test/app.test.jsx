import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { apiError, baseRoutes, makeReel, makeUser, mockApi, ok, pagination, renderApp } from './helpers';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('guest experience', () => {
  it('shows the landing page and loads topics from the API', async () => {
    mockApi(baseRoutes());
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /learn computer science/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'DSA' })).toHaveAttribute('href', '/category/dsa');
    expect(screen.getByRole('link', { name: /create free account/i })).toBeInTheDocument();
  });

  it('lets a guest watch the feed, but asks them to log in to like', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /reels': () => ok({ reels: [makeReel()], pagination: pagination() }),
    });
    renderApp('/feed');

    expect(await screen.findByRole('heading', { name: 'Binary search intuition' })).toBeInTheDocument();
    expect(screen.getByText('#search')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/reels', { params: { page: 1, limit: 8 } });

    await userEvent.click(screen.getByRole('button', { name: /like this reel/i }));
    expect(await screen.findByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith('/reels/r1/like');
  });

  it('shows an empty state when there are no reels', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels': () => ok({ reels: [], pagination: { ...pagination(0) } }) });
    renderApp('/feed');
    expect(await screen.findByText(/no reels yet/i)).toBeInTheDocument();
  });

  it('shows a readable error with a retry button when the feed fails', async () => {
    let calls = 0;
    mockApi({
      ...baseRoutes(),
      'GET /reels': () => {
        calls += 1;
        return calls === 1 ? apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.') : ok({ reels: [makeReel()], pagination: pagination() });
      },
    });
    renderApp('/feed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Binary search intuition' })).toBeInTheDocument();
  });

  it('redirects guests away from protected pages', async () => {
    mockApi(baseRoutes());
    renderApp('/saved');
    expect(await screen.findByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('searches and lists results, and handles no results', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /reels/search': (config) =>
        config.params.q === 'binary'
          ? ok({ reels: [makeReel()], pagination: pagination() })
          : ok({ reels: [], pagination: pagination(0) }),
    });
    renderApp('/search?q=binary');
    const link = await screen.findByRole('link', { name: /binary search intuition/i });
    expect(link).toHaveAttribute('href', '/reels/r1');
    expect(screen.getByText(/1 result/i)).toBeInTheDocument();
  });

  it('shows "no reels found" for a search with no matches', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels/search': () => ok({ reels: [], pagination: pagination(0) }) });
    renderApp('/search?q=zzz');
    expect(await screen.findByText(/no reels found/i)).toBeInTheDocument();
  });

  it('shows a category page with its reels', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels': (c) => ok({ reels: c.params.category === 'dsa' ? [makeReel()] : [], pagination: pagination() }) });
    renderApp('/category/dsa');
    expect(await screen.findByRole('link', { name: /binary search intuition/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'DSA' })).toBeInTheDocument();
  });

  it('shows a not found page for unknown URLs', async () => {
    mockApi(baseRoutes());
    renderApp('/nope');
    expect(await screen.findByText(/page not found/i)).toBeInTheDocument();
  });
});

describe('authentication screens', () => {
  it('validates registration on the client before calling the API', async () => {
    mockApi(baseRoutes());
    renderApp('/register');
    await userEvent.type(await screen.findByLabelText('Name'), 'Soni');
    await userEvent.type(screen.getByLabelText('Email'), 'soni@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'onlyletters');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/letter and one number/i);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('registers, logs the user in and leaves the form', async () => {
    mockApi({
      ...baseRoutes(),
      'POST /auth/register': () => ok({ user: makeUser() }),
      'GET /reels': () => ok({ reels: [], pagination: pagination(0) }),
    });
    renderApp('/register');
    await userEvent.type(await screen.findByLabelText('Name'), 'Soni Singh');
    await userEvent.type(screen.getByLabelText('Email'), 'soni@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd123');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/register', { name: 'Soni Singh', email: 'soni@example.com', password: 'Passw0rd123' }));
    expect(await screen.findByText(/no reels yet/i)).toBeInTheDocument();
    expect(await screen.findByText(/welcome to cs reels/i)).toBeInTheDocument();
  });

  it('shows the server message for a wrong password', async () => {
    mockApi({ ...baseRoutes(), 'POST /auth/login': () => apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.') });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'soni@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('sends a logged-in user to where they were going after login', async () => {
    let loggedIn = false;
    mockApi({
      'GET /auth/me': () => (loggedIn ? ok({ user: makeUser() }) : apiError(401, 'UNAUTHORIZED', 'Please log in to continue.')),
      'GET /categories': () => ok({ categories: [] }),
      'POST /auth/login': () => {
        loggedIn = true;
        return ok({ user: makeUser() });
      },
      'GET /users/me/saved': () => ok({ reels: [makeReel()], pagination: pagination() }),
    });
    renderApp('/saved');
    await userEvent.type(await screen.findByLabelText('Email'), 'soni@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd123');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('heading', { name: /saved reels/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /binary search intuition/i })).toBeInTheDocument();
  });
});

describe('logged-in interactions', () => {
  const loggedIn = () => ({
    ...baseRoutes(makeUser()),
    'GET /reels': () => ok({ reels: [makeReel()], pagination: pagination() }),
  });

  it('likes a reel instantly and keeps the count the server returns', async () => {
    mockApi({ ...loggedIn(), 'POST /reels/r1/like': () => ok({ liked: true, likesCount: 4 }) });
    renderApp('/feed');
    const button = await screen.findByRole('button', { name: /like this reel/i });
    expect(button).toHaveTextContent('3');
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole('button', { name: /unlike this reel/i })).toHaveTextContent('4'));
    expect(api.post).toHaveBeenCalledWith('/reels/r1/like');
  });

  it('rolls the like back and shows a message when the server fails', async () => {
    mockApi({ ...loggedIn(), 'POST /reels/r1/like': () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.') });
    renderApp('/feed');
    await userEvent.click(await screen.findByRole('button', { name: /like this reel/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /like this reel/i })).toHaveTextContent('3');
  });

  it('saves and unsaves a reel', async () => {
    mockApi({
      ...loggedIn(),
      'POST /reels/r1/save': () => ok({ saved: true, savesCount: 2 }),
      'DELETE /reels/r1/save': () => ok({ saved: false, savesCount: 1 }),
    });
    renderApp('/feed');
    await userEvent.click(await screen.findByRole('button', { name: /save this reel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /remove from saved/i }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/reels/r1/save'));
    expect(await screen.findByRole('button', { name: /save this reel/i })).toBeInTheDocument();
  });

  it('sends a report from the report dialog', async () => {
    mockApi({ ...loggedIn(), 'POST /reels/r1/report': () => Promise.resolve({ data: { success: true, message: 'Thanks. Your report was sent to the admin.' } }) });
    renderApp('/feed');
    await userEvent.click(await screen.findByRole('button', { name: /report this reel/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/what is wrong/i), 'copyright');
    await userEvent.click(within(dialog).getByRole('button', { name: /send report/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reels/r1/report', { reason: 'copyright', details: undefined }));
    expect(await screen.findByText(/report was sent/i)).toBeInTheDocument();
  });

  it('shows the profile with activity counts', async () => {
    mockApi({ ...baseRoutes(makeUser()), 'GET /users/me': () => ok({ user: makeUser(), stats: { savedCount: 2, likedCount: 5 } }) });
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: 'Soni Singh' })).toBeInTheDocument();
    expect(await screen.findByText('5')).toBeInTheDocument();
  });
});

describe('reel detail, AI explainer and quiz', () => {
  const routes = () => ({
    ...baseRoutes(makeUser()),
    'GET /reels/r1': () => ok({ reel: makeReel() }),
    'GET /reels/r1/related': () => ok({ reels: [makeReel({ id: 'r2', title: 'Two pointers' })] }),
  });

  it('shows the reel, resources and related reels', async () => {
    mockApi(routes());
    renderApp('/reels/r1');
    expect(await screen.findByRole('heading', { name: 'Binary search intuition', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MDN docs' })).toHaveAttribute('target', '_blank');
    expect(await screen.findByRole('link', { name: /two pointers/i })).toBeInTheDocument();
  });

  it('shows a friendly message for a missing reel', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels/r9': () => apiError(404, 'REEL_NOT_FOUND', 'This reel was not found.'), 'GET /reels/r9/related': () => apiError(404, 'REEL_NOT_FOUND', 'nope') });
    renderApp('/reels/r9');
    expect(await screen.findByRole('alert')).toHaveTextContent('This reel was not found.');
  });

  it('asks the AI to explain and shows the answer, and shows AI errors', async () => {
    let n = 0;
    mockApi({
      ...routes(),
      'POST /ai/reels/r1/explain': () => {
        n += 1;
        return n === 1 ? ok({ explanation: 'Think of a phone book.', mode: 'simple' }) : apiError(429, 'AI_RATE_LIMITED', 'The AI service is busy right now. Please try again in a minute.');
      },
    });
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /explain simply/i }));
    expect(await screen.findByText('Think of a phone book.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai/reels/r1/explain', { mode: 'simple' }, expect.any(Object));
    await userEvent.click(screen.getByRole('button', { name: /explain in detail/i }));
    expect(await screen.findByText(/ai service is busy/i)).toBeInTheDocument();
  });

  it('runs a quiz end to end and shows the score', async () => {
    mockApi({
      ...routes(),
      'POST /ai/reels/r1/quiz': () =>
        ok({
          quiz: {
            reelId: 'r1',
            questions: [
              { question: 'What does binary search need?', options: ['Sorted data', 'A graph', 'A hash', 'Nothing'], correctIndex: 0, explanation: 'It halves a sorted range.' },
              { question: 'Its time complexity?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'], correctIndex: 1, explanation: 'The range halves each step.' },
            ],
          },
        }),
    });
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /generate quiz/i }));
    const submit = await screen.findByRole('button', { name: /submit answers/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Sorted data'));
    await userEvent.click(screen.getByLabelText('O(n)'));
    await userEvent.click(submit);
    expect(await screen.findByText(/you scored 1 \/ 2/i)).toBeInTheDocument();
    expect(screen.getByText('The range halves each step.')).toBeInTheDocument();
  });

  it('tells guests to log in for AI features', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels/r1': () => ok({ reel: makeReel() }), 'GET /reels/r1/related': () => ok({ reels: [] }) });
    renderApp('/reels/r1');
    expect(await screen.findByText(/to use the ai explainer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate quiz/i })).not.toBeInTheDocument();
  });
});

describe('AI tutor chat', () => {
  it('sends a question with the conversation and shows the reply', async () => {
    mockApi({ ...baseRoutes(makeUser()), 'POST /ai/chat': () => ok({ reply: 'A thread shares memory with its process.' }) });
    renderApp('/chat');
    await userEvent.type(await screen.findByLabelText(/your question/i), 'What is a thread?');
    await userEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText('A thread shares memory with its process.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai/chat', { messages: [{ role: 'user', content: 'What is a thread?' }] }, expect.any(Object));
  });

  it('shows an error and retries the same question', async () => {
    let n = 0;
    mockApi({
      ...baseRoutes(makeUser()),
      'POST /ai/chat': () => {
        n += 1;
        return n === 1 ? apiError(503, 'AI_NOT_CONFIGURED', 'AI features are not configured on the server (missing GEMINI_API_KEY).') : ok({ reply: 'Second try works.' });
      },
    });
    renderApp('/chat');
    await userEvent.type(await screen.findByLabelText(/your question/i), 'Hello?');
    await userEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not configured/i);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Second try works.')).toBeInTheDocument();
    expect(screen.getAllByText('Hello?')).toHaveLength(1);
  });
});

describe('admin area', () => {
  it('blocks normal users from the admin area', async () => {
    mockApi(baseRoutes(makeUser()));
    renderApp('/admin');
    expect(await screen.findByText(/admins only/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/admin/stats');
  });

  it('sends guests to log in', async () => {
    mockApi(baseRoutes());
    renderApp('/admin/upload');
    expect(await screen.findByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('shows dashboard statistics to admins', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /admin/stats': () => ok({ stats: { users: 7, publishedReels: 12, draftReels: 2, likes: 30, saves: 11, openReports: 1, categories: 6 }, topReels: [makeReel()] }),
    });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Binary search intuition' })).toBeInTheDocument();
  });

  it('rejects a wrong file type on the upload page and requires a video', async () => {
    mockApi(baseRoutes(makeUser({ role: 'admin' })));
    renderApp('/admin/upload');
    const input = await screen.findByLabelText(/^video/i);
    await userEvent.upload(input, new File(['hello'], 'notes.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/mp4 or webm/i);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('uploads a reel with the right form fields', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'POST /admin/reels': () => ok({ reel: makeReel() }),
      'GET /admin/reels': () => ok({ reels: [], pagination: pagination(0) }),
      'GET /categories': () => ok({ categories: [{ id: 'c1', name: 'DSA', slug: 'dsa', description: '', reelCount: 0 }] }),
    });
    renderApp('/admin/upload');
    await userEvent.upload(await screen.findByLabelText(/^video/i), new File(['x'], 'clip.mp4', { type: 'video/mp4' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Hash maps in 60 seconds');
    await userEvent.type(screen.getByLabelText('Description'), 'How a hash map finds a value instantly.');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'c1');
    await userEvent.type(screen.getByLabelText(/^tags/i), 'hashing, maps');
    await userEvent.click(screen.getByRole('button', { name: /upload reel/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe('/admin/reels');
    expect(body.get('title')).toBe('Hash maps in 60 seconds');
    expect(body.get('category')).toBe('c1');
    expect(JSON.parse(body.get('tags'))).toEqual(['hashing', 'maps']);
    expect(body.get('video')).toBeInstanceOf(File);
    expect(config.timeout).toBeGreaterThan(60000);
  });

  it('manages reels: publish toggle and delete', async () => {
    const draft = makeReel({ status: 'draft' });
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /admin/reels': () => ok({ reels: [draft], pagination: pagination() }),
      'PATCH /admin/reels/r1': () => ok({ reel: { ...draft, status: 'published' } }),
      'DELETE /admin/reels/r1': () => Promise.resolve({ data: { success: true } }),
    });
    renderApp('/admin/reels');
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/reels/r1', { status: 'published' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/reels/r1'));
  });

  it('shows the readable server error when a category is still in use', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /admin/reels': () => ok({ reels: [], pagination: pagination(0) }),
      'DELETE /admin/categories/c1': () => apiError(409, 'CATEGORY_IN_USE', 'This category is used by 3 reel(s). Move or delete those reels first.'),
    });
    renderApp('/admin/reels');
    await userEvent.click(await screen.findByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/used by 3 reel/i)).toBeInTheDocument();
  });
});
