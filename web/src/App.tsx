import { Suspense, lazy, useContext, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import SetupCheck from './components/layout/SetupCheck';
import Loading from './components/common/Loading';
import { StatusContext } from './context/Status';
import { UserContext } from './context/User';

const recoverableLazy = <T extends React.ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
) => lazy(async () => {
  try {
    const module = await loader();

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('nodew-lazy-reload-once');
    }

    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const storageKey = 'nodew-lazy-reload-once';
    const shouldReload =
      typeof window !== 'undefined' &&
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(message) &&
      window.sessionStorage.getItem(storageKey) !== '1';

    if (shouldReload) {
      window.sessionStorage.setItem(storageKey, '1');
      window.location.reload();
      return new Promise<never>(() => undefined);
    }

    throw error;
  }
});

const AboutPage = recoverableLazy(() => import('./pages/About'));
const ChannelPage = recoverableLazy(() => import('./pages/Channel'));
const ChatPage = recoverableLazy(() => import('./pages/Chat'));
const DashboardPage = recoverableLazy(() => import('./pages/Dashboard'));
const DeploymentPage = recoverableLazy(() => import('./pages/Deployment'));
const HomePage = recoverableLazy(() => import('./pages/Home'));
const LogPage = recoverableLazy(() => import('./pages/Log'));
const LoginPage = recoverableLazy(() => import('./pages/Login'));
const MidjourneyPage = recoverableLazy(() => import('./pages/Midjourney'));
const ModelsPage = recoverableLazy(() => import('./pages/Models'));
const NotFoundPage = recoverableLazy(() => import('./pages/NotFound'));
const PersonalPage = recoverableLazy(() => import('./pages/Personal'));
const PlaygroundPage = recoverableLazy(() => import('./pages/Playground'));
const PricingPage = recoverableLazy(() => import('./pages/Pricing'));
const RedemptionPage = recoverableLazy(() => import('./pages/Redemption'));
const RegisterPage = recoverableLazy(() => import('./pages/Register'));
const ResetConfirmPage = recoverableLazy(() => import('./pages/ResetConfirm'));
const ResetPage = recoverableLazy(() => import('./pages/Reset'));
const SettingPage = recoverableLazy(() => import('./pages/Setting'));
const SetupPage = recoverableLazy(() => import('./pages/Setup'));
const SubscriptionPage = recoverableLazy(() => import('./pages/Subscription'));
const TaskPage = recoverableLazy(() => import('./pages/Task'));
const TokenPage = recoverableLazy(() => import('./pages/Token'));
const TopUpPage = recoverableLazy(() => import('./pages/TopUp'));
const UserPage = recoverableLazy(() => import('./pages/User'));

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
