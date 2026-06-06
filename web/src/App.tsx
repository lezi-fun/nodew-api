import { Suspense, lazy, useContext, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import SetupCheck from './components/layout/SetupCheck';
import Loading from './components/common/Loading';
import { StatusContext } from './context/Status';
import { UserContext } from './context/User';
import AboutPage from './pages/About';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import NotFoundPage from './pages/NotFound';
import PricingPage from './pages/Pricing';
import RegisterPage from './pages/Register';
import ResetConfirmPage from './pages/ResetConfirm';
import ResetPage from './pages/Reset';
import SetupPage from './pages/Setup';

const LAZY_RETRY_QUERY_KEY = '__nodew_lazy_retry';

const recoverableLazy = <T extends React.ComponentType<unknown>>(
  retryKey: string,
  loader: () => Promise<{ default: T }>,
) => lazy(async () => {
  const storageKey = `nodew-lazy-reload-once:${retryKey}`;
  const storage = (() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  const locationUrl = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const urlRetryActive = locationUrl?.searchParams.get(LAZY_RETRY_QUERY_KEY) === retryKey;
  const safeStorageRead = () => {
    if (!storage) {
      return null;
    }

    try {
      return storage.getItem(storageKey);
    } catch {
      return null;
    }
  };
  const safeStorageWrite = (value: string) => {
    if (!storage) {
      return false;
    }

    try {
      storage.setItem(storageKey, value);
      return true;
    } catch {
      return false;
    }
  };
  const safeStorageClear = () => {
    if (!storage) {
      return false;
    }

    try {
      storage.removeItem(storageKey);
      return true;
    } catch {
      return false;
    }
  };
  const clearRetryMarker = () => {
    safeStorageClear();
  };
  const hasRetried = safeStorageRead() === '1' || urlRetryActive;
  const markRetriedAndReload = () => {
    if (safeStorageWrite('1')) {
      window.location.reload();
      return;
    }

    if (!locationUrl) {
      window.location.reload();
      return;
    }

    locationUrl.searchParams.set(LAZY_RETRY_QUERY_KEY, retryKey);
    window.location.replace(locationUrl.toString());
  };

  try {
    const module = await loader();

    clearRetryMarker();

    return module;
  } catch (error) {
    const shouldReload = typeof window !== 'undefined' && !hasRetried;

    if (shouldReload) {
      markRetriedAndReload();
      return new Promise<never>(() => undefined);
    }

    throw error;
  }
});

const ChannelPage = recoverableLazy('channel', () => import('./pages/Channel'));
const ChatPage = recoverableLazy('chat', () => import('./pages/Chat'));
const DashboardPage = recoverableLazy('dashboard', () => import('./pages/Dashboard'));
const DeploymentPage = recoverableLazy('deployment', () => import('./pages/Deployment'));
const LogPage = recoverableLazy('log', () => import('./pages/Log'));
const MidjourneyPage = recoverableLazy('midjourney', () => import('./pages/Midjourney'));
const ModelsPage = recoverableLazy('models', () => import('./pages/Models'));
const PersonalPage = recoverableLazy('personal', () => import('./pages/Personal'));
const PlaygroundPage = recoverableLazy('playground', () => import('./pages/Playground'));
const RedemptionPage = recoverableLazy('redemption', () => import('./pages/Redemption'));
const SettingPage = recoverableLazy('setting', () => import('./pages/Setting'));
const SubscriptionPage = recoverableLazy('subscription', () => import('./pages/Subscription'));
const TaskPage = recoverableLazy('task', () => import('./pages/Task'));
const TokenPage = recoverableLazy('token', () => import('./pages/Token'));
const TopUpPage = recoverableLazy('topup', () => import('./pages/TopUp'));
const UserPage = recoverableLazy('user', () => import('./pages/User'));
const VerifyEmailPage = recoverableLazy('verify-email', () => import('./pages/VerifyEmail'));
const OAuthCallbackPage = recoverableLazy('oauth-callback', () => import('./pages/OAuthCallback'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(UserContext);
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ redirectTo: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(UserContext);
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ redirectTo: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
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
  const navigate = useNavigate();

  const setupRequired = useMemo(() => status?.setup?.isInitialized === false, [status?.setup?.isInitialized]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (!params.has(LAZY_RETRY_QUERY_KEY)) {
      return;
    }

    params.delete(LAZY_RETRY_QUERY_KEY);

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/oauth/:provider" element={<OAuthCallbackPage />} />
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
