import { Suspense, lazy, useContext, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import SetupCheck from './components/layout/SetupCheck';
import Loading from './components/common/Loading';
import { StatusContext } from './context/Status';
import { UserContext } from './context/User';

const AboutPage = lazy(() => import('./pages/About'));
const ChannelPage = lazy(() => import('./pages/Channel'));
const ChatPage = lazy(() => import('./pages/Chat'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const DeploymentPage = lazy(() => import('./pages/Deployment'));
const HomePage = lazy(() => import('./pages/Home'));
const LogPage = lazy(() => import('./pages/Log'));
const LoginPage = lazy(() => import('./pages/Login'));
const MidjourneyPage = lazy(() => import('./pages/Midjourney'));
const ModelsPage = lazy(() => import('./pages/Models'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const PersonalPage = lazy(() => import('./pages/Personal'));
const PlaygroundPage = lazy(() => import('./pages/Playground'));
const PricingPage = lazy(() => import('./pages/Pricing'));
const RedemptionPage = lazy(() => import('./pages/Redemption'));
const RegisterPage = lazy(() => import('./pages/Register'));
const ResetConfirmPage = lazy(() => import('./pages/ResetConfirm'));
const ResetPage = lazy(() => import('./pages/Reset'));
const SettingPage = lazy(() => import('./pages/Setting'));
const SetupPage = lazy(() => import('./pages/Setup'));
const SubscriptionPage = lazy(() => import('./pages/Subscription'));
const TaskPage = lazy(() => import('./pages/Task'));
const TokenPage = lazy(() => import('./pages/Token'));
const TopUpPage = lazy(() => import('./pages/TopUp'));
const UserPage = lazy(() => import('./pages/User'));

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
      <Suspense fallback={<Loading />}>
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
          <Route path="/console/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
          <Route path="/console/chat/:id" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
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
      </Suspense>
    </SetupCheck>
  );
}
