import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateQuiz } from '../services/aiService';
import { getErrorMessage } from '../utils/errors';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';

export default function QuizPanel({ reelId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await generateQuiz(reelId);
      setQuestions(data.quiz.questions);
      setAnswers({});
      setSubmitted(false);
    } catch (err) {
      setError(getErrorMessage(err, 'The quiz could not be created right now.'));
    } finally {
      setLoading(false);
    }
  }

  const score = questions ? questions.filter((q, i) => answers[i] === q.correctIndex).length : 0;
  const allAnswered = questions && questions.every((_, i) => answers[i] !== undefined);

  return (
    <section className="card" aria-labelledby="quiz-heading">
      <h2 id="quiz-heading">Test yourself</h2>
      <p className="muted small">An AI-written quiz based on this reel&apos;s text details.</p>

      {!user && (
        <p>
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          to take the quiz.
        </p>
      )}

      {user && !questions && !loading && (
        <button type="button" className="btn btn-primary" onClick={load}>
          Generate quiz
        </button>
      )}

      {loading && <Loader label="Writing your quiz…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {questions && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          {questions.map((q, qIndex) => (
            <fieldset key={q.question} className="quiz-question" disabled={submitted}>
              <legend>
                {qIndex + 1}. {q.question}
              </legend>
              {q.options.map((option, oIndex) => {
                const chosen = answers[qIndex] === oIndex;
                let state = '';
                if (submitted && oIndex === q.correctIndex) state = 'is-correct';
                else if (submitted && chosen) state = 'is-wrong';
                return (
                  <label key={option} className={`quiz-option ${state}`}>
                    <input
                      type="radio"
                      name={`q-${qIndex}`}
                      checked={chosen}
                      onChange={() => setAnswers((a) => ({ ...a, [qIndex]: oIndex }))}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
              {submitted && <p className="quiz-explain">{q.explanation}</p>}
            </fieldset>
          ))}

          {!submitted ? (
            <button type="submit" className="btn btn-primary" disabled={!allAnswered}>
              Submit answers
            </button>
          ) : (
            <div className="quiz-result" role="status">
              <strong>
                You scored {score} / {questions.length}
              </strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                Try again
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
