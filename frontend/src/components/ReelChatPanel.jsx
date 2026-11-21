import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { askAboutReel } from '../services/aiService';
import { buildRequestMessages } from '../utils/chat';
import { getErrorMessage } from '../utils/errors';
import Loader from './Loader';

const STARTERS = [
  'Explain this step by step',
  'Give me a simple example',
  'What mistakes do beginners make here?',
  'How is this used in real projects?',
];

// A follow-up conversation about ONE reel. The AI is given the reel's text details, never the video.
export default function ReelChatPanel({ reelId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading, error]);

  async function send(text, baseMessages = messages) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...baseMessages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const data = await askAboutReel(reelId, buildRequestMessages(next));
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(getErrorMessage(err, 'The AI tutor could not answer right now.'));
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    const last = messages[messages.length - 1];
    if (last?.role === 'user') send(last.content, messages.slice(0, -1));
  }

  return (
    <section className="card" aria-labelledby="reel-chat-heading">
      <h2 id="reel-chat-heading">Ask the AI about this reel</h2>
      <p className="muted small">
        Ask follow-up questions. The AI knows this reel&apos;s title, description, key takeaway, tags and notes (not
        the video itself) and remembers your conversation.
      </p>

      {!user ? (
        <p>
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          to ask questions.
        </p>
      ) : (
        <>
          {messages.length === 0 && (
            <div className="button-row">
              {STARTERS.map((starter) => (
                <button key={starter} type="button" className="chip" onClick={() => send(starter)} disabled={loading}>
                  {starter}
                </button>
              ))}
            </div>
          )}

          <div className="mini-chat" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`bubble bubble-${message.role}`}>
                <span className="sr-only">{message.role === 'user' ? 'You: ' : 'Tutor: '}</span>
                {message.content}
              </div>
            ))}
            {loading && <Loader label="Thinking…" />}
            {error && (
              <div className="error-box" role="alert">
                <p>{error}</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
                  Try again
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="chat-form chat-form-inline"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="reel-chat-input" className="sr-only">
              Your question about this reel
            </label>
            <textarea
              id="reel-chat-input"
              rows={2}
              maxLength={1000}
              placeholder="Ask about this reel…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
              Ask
            </button>
          </form>
          {messages.length > 0 && (
            <button type="button" className="link-btn" onClick={() => setMessages([])}>
              Clear conversation
            </button>
          )}
        </>
      )}
    </section>
  );
}
