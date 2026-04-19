import type { CurrentUser, ServiceStatus } from '../lib/api';

type HomePageProps = {
  user: CurrentUser;
  status: ServiceStatus;
  onLogout: () => Promise<void>;
};

function HomePage({ user, status, onLogout }: HomePageProps) {
  return (
    <main className="page page-home">
      <section className="hero-card home-hero-card accent-card">
        <div className="home-hero-copy">
          <div className="eyebrow">Console</div>
          <h1>Unified model gateway, now in Node</h1>
          <p>
            The first-run console now mirrors the new-api style landing flow: a prominent hero,
            fast service summary, and clear follow-up actions for the administrator.
          </p>
        </div>
        <div className="home-hero-actions">
          <button className="secondary-button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-wide">
        <article className="panel metric-panel">
          <h2>Administrator profile</h2>
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

        <article className="panel metric-panel feature-panel">
          <h2>Ready now</h2>
          <dl>
            <div>
              <dt>Setup</dt>
              <dd>Completed</dd>
            </div>
            <div>
              <dt>Auth session</dt>
              <dd>Active</dd>
            </div>
            <div>
              <dt>API foundation</dt>
              <dd>Online</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel actions-panel">
        <div>
          <h2>Next steps</h2>
          <p>
            The backend setup, login, self profile, and token management APIs are already in place.
            The next frontend milestone is to turn this summary console into a full admin workspace.
          </p>
        </div>
        <div className="actions-inline-note">
          <strong>Current focus</strong>
          <p>Continue expanding the authenticated console around tokens, profile, and runtime data.</p>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
