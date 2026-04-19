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

type ValidationErrors = Partial<Record<keyof AdminFormState, string>>;

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
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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
    setValidationErrors((current) => ({ ...current, [field]: undefined }));

    if (field === 'password' || field === 'confirmPassword') {
      setValidationErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }));
    }
  };

  const validateAdminStep = (): boolean => {
    const nextErrors: ValidationErrors = {};

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required';
    }

    if (!form.username.trim()) {
      nextErrors.username = 'Username is required';
    }

    if (!form.password.trim()) {
      nextErrors.password = 'Password is required';
    }

    if (!form.confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm the password';
    }

    if (form.password && form.password.length < 8) {
      nextErrors.password = 'Password must contain at least 8 characters';
    }

    if (form.username && !/^[a-zA-Z0-9_-]{3,32}$/.test(form.username)) {
      nextErrors.username = 'Username must be 3-32 characters and use only letters, numbers, underscores, or dashes';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Email address is invalid';
    }

    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateAdminStep()) {
      return;
    }

    setCurrentStep((step) => Math.min(stepTitles.length - 1, step + 1));
  };

  const handleSubmit = async () => {
    if (!validateAdminStep()) {
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
          {currentStep === 1 ? (
            <AdminStep
              form={form}
              error={error}
              validationErrors={validationErrors}
              onChange={updateField}
            />
          ) : null}
          {currentStep === 2 ? <UsageModeStep value={usageMode} onChange={setUsageMode} /> : null}
          {currentStep === 3 ? (
            <CompleteStep
              email={form.email}
              username={form.username}
              displayName={form.displayName}
              usageMode={usageMode}
            />
          ) : null}
        </div>

        <StepNavigation
          currentStep={currentStep}
          totalSteps={stepTitles.length}
          canProceed={canProceed}
          submitting={submitting}
          onBack={() => setCurrentStep((step) => Math.max(0, step - 1))}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      </section>
    </div>
  );
}

export default SetupWizard;
