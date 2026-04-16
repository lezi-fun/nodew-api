import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import type { SetupStatus } from '../../lib/api';
import { api } from '../../lib/api';
import StepNavigation from './components/StepNavigation';
import AdminStep from './components/steps/AdminStep';
import CompleteStep from './components/steps/CompleteStep';
import DatabaseStep from './components/steps/DatabaseStep';
import UsageModeStep from './components/steps/UsageModeStep';

type SetupWizardProps = {
  setup: SetupStatus;
  onSuccess: () => void;
};

type UsageMode = 'operations' | 'self-hosted' | 'demo';

type AdminFormState = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
};

const stepTitles = ['Database check', 'Administrator', 'Usage mode', 'Complete'];

function SetupWizard({ setup, onSuccess }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [usageMode, setUsageMode] = useState<UsageMode>('operations');
  const [form, setForm] = useState<AdminFormState>({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (setup.isInitialized) {
    return <Navigate to="/login" replace />;
  }

  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      return true;
    }

    if (currentStep === 1) {
      return Boolean(
        form.email.trim() &&
          form.username.trim() &&
          form.password.trim() &&
          form.confirmPassword.trim() &&
          form.password === form.confirmPassword,
      );
    }

    if (currentStep === 2) {
      return Boolean(usageMode);
    }

    return Boolean(form.email.trim() && form.username.trim());
  }, [currentStep, form, usageMode]);

  const updateField = (field: keyof AdminFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setCurrentStep(1);
      return;
    }

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
      setCurrentStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="setup-shell">
      <section className="setup-wizard-card">
        <header className="setup-header">
          <div>
            <div className="eyebrow">System initialization</div>
            <h1>Set up your nodew-api deployment</h1>
            <p>
              This onboarding flow is modeled after new-api&apos;s initialization wizard: verify the
              environment, create the first administrator, choose the usage mode, and complete the
              bootstrap process.
            </p>
          </div>
        </header>

        <div className="setup-steps" aria-label="Setup steps">
          {stepTitles.map((title, index) => (
            <div
              key={title}
              className={`setup-step-pill ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`}
            >
              <span>{index + 1}</span>
              <strong>{title}</strong>
            </div>
          ))}
        </div>

        <div className="setup-body">
          {currentStep === 0 ? <DatabaseStep hasAdmin={setup.hasAdmin} /> : null}
          {currentStep === 1 ? <AdminStep form={form} error={error} onChange={updateField} /> : null}
          {currentStep === 2 ? <UsageModeStep value={usageMode} onChange={setUsageMode} /> : null}
          {currentStep === 3 ? (
            <CompleteStep email={form.email} username={form.username} usageMode={usageMode} />
          ) : null}
        </div>

        <StepNavigation
          currentStep={currentStep}
          totalSteps={stepTitles.length}
          canProceed={canProceed}
          submitting={submitting}
          onBack={() => setCurrentStep((step) => Math.max(0, step - 1))}
          onNext={() => setCurrentStep((step) => Math.min(stepTitles.length - 1, step + 1))}
          onSubmit={handleSubmit}
        />
      </section>
    </div>
  );
}

export default SetupWizard;
