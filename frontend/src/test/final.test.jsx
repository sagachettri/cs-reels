import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useWatchTracker } from '../hooks/useWatchTracker';
import { apiError, baseRoutes, makeReel, makeUser, mockApi, ok, pagination, renderApp } from './helpers';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

const quizQuestions = [
  { question: 'What does binary search need?', options: ['Sorted data', 'A graph', 'A hash', 'Nothing'] },
  { question: 'Its time complexity?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'] },
];
const detailRoutes = (extra = {}) => ({
  ...baseRoutes(makeUser()),
  'GET /reels/r1': () => ok({ reel: makeReel() }),
  'GET /reels/r1/related': () => ok({ reels: [] }),
  ...extra,
});
const startedQuiz = (difficulty = 'medium', previous = { attempts: 0, bestPercentage: null }) =>
  ok({ quiz: { quizId: 'qz1', reelId: 'r1', difficulty, questions: quizQuestions }, cached: false, previous });
const gradedQuiz = () =>
  ok({
    attemptId: 'at1', difficulty: 'medium', score: 1, total: 2, percentage: 50, attemptNumber: 2, bestPercentage: 100,
    results: [
      { ...quizQuestions[0], selectedIndex: 0, correctIndex: 0, correct: true, explanation: 'It halves a sorted range.' },
      { ...quizQuestions[1], selectedIndex: 0, correctIndex: 1, correct: false, explanation: 'The range halves each step.' },
    ],
  });

describe('adaptive quiz: difficulty, hidden answers, server scoring, retry', () => {
  it('lets the student pick a difficulty and starts the quiz at that level', async () => {
    mockApi(detailRoutes({ 'POST /ai/reels/r1/quiz': () => startedQuiz('hard') }));
    renderApp('/reels/r1');
    expect(await screen.findByLabelText(/medium/i)).toBeChecked();
    await userEvent.click(screen.getByLabelText(/hard/i));
    await userEvent.click(screen.getByRole('button', { name: /start quiz/i }));
    expect(await screen.findByText(/hard quiz/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai/reels/r1/quiz', { difficulty: 'hard' }, expect.any(Object));
  });

  it('shows no answers while taking the quiz, and needs every question answered', async () => {
    mockApi(detailRoutes({ 'POST /ai/reels/r1/quiz': () => startedQuiz('medium', { attempts: 2, bestPercentage: 67 }) }));
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /start quiz/i }));
    expect(await screen.findByText(/taken 2 times · best 67%/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(correct answer\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/correct\. |not quite\./i)).not.toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /submit answers/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Sorted data'));
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByLabelText('O(log n)'));
    expect(submit).toBeEnabled();
  });

  it('sends the answers to the server and shows the server\'s score, answers and explanations', async () => {
    mockApi(detailRoutes({
      'POST /ai/reels/r1/quiz': () => startedQuiz(),
      'POST /quizzes/qz1/submit': () => gradedQuiz(),
    }));
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /start quiz/i }));
    await userEvent.click(await screen.findByLabelText('Sorted data'));
    await userEvent.click(screen.getByLabelText('O(n)'));
    await userEvent.click(screen.getByRole('button', { name: /submit answers/i }));

    expect(await screen.findByText(/you scored 1 \/ 2 \(50%\)/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/quizzes/qz1/submit', { answers: [0, 0], tzOffset: expect.any(Number) });
    expect(screen.getByText(/attempt 2 · best 100%/i)).toBeInTheDocument();
    expect(screen.getByText('It halves a sorted range.')).toBeInTheDocument();
    expect(screen.getByText('The range halves each step.')).toBeInTheDocument();
    expect(screen.getByText('Correct.')).toBeInTheDocument();
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    expect(screen.getAllByText(/\(correct answer\)/i)).toHaveLength(2);
    expect(screen.getByRole('link', { name: /see my progress/i })).toHaveAttribute('href', '/progress');
  });

  it('retakes the same quiz or switches difficulty', async () => {
    mockApi(detailRoutes({
      'POST /ai/reels/r1/quiz': () => startedQuiz(),
      'POST /quizzes/qz1/submit': () => gradedQuiz(),
    }));
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /start quiz/i }));
    await userEvent.click(await screen.findByLabelText('Sorted data'));
    await userEvent.click(screen.getByLabelText('O(n)'));
    await userEvent.click(screen.getByRole('button', { name: /submit answers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /retake this quiz/i }));

    expect(await screen.findByRole('button', { name: /submit answers/i })).toBeDisabled();
    expect(screen.getByLabelText('Sorted data')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /change difficulty/i }));
    expect(await screen.findByRole('button', { name: /start quiz/i })).toBeInTheDocument();
  });

  it('keeps the answers and shows a message if submitting fails', async () => {
    mockApi(detailRoutes({
      'POST /ai/reels/r1/quiz': () => startedQuiz(),
      'POST /quizzes/qz1/submit': () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.'),
    }));
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /start quiz/i }));
    await userEvent.click(await screen.findByLabelText('Sorted data'));
    await userEvent.click(screen.getByLabelText('O(log n)'));
    await userEvent.click(screen.getByRole('button', { name: /submit answers/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.getByLabelText('Sorted data')).toBeChecked();
    expect(screen.getByRole('button', { name: /submit answers/i })).toBeEnabled();
  });
});

describe('AI concept explainer for one reel (follow-up chat)', () => {
  it('answers a starter question and remembers the conversation for follow-ups', async () => {
    let call = 0;
    mockApi(detailRoutes({
      'POST /ai/reels/r1/chat': () => {
        call += 1;
        return ok({ reply: call === 1 ? 'Step one: sort the list.' : 'For example, search 7 in [1,3,7,9].' });
      },
    }));
    renderApp('/reels/r1');
    await userEvent.click(await screen.findByRole('button', { name: /explain this step by step/i }));
    expect(await screen.findByText('Step one: sort the list.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/your question about this reel/i), 'Show an example');
    await userEvent.click(screen.getByRole('button', { name: /^ask$/i }));
    expect(await screen.findByText(/search 7 in/i)).toBeInTheDocument();

    expect(api.post).toHaveBeenLastCalledWith(
      '/ai/reels/r1/chat',
      {
        messages: [
          { role: 'user', content: 'Explain this step by step' },
          { role: 'assistant', content: 'Step one: sort the list.' },
          { role: 'user', content: 'Show an example' },
        ],
      },
      expect.any(Object)
    );
  });

  it('shows an error and retries the same question', async () => {
    let call = 0;
    mockApi(detailRoutes({
      'POST /ai/reels/r1/chat': () => {
        call += 1;
        return call === 1 ? apiError(429, 'AI_RATE_LIMITED', 'The AI service is busy right now. Please try again in a minute.') : ok({ reply: 'Back again.' });
      },
    }));
    renderApp('/reels/r1');
    await userEvent.type(await screen.findByLabelText(/your question about this reel/i), 'Why?');
    await userEvent.click(screen.getByRole('button', { name: /^ask$/i }));
    const alert = await screen.findByText(/ai service is busy/i);
    await userEvent.click(within(alert.closest('[role="alert"]')).getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Back again.')).toBeInTheDocument();
    expect(screen.getAllByText('Why?')).toHaveLength(1);
  });

  it('asks guests to log in', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels/r1': () => ok({ reel: makeReel() }), 'GET /reels/r1/related': () => ok({ reels: [] }) });
    renderApp('/reels/r1');
    expect(await screen.findByText(/to ask questions/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your question about this reel/i)).not.toBeInTheDocument();
  });

  it('shows the admin\'s transcript on the reel page when there is one', async () => {
    mockApi(detailRoutes({ 'GET /reels/r1': () => ok({ reel: makeReel({ hasTranscript: true, transcript: 'We compare the middle element first.' }) }) }));
    renderApp('/reels/r1');
    expect(await screen.findByText('Transcript and notes')).toBeInTheDocument();
    expect(screen.getByText('We compare the middle element first.')).toBeInTheDocument();
  });
});

describe('personalised feed', () => {
  const feedRoutes = () => ({
    ...baseRoutes(makeUser()),
    'GET /reels': () => ok({ reels: [makeReel({ title: 'Latest reel' })], pagination: pagination() }),
    'GET /reels/recommended': () =>
      ok({ reels: [makeReel({ id: 'r2', title: 'Picked for you', reason: 'Because you engage with #arrays' })], personalized: true, pagination: pagination() }),
  });

  it('switches to "For you" and explains why each reel was chosen', async () => {
    mockApi(feedRoutes());
    renderApp('/feed');
    expect(await screen.findByRole('heading', { name: 'Latest reel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'For you' }));
    expect(await screen.findByRole('heading', { name: 'Picked for you' })).toBeInTheDocument();
    expect(screen.getByText('Because you engage with #arrays')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/reels/recommended', { params: { page: 1, limit: 8 } });
    await userEvent.click(screen.getByRole('tab', { name: 'Latest' }));
    expect(await screen.findByRole('heading', { name: 'Latest reel' })).toBeInTheDocument();
  });

  it('opens straight on "For you" from a link', async () => {
    mockApi(feedRoutes());
    renderApp('/feed?tab=for-you');
    expect(await screen.findByRole('heading', { name: 'Picked for you' })).toBeInTheDocument();
  });

  it('does not show the tabs to guests', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels': () => ok({ reels: [makeReel()], pagination: pagination() }) });
    renderApp('/feed?tab=for-you');
    expect(await screen.findByRole('heading', { name: 'Binary search intuition' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'For you' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/reels/recommended', expect.anything());
  });
});

describe('learning progress dashboard', () => {
  const progress = {
    summary: {
      reelsWatched: 7, reelsCompleted: 4, watchEvents: 12, quizzesAttempted: 5, distinctQuizzes: 3,
      averageScore: 72, bestScore: 100, savedCount: 3, likedCount: 6, activeDays: 9, currentStreak: 4, longestStreak: 6,
    },
    categories: [
      { id: 'c1', name: 'DSA', slug: 'dsa', totalReels: 10, watched: 5, completed: 3, quizAttempts: 3, averageScore: 90, status: 'strong' },
      { id: 'c2', name: 'Web Development', slug: 'web-development', totalReels: 8, watched: 2, completed: 1, quizAttempts: 2, averageScore: 40, status: 'needs-practice' },
      { id: 'c3', name: 'Core CS', slug: 'core-cs', totalReels: 4, watched: 0, completed: 0, quizAttempts: 0, averageScore: null, status: 'not-started' },
    ],
    weekly: ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'].map((date, i) => ({ date, views: i, quizzes: i % 2 })),
    recentAttempts: [],
  };
  const routes = (extra = {}) => ({
    ...baseRoutes(makeUser()),
    'GET /progress': () => ok(progress),
    'GET /reels/recommended': () => ok({ reels: [makeReel({ id: 'r9', title: 'Next best reel', reason: 'Strengthen Web Development: your quiz average there is 40%' })], personalized: true, pagination: pagination() }),
    'GET /quizzes/attempts': () =>
      ok({
        attempts: [{ id: 'a1', quizId: 'q1', reel: { id: 'r1', title: 'Binary search intuition', thumbnailUrl: '' }, difficulty: 'hard', score: 4, total: 5, percentage: 80, createdAt: '2026-11-09T10:00:00Z' }],
        pagination: { page: 1, limit: 5, total: 1, totalPages: 1, hasMore: false },
      }),
    ...extra,
  });

  it('shows only real numbers from the server', async () => {
    mockApi(routes());
    renderApp('/progress');
    expect(await screen.findByRole('heading', { name: /my learning progress/i })).toBeInTheDocument();
    const stat = (label) => screen.getByText(label).closest('.stat-card');
    expect(within(stat('Reels watched')).getByText('7')).toBeInTheDocument();
    expect(within(stat('Reels watched')).getByText('4 finished')).toBeInTheDocument();
    expect(within(stat('Quizzes taken')).getByText('5')).toBeInTheDocument();
    expect(within(stat('Average quiz score')).getByText('72%')).toBeInTheDocument();
    expect(within(stat('Average quiz score')).getByText('Best 100%')).toBeInTheDocument();
    expect(within(stat('Day streak')).getByText('4')).toBeInTheDocument();
    expect(within(stat('Day streak')).getByText('Longest 6')).toBeInTheDocument();
  });

  it('draws the 7-day chart and a progress bar for every topic with its status', async () => {
    mockApi(routes());
    renderApp('/progress');
    expect(await screen.findAllByRole('listitem', { name: /reels watched/i })).toHaveLength(7);
    expect(screen.getByRole('progressbar', { name: /dsa reels watched/i })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('progressbar', { name: /core cs reels watched/i })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Needs practice')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByText(/watched 2 of 8 reels · quiz average 40% over 2 attempts/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /practice this topic/i })).toHaveAttribute('href', '/category/web-development');
  });

  it('lists quiz history and recommends what to do next, with the reason', async () => {
    mockApi(routes());
    renderApp('/progress');
    expect(await screen.findByText('4/5 (80%)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Binary search intuition' })).toHaveAttribute('href', '/reels/r1');
    expect(await screen.findByText('Strengthen Web Development: your quiz average there is 40%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /full .for you. feed/i })).toHaveAttribute('href', '/feed?tab=for-you');
  });

  it('welcomes a student who has not done anything yet, without fake numbers', async () => {
    const empty = {
      ...progress,
      summary: { ...progress.summary, reelsWatched: 0, reelsCompleted: 0, watchEvents: 0, quizzesAttempted: 0, distinctQuizzes: 0, averageScore: null, bestScore: null, savedCount: 0, likedCount: 0, activeDays: 0, currentStreak: 0, longestStreak: 0 },
      recentAttempts: [],
    };
    mockApi(routes({ 'GET /progress': () => ok(empty) }));
    renderApp('/progress');
    expect(await screen.findByText(/your journey starts here/i)).toBeInTheDocument();
    expect(screen.queryByText('Reels watched')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /watch your first reel/i })).toBeInTheDocument();
  });

  it('shows a readable error with retry, and sends guests to log in', async () => {
    let n = 0;
    mockApi(routes({ 'GET /progress': () => (++n === 1 ? apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.') : ok(progress)) }));
    renderApp('/progress');
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Reels watched')).toBeInTheDocument();
  });

  it('is only for logged-in students', async () => {
    mockApi(baseRoutes());
    renderApp('/progress');
    expect(await screen.findByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
  });
});

describe('watch tracking (counts real watching only)', () => {
  function Probe({ playing, reel = { id: 'r1', durationSec: 30 }, flushOnStop = true }) {
    const { user } = useAuth();
    useWatchTracker(reel, playing, { flushOnStop });
    return <p>{user ? 'ready' : 'waiting'}</p>;
  }
  const setup = async (props, { loggedIn = true } = {}) => {
    mockApi({
      'GET /auth/me': () => (loggedIn ? ok({ user: makeUser() }) : apiError(401, 'UNAUTHORIZED', 'no')),
      'POST /reels/r1/view': () => ok({ viewCount: 1, completed: false }),
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    const view = render(<AuthProvider><Probe {...props} /></AuthProvider>);
    await screen.findByText(loggedIn ? 'ready' : 'waiting');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const rerender = (next) => view.rerender(<AuthProvider><Probe {...next} /></AuthProvider>);
    return { ...view, rerender };
  };
  const advance = (seconds) => vi.setSystemTime(new Date(Date.now() + seconds * 1000));
  const viewCalls = () => api.post.mock.calls.filter(([url]) => url === '/reels/r1/view');

  it('reports watch time when the reel stops being watched', async () => {
    const { rerender } = await setup({ playing: true });
    advance(8);
    rerender({ playing: false });
    expect(viewCalls()).toHaveLength(1);
    expect(viewCalls()[0][1]).toEqual({ watchedSec: 8, completed: false, tzOffset: expect.any(Number) });
  });

  it('marks a reel as finished after watching most of it, and caps the time at its length', async () => {
    const { rerender } = await setup({ playing: true });
    advance(95);
    rerender({ playing: false });
    expect(viewCalls()[0][1]).toMatchObject({ watchedSec: 30, completed: true });
  });

  it('ignores a scroll-past of a couple of seconds', async () => {
    const { rerender } = await setup({ playing: true });
    advance(2);
    rerender({ playing: false });
    expect(viewCalls()).toHaveLength(0);
  });

  it('does not track guests', async () => {
    const { rerender } = await setup({ playing: true }, { loggedIn: false });
    advance(20);
    rerender({ playing: false });
    expect(viewCalls()).toHaveLength(0);
  });

  it('on the detail page, keeps counting across pauses and reports once when leaving', async () => {
    const { rerender, unmount } = await setup({ playing: true, flushOnStop: false });
    advance(5);
    rerender({ playing: false, flushOnStop: false });
    expect(viewCalls()).toHaveLength(0);
    rerender({ playing: true, flushOnStop: false });
    advance(6);
    unmount();
    expect(viewCalls()).toHaveLength(1);
    expect(viewCalls()[0][1]).toMatchObject({ watchedSec: 11 });
  });

  it('counts a reel played on its detail page when the student leaves it', async () => {
    mockApi(detailRoutes({ 'POST /reels/r1/view': () => ok({ viewCount: 1, completed: false }) }));
    const view = renderApp('/reels/r1');
    const video = (await screen.findByRole('heading', { name: 'Binary search intuition', level: 1 })).closest('.detail-main').querySelector('video');
    await new Promise((resolve) => setTimeout(resolve, 30));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    fireEvent.play(video);
    vi.setSystemTime(new Date('2026-11-10T10:00:10Z'));
    view.unmount();
    expect(viewCalls()).toHaveLength(1);
    expect(viewCalls()[0][1]).toMatchObject({ watchedSec: 10, completed: false });
  });
});

describe('admin: transcript for better AI answers', () => {
  it('lets an admin add notes when uploading, and sends them with the reel', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /categories': () => ok({ categories: [{ id: 'c1', name: 'DSA', slug: 'dsa', description: '', reelCount: 0 }] }),
      'POST /admin/reels': () => ok({ reel: makeReel() }),
      'GET /admin/reels': () => ok({ reels: [], pagination: pagination(0) }),
    });
    renderApp('/admin/upload');
    await userEvent.upload(await screen.findByLabelText(/^video/i), new File(['x'], 'clip.mp4', { type: 'video/mp4' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Hash maps in 60 seconds');
    await userEvent.type(screen.getByLabelText('Description'), 'How a hash map finds a value instantly.');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'c1');
    await userEvent.type(screen.getByLabelText(/transcript or notes/i), 'A hash function maps a key to a slot.');
    await userEvent.click(screen.getByRole('button', { name: /upload reel/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].get('transcript')).toBe('A hash function maps a key to a slot.');
  });

  it('shows the saved transcript when editing a reel', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /admin/reels': () => ok({ reels: [makeReel({ hasTranscript: true, transcript: 'Existing notes.' })], pagination: pagination() }),
    });
    renderApp('/admin/reels');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/transcript or notes/i)).toHaveValue('Existing notes.');
  });

  it('shows the new learning statistics on the admin dashboard', async () => {
    mockApi({
      ...baseRoutes(makeUser({ role: 'admin' })),
      'GET /admin/stats': () => ok({ stats: { users: 7, publishedReels: 12, draftReels: 2, likes: 30, saves: 11, openReports: 1, categories: 6, quizAttempts: 41, reelViews: 88 }, topReels: [] }),
    });
    renderApp('/admin');
    expect(await screen.findByText('41')).toBeInTheDocument();
    expect(screen.getByText('Quiz attempts')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('shows Progress to logged-in students only', async () => {
    mockApi({ ...baseRoutes(makeUser()), 'GET /reels': () => ok({ reels: [], pagination: pagination(0) }) });
    renderApp('/feed');
    await screen.findByText(/no reels yet/i);
    expect(screen.getAllByRole('link', { name: 'Progress' }).length).toBeGreaterThan(0);
  });

  it('hides Progress from guests', async () => {
    mockApi({ ...baseRoutes(), 'GET /reels': () => ok({ reels: [], pagination: pagination(0) }) });
    renderApp('/feed');
    await screen.findByText(/no reels yet/i);
    expect(screen.queryByRole('link', { name: 'Progress' })).not.toBeInTheDocument();
  });
});
