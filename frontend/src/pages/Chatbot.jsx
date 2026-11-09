import { useEffect, useRef, useState } from 'react';
import { askTutor } from '../services/aiService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errors';
import Loader from '../components/Loader';

const STARTERS = [
  'Explain Big-O notation simply',
  'What is the difference between a process and a thread?',
  'How does a hash map work?',
  'What is REST?',
];

// The server accepts at most 12 messages and the first one should come from the user.
function buildRequestMessages(messages) {
  const recent = messages.slice(-11);
  const firstUser = recent.findIndex((m) => m.role === 'user');
  return recent.slice(firstUser === -1 ? 0 : firstUser).map(({ role, content }) => ({ role, content }));
}

export default function Chatbot() {
  usePageTitle('AI Tutor');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
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
      const data = await askTutor(buildRequestMessages(next));
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

  function handleSubmit(event) {
    event.preventDefault();
    send(input);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  return (
    <div className="page chat-page">
      <h1>AI Tutor</h1>
      <p className="muted small">
        Ask any computer science question. Answers are written by an AI and can contain mistakes, so double-check
        important facts.
      </p>

      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-starters">
            <p className="muted">Try one of these:</p>
            {STARTERS.map((starter) => (
              <button key={starter} type="button" className="chip" onClick={() => send(starter)}>
                {starter}
              </button>
            ))}
          </div>
        )}
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

      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="chat-input"
          rows={2}
          maxLength={1000}
          placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
