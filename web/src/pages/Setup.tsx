import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { api, type SetupStatus } from '../lib/api';

type SetupPageProps = {
  setup: SetupStatus;
  onSuccess: () => void;
};

function SetupPage({ setup, onSuccess }: SetupPageProps) {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (setup.isInitialized) {
    return <Navigate to="/login" replace />;
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.initialize({
        email: form.email,
        username: form.username,
        password: form.password,
        displayName: form.displayName || undefined,
      });
      onSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page page-setup">
      <section className="hero-card accent-card">
        <div className="eyebrow">Initial setup</div>
        <h1>Initialize your nodew-api workspace</h1>
        <p>
          This is the first-run flow inspired by new-api: create the initial admin account,
          complete bootstrap, and enter the console.
        </p>
      </section>

      <section className="panel">
        <h2>Create the first administrator</h2>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
          </label>
          <label>
            <span>Username</span>
            <input value={form.username} onChange={(e) => updateField('username', e.target.value)} required />
          </label>
          <label>
            <span>Display name</span>
            <input value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
            />
          </label>

          {error ? <div className="message error">{error}</div> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Initializing...' : 'Initialize system'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default SetupPage;
