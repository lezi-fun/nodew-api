type UsageMode = 'operations' | 'self-hosted' | 'demo';

type CompleteStepProps = {
  email: string;
  username: string;
  usageMode: UsageMode;
};

const usageModeLabels: Record<UsageMode, string> = {
  operations: 'Operations mode',
  'self-hosted': 'Self-use mode',
  demo: 'Demo mode',
};

function CompleteStep({ email, username, usageMode }: CompleteStepProps) {
  return (
    <div className="setup-step-content complete-step">
      <div className="complete-step-badge">✓</div>
      <h3>Ready to initialize</h3>
      <p>
        Review the summary below. Once submitted, nodew-api will create the first administrator and
        complete the initial setup flow.
      </p>

      <dl className="setup-summary">
        <div>
          <dt>Database</dt>
          <dd>PostgreSQL</dd>
        </div>
        <div>
          <dt>Admin email</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>Admin username</dt>
          <dd>{username}</dd>
        </div>
        <div>
          <dt>Usage mode</dt>
          <dd>{usageModeLabels[usageMode]}</dd>
        </div>
      </dl>
    </div>
  );
}

export default CompleteStep;
