import { Navigate, useLocation } from 'react-router-dom';

import type { SetupStatus } from '../../lib/api';

type SetupCheckProps = {
  setup: SetupStatus;
  loading: boolean;
  children: React.ReactNode;
};

function SetupCheck({ setup, loading, children }: SetupCheckProps) {
  const location = useLocation();

  if (loading) {
    return <>{children}</>;
  }

  if (!setup.isInitialized && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (setup.isInitialized && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default SetupCheck;
