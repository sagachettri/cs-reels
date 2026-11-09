import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errors';

function validate({ name, email, password }) {
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password needs at least one letter and one number.';
  return '';
}

export default function Register() {
  usePageTitle('Sign up');
  const { register } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      showToast(`Welcome to CS Reels, ${user.name.split(' ')[0]}!`, 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account.'));
      setSubmitting(false);
    }
  }

  return (
    <div className="page narrow">
      <div className="card">
        <h1>Create your account</h1>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="reg-name">Name</label>
          <input
            id="reg-name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            aria-describedby="reg-password-hint"
            required
          />
          <p id="reg-password-hint" className="muted small">
            At least 8 characters, with a letter and a number.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="muted small center">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
