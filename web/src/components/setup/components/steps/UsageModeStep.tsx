type UsageMode = 'operations' | 'self-hosted' | 'demo';

type UsageModeStepProps = {
  value: UsageMode;
  onChange: (value: UsageMode) => void;
};

const modeOptions: Array<{ value: UsageMode; title: string; description: string }> = [
  {
    value: 'operations',
    title: 'Operations mode',
    description: 'Suitable for managed multi-user operation and future billing or quota expansion.',
  },
  {
    value: 'self-hosted',
    title: 'Self-use mode',
    description: 'Optimized for a private deployment where the administrator is also the main user.',
  },
  {
    value: 'demo',
    title: 'Demo mode',
    description: 'Use this when you want a showcase environment before completing broader feature parity.',
  },
];

function UsageModeStep({ value, onChange }: UsageModeStepProps) {
  return (
    <div className="setup-step-content">
      <div className="setup-helper-text compact">
        <h3>Usage mode</h3>
        <p>
          This step mirrors new-api&apos;s operating-mode selection: choose how the instance is meant
          to be used, then finalize initialization.
        </p>
      </div>

      <div className="usage-mode-grid">
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`usage-mode-card ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default UsageModeStep;
