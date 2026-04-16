type StepNavigationProps = {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

function StepNavigation({
  currentStep,
  totalSteps,
  canProceed,
  submitting,
  onBack,
  onNext,
  onSubmit,
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="setup-navigation">
      <div className="setup-navigation-meta">
        <span>
          Step {currentStep + 1} / {totalSteps}
        </span>
      </div>
      <div className="setup-navigation-actions">
        {currentStep > 0 ? (
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        ) : null}
        {isLastStep ? (
          <button type="button" onClick={onSubmit} disabled={!canProceed || submitting}>
            {submitting ? 'Initializing...' : 'Initialize system'}
          </button>
        ) : (
          <button type="button" onClick={onNext} disabled={!canProceed}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

export default StepNavigation;
