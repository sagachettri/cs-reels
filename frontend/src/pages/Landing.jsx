import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../hooks/useCategories';
import { usePageTitle } from '../hooks/usePageTitle';

const STEPS = [
  { title: 'Watch', text: 'Short vertical videos, each teaching exactly one computer science idea.' },
  { title: 'Save', text: 'Like reels and save the ones you want to revise before an exam or interview.' },
  { title: 'Go deeper', text: 'Every reel can link to docs, articles and practice problems for the full picture.' },
  { title: 'Test yourself', text: 'Ask the AI to explain a reel more simply or to quiz you on it.' },
];

export default function Landing() {
  usePageTitle('');
  const { user } = useAuth();
  const { categories } = useCategories();

  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Short-form learning for CS students</p>
        <h1>
          Learn computer science <span className="gradient-text">one reel at a time</span>
        </h1>
        <p className="hero-sub">
          Swipe through bite-sized videos on DSA, web development, core CS and career tips, built for the minutes
          between classes, not for endless scrolling.
        </p>
        <div className="button-row center-row">
          <Link to="/feed" className="btn btn-primary btn-lg">
            Start watching
          </Link>
          {!user && (
            <Link to="/register" className="btn btn-ghost btn-lg">
              Create free account
            </Link>
          )}
        </div>
      </section>

      <section className="page-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <div className="steps">
          {STEPS.map((step, index) => (
            <div className="card step" key={step.title}>
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="page-section" aria-labelledby="topics-heading">
          <h2 id="topics-heading">Pick a topic</h2>
          <div className="chips chips-wrap">
            {categories.map((category) => (
              <Link key={category.id} to={`/category/${category.slug}`} className="chip">
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="site-footer">
        <p className="muted small">CS Reels · an academic project</p>
      </footer>
    </div>
  );
}
