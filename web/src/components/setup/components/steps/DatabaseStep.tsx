type DatabaseStepProps = {
  hasAdmin: boolean;
};

function DatabaseStep({ hasAdmin }: DatabaseStepProps) {
  return (
    <div className="setup-step-content">
      <div className="setup-banner success">
        <strong>Database check</strong>
        <p>
          nodew-api is currently configured to use PostgreSQL. The backend database is already
          reachable and ready for initialization.
        </p>
      </div>

      <div className="setup-info-grid">
        <div className="setup-info-card">
          <h3>Storage engine</h3>
          <p>PostgreSQL</p>
        </div>
        <div className="setup-info-card">
          <h3>Admin present</h3>
          <p>{hasAdmin ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="setup-helper-text">
        <p>
          This step mirrors new-api&apos;s first-run database confirmation: verify runtime storage,
          confirm the environment, then continue to initialize the first administrator.
        </p>
      </div>
    </div>
  );
}

export default DatabaseStep;
