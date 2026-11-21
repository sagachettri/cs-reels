import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateQuiz } from '../services/aiService';
import { submitQuiz } from '../services/quizService';
import { getErrorMessage } from '../utils/errors';
import { capitalize } from '../utils/format';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', hint: 'Key terms and the basic idea' },
  { id: 'medium', label: 'Medium', hint: 'Understanding and simple examples' },
  { id: 'hard', label: 'Hard', hint: 'Tricky cases and deeper reasoning' },
];

// Correct answers stay on the server until you submit, so the score can be trusted.
export default function QuizPanel({ reelId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [difficulty, setDifficulty] = useState('medium');
  const [stage, setStage] = useState('setup'); // setup | taking | result
  const [quiz, setQuiz] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setLoading(true);
    setError('');
    try {
      const data = await generateQuiz(reelId, difficulty);
      setQuiz(data.quiz);
      setPrevious(data.previous);
      setAnswers({});
      setResult(null);
      setStage('taking');
    } catch (err) {
      setError(getErrorMessage(err, 'The quiz could not be created right now.'));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ordered = quiz.questions.map((_, index) => answers[index]);
      const data = await submitQuiz(quiz.quizId, ordered);
      setResult(data);
      setPrevious({ attempts: data.attemptNumber, bestPercentage: data.bestPercentage });
      setStage('result');
    } catch (err) {
      setError(getErrorMessage(err, 'Your answers could not be submitted. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
    setError('');
    setStage('taking');
  }

  function chooseAnother() {
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setError('');
    setStage('setup');
  }

  const allAnswered = quiz && quiz.questions.every((_, index) => answers[index] !== undefined);

  return (
    <section className="card" aria-labelledby="quiz-heading">
      <h2 id="quiz-heading">Test yourself</h2>
      <p className="muted small">An AI-written quiz based on this reel&apos;s details. Your scores are saved to your progress.</p>

      {!user && (
        <p>
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          to take the quiz.
        </p>
      )}

      {user && stage === 'setup' && (
        <>
          <fieldset className="difficulty-options" disabled={loading}>
            <legend>Choose a difficulty</legend>
            {DIFFICULTIES.map((item) => (
              <label key={item.id} className={`difficulty-option ${difficulty === item.id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="difficulty"
                  value={item.id}
                  checked={difficulty === item.id}
                  onChange={() => setDifficulty(item.id)}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small className="muted"> {item.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-primary" onClick={start} disabled={loading}>
            Start quiz
          </button>
        </>
      )}

      {loading && <Loader label={stage === 'setup' ? 'Writing your quiz…' : 'Checking your answers…'} />}
      {error && <ErrorMessage message={error} onRetry={stage === 'setup' ? start : undefined} />}

      {user && stage === 'taking' && quiz && (
        <form onSubmit={submit}>
          <p className="muted small">
            {capitalize(quiz.difficulty)} quiz
            {previous?.attempts > 0 && ` · taken ${previous.attempts} time${previous.attempts === 1 ? '' : 's'} · best ${previous.bestPercentage}%`}
          </p>
          {quiz.questions.map((q, qIndex) => (
            <fieldset key={q.question} className="quiz-question" disabled={loading}>
              <legend>
                {qIndex + 1}. {q.question}
              </legend>
              {q.options.map((option, oIndex) => (
                <label key={option} className="quiz-option">
                  <input
                    type="radio"
                    name={`q-${qIndex}`}
                    checked={answers[qIndex] === oIndex}
                    onChange={() => setAnswers((a) => ({ ...a, [qIndex]: oIndex }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="button-row">
            <button type="submit" className="btn btn-primary" disabled={!allAnswered || loading}>
              Submit answers
            </button>
            <button type="button" className="btn btn-ghost" onClick={chooseAnother} disabled={loading}>
              Change difficulty
            </button>
          </div>
        </form>
      )}

      {user && stage === 'result' && result && (
        <div>
          <div className="quiz-result" role="status">
            <strong className="quiz-score">
              You scored {result.score} / {result.total} ({result.percentage}%)
            </strong>
            <span className="muted small">
              {capitalize(result.difficulty)} · attempt {result.attemptNumber} · best {result.bestPercentage}%
            </span>
          </div>

          {result.results.map((item, index) => (
            <div key={item.question} className="quiz-question quiz-review">
              <p className="quiz-q">
                {index + 1}. {item.question}
              </p>
              {item.options.map((option, oIndex) => {
                let state = '';
                if (oIndex === item.correctIndex) state = 'is-correct';
                else if (oIndex === item.selectedIndex) state = 'is-wrong';
                return (
                  <div key={option} className={`quiz-option ${state}`}>
                    <span>
                      {option}
                      {oIndex === item.correctIndex && <span className="sr-only"> (correct answer)</span>}
                      {oIndex === item.selectedIndex && <span className="sr-only"> (your answer)</span>}
                    </span>
                  </div>
                );
              })}
              <p className="quiz-explain">
                <strong>{item.correct ? 'Correct. ' : 'Not quite. '}</strong>
                {item.explanation}
              </p>
            </div>
          ))}

          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={retake}>
              Retake this quiz
            </button>
            <button type="button" className="btn btn-ghost" onClick={chooseAnother}>
              Try another difficulty
            </button>
            <Link to="/progress" className="btn btn-ghost">
              See my progress
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
