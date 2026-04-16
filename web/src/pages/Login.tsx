import { useState } from 'react';

import { api } from '../lib/api';

type LoginPageProps = {
  onSuccess: () => void;
};

function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.login({ email, password });
      onSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page page-login">
      <section className="hero-card">
        <div className="eyebrow">Sign in</div>
        <h1>Welcome back to nodew-api</h1>
        <p>
          This login page follows the new-api entry flow: sign in first, then enter the home
          console.
        </p>
      </section>

      <section className="panel auth-panel">
        <h2>Administrator login</h2>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error ? <div className="message error">{error}</div> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
