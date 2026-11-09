import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { explainReel, summarizeReel } from '../services/aiService';
import { getErrorMessage } from '../utils/errors';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';

const ACTIONS = [
  { id: 'simple', label: 'Explain simply' },
  { id: 'detailed', label: 'Explain in detail' },
  { id: 'summary', label: 'Summarize' },
];

export default function AIExplainPanel({ reelId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ loading: false, error: '', action: '', text: '' });

  async function run(action) {
    setState({ loading: true, error: '', action, text: '' });
    try {
      const data = action === 'summary' ? await summarizeReel(reelId) : await explainReel(reelId, action);
      setState({ loading: false, error: '', action, text: data.summary || data.explanation });
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error, 'The AI could not answer right now.'), action, text: '' });
    }
  }

  return (
    <section className="card" aria-labelledby="ai-explain-heading">
      <h2 id="ai-explain-heading">AI explanation</h2>
      <p className="muted small">
        The AI reads only this reel&apos;s title, description, key takeaway and tags. It does not watch the video.
      </p>

      {!user ? (
        <p>
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          to use the AI explainer.
        </p>
      ) : (
        <div className="button-row">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn btn-sm ${state.action === item.id && state.text ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => run(item.id)}
              disabled={state.loading}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {state.loading && <Loader label="Thinking…" />}
      {state.error && <ErrorMessage message={state.error} onRetry={() => run(state.action)} />}
      {state.text && <p className="ai-answer">{state.text}</p>}
    </section>
  );
}
