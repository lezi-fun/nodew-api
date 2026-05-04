import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { StatusContext } from '../../context/Status';

export default function SetupCheck({ children }: { children: React.ReactNode }) {
  const { status, loading } = useContext(StatusContext);
  const location = useLocation();

  if (loading) {
    return <div className="screen-state">Loading nodew-api...</div>;
  }

  if (status?.setup?.isInitialized === false && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
