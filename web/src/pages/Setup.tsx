import SetupWizard from '../components/setup/SetupWizard';
import type { SetupStatus } from '../lib/api';

type SetupPageProps = {
  setup: SetupStatus;
  onSuccess: () => void;
};

function SetupPage({ setup, onSuccess }: SetupPageProps) {
  return <SetupWizard setup={setup} onSuccess={onSuccess} />;
}

export default SetupPage;
