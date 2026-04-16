import type { CurrentUser, ServiceStatus } from '../lib/api';

type HomePageProps = {
  user: CurrentUser;
  status: ServiceStatus;
  onLogout: () => Promise<void>;
};

function HomePage({ user, status, onLogout }: HomePageProps) {
  return (
    <main className="page page-home">
      <section className="hero-card accent-card">
        <div className="eyebrow">Home</div>
        <h1>Unified model gateway, now in Node</h1>
        <p>
          This landing view borrows the new-api front-page structure, but points to the backend
          that now runs in this repository.
        </p>
      </section>

      <section className="dashboard-grid">
        <article className="panel metric-panel">
          <h2>Current user</h2>
          <dl>
            <div>
              <dt>Display name</dt>
              <dd>{user.displayName ?? user.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt>Quota used</dt>
              <dd>{user.quotaUsed}</dd>
            </div>
          </dl>
        </article>

        <article className="panel metric-panel">
          <h2>Service status</h2>
          <dl>
            <div>
              <dt>Service</dt>
              <dd>{status.service}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status.status}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{status.version}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel actions-panel">
        <div>
          <h2>Next steps</h2>
          <p>
            The backend setup, login, self profile, and token management APIs are already in place.
            This home page is the first frontend shell to build on top of them.
          </p>
        </div>
        <button className="secondary-button" onClick={() => void onLogout()}>
          Logout
        </button>
      </section>
    </main>
  );
}

export default HomePage;
