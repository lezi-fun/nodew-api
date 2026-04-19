type AdminFormState = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
};

type AdminStepProps = {
  form: AdminFormState;
  error: string | null;
  validationErrors: Partial<Record<keyof AdminFormState, string>>;
  onChange: (field: keyof AdminFormState, value: string) => void;
};

function AdminStep({ form, error, validationErrors, onChange }: AdminStepProps) {
  return (
    <div className="setup-step-content">
      <div className="setup-helper-text compact">
        <h3>Administrator account</h3>
        <p>
          Create the first administrator to unlock the nodew-api console. This account will own
          the initial system configuration and token management.
        </p>
      </div>

      <div className="setup-form-grid">
        <label>
          <span>Email</span>
          <input value={form.email} onChange={(e) => onChange('email', e.target.value)} required />
          {validationErrors.email ? <small className="field-error">{validationErrors.email}</small> : null}
        </label>
        <label>
          <span>Username</span>
          <input value={form.username} onChange={(e) => onChange('username', e.target.value)} required />
          {validationErrors.username ? <small className="field-error">{validationErrors.username}</small> : null}
        </label>
      </div>

      <div className="setup-form-grid">
        <label>
          <span>Display name</span>
          <input value={form.displayName} onChange={(e) => onChange('displayName', e.target.value)} />
          {validationErrors.displayName ? <small className="field-error">{validationErrors.displayName}</small> : null}
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange('password', e.target.value)}
            required
          />
          {validationErrors.password ? <small className="field-error">{validationErrors.password}</small> : null}
        </label>
      </div>

      <label>
        <span>Confirm password</span>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => onChange('confirmPassword', e.target.value)}
          required
        />
        {validationErrors.confirmPassword ? <small className="field-error">{validationErrors.confirmPassword}</small> : null}
      </label>

      {error ? <div className="message error">{error}</div> : null}
    </div>
  );
}

export default AdminStep;
