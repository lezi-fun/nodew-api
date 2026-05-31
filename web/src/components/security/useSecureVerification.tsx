import { useState } from 'react';

import SecureVerificationModal from './SecureVerificationModal';

type SecureVerificationOptions = {
  title?: string;
  description?: string;
};

export const useSecureVerification = (options?: SecureVerificationOptions) => {
  const [visible, setVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);

  const requireVerification = (action: () => Promise<void> | void) => {
    setPendingAction(() => action);
    setVisible(true);
  };

  const handleCancel = () => {
    setVisible(false);
    setPendingAction(null);
  };

  const handleSuccess = async () => {
    const action = pendingAction;

    if (!action) {
      setVisible(false);
      return;
    }

    await action();
    setVisible(false);
    setPendingAction(null);
  };

  return {
    requireVerification,
    modal: (
      <SecureVerificationModal
        visible={visible}
        title={options?.title}
        description={options?.description}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    ),
  };
};
