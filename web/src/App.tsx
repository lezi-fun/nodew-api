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
import PlaceholderPage from './pages/Placeholder';
import DeploymentPage from './pages/Deployment';
import MidjourneyPage from './pages/Midjourney';
import ModelsPage from './pages/Models';
import PersonalPage from './pages/Personal';
import PlaygroundPage from './pages/Playground';
import SettingPage from './pages/Setting';
import SubscriptionPage from './pages/Subscription';
import TaskPage from './pages/Task';
import TopUpPage from './pages/TopUp';

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

  const setupRequired = useMemo(() => status?.setup?.isInitialized === false, [status?.setup?.isInitialized]);

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
        <Route path="/console/playground" element={<PrivateRoute><PlaygroundPage /></PrivateRoute>} />
        <Route path="/console/chat" element={<PrivateRoute><PlaceholderPage title="聊天" description="与外部 Chat UI 入口保持路由兼容，后续可挂载多会话调试体验。" module="chat" /></PrivateRoute>} />
        <Route path="/console/chat/:id" element={<PrivateRoute><PlaceholderPage title="聊天" description="与外部 Chat UI 入口保持路由兼容，后续可挂载多会话调试体验。" module="chat" /></PrivateRoute>} />
        <Route path="/console/topup" element={<PrivateRoute><TopUpPage /></PrivateRoute>} />
        <Route path="/console/personal" element={<PrivateRoute><PersonalPage /></PrivateRoute>} />
        <Route path="/console/task" element={<PrivateRoute><TaskPage /></PrivateRoute>} />
        <Route path="/console/midjourney" element={<PrivateRoute><MidjourneyPage /></PrivateRoute>} />
        <Route path="/console/redemption" element={<AdminRoute><RedemptionPage /></AdminRoute>} />
        <Route path="/console/user" element={<AdminRoute><UserPage /></AdminRoute>} />
        <Route path="/console/log" element={<PrivateRoute><LogPage /></PrivateRoute>} />
        <Route path="/console/models" element={<AdminRoute><ModelsPage /></AdminRoute>} />
        <Route path="/console/deployment" element={<AdminRoute><DeploymentPage /></AdminRoute>} />
        <Route path="/console/subscription" element={<AdminRoute><SubscriptionPage /></AdminRoute>} />
        <Route path="/console/setting" element={<AdminRoute><SettingPage /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SetupCheck>
  );
}
