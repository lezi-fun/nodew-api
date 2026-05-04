import { useContext, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import SetupCheck from './components/layout/SetupCheck';
import Loading from './components/common/Loading';
import { StatusContext } from './context/Status';
import { UserContext } from './context/User';
import ChannelPage from './pages/Channel';
import DashboardPage from './pages/Dashboard';
import HomePage from './pages/Home';
import LogPage from './pages/Log';
import LoginPage from './pages/Login';
import RedemptionPage from './pages/Redemption';
import RegisterPage from './pages/Register';
import ResetConfirmPage from './pages/ResetConfirm';
import ResetPage from './pages/Reset';
import SetupPage from './pages/Setup';
import UserPage from './pages/User';
import TokenPage from './pages/Token';
import AboutPage from './pages/About';
import PricingPage from './pages/Pricing';
import NotFoundPage from './pages/NotFound';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(UserContext);

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(UserContext);

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/console" replace />;
  }

  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(UserContext);

  if (loading) {
    return <Loading />;
  }

  if (user) {
    return <Navigate to="/console" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { status, loading } = useContext(StatusContext);
  const location = useLocation();

  const setupRequired = useMemo(() => status?.setup === false, [status?.setup]);

  if (loading) {
    return <Loading />;
  }

  if (setupRequired && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return (
    <SetupCheck>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
        <Route path="/register" element={<AuthRedirect><RegisterPage /></AuthRedirect>} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/user/reset" element={<ResetConfirmPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/console" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/console/channel" element={<AdminRoute><ChannelPage /></AdminRoute>} />
        <Route path="/console/token" element={<PrivateRoute><TokenPage /></PrivateRoute>} />
        <Route path="/console/redemption" element={<AdminRoute><RedemptionPage /></AdminRoute>} />
        <Route path="/console/user" element={<AdminRoute><UserPage /></AdminRoute>} />
        <Route path="/console/log" element={<PrivateRoute><LogPage /></PrivateRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SetupCheck>
  );
}
