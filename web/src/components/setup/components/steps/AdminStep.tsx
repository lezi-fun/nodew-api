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
  onChange: (field: keyof AdminFormState, value: string) => void;
};

function AdminStep({ form, error, onChange }: AdminStepProps) {
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
        </label>
        <label>
          <span>Username</span>
          <input value={form.username} onChange={(e) => onChange('username', e.target.value)} required />
        </label>
      </div>

      <div className="setup-form-grid">
        <label>
          <span>Display name</span>
          <input value={form.displayName} onChange={(e) => onChange('displayName', e.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange('password', e.target.value)}
            required
          />
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
      </label>

      {error ? <div className="message error">{error}</div> : null}
    </div>
  );
}

export default AdminStep;
