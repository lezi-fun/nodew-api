import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import SetupCheck from './components/setup/SetupCheck';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import SetupPage from './pages/Setup';
import { api, type CurrentUser, type ServiceStatus, type SetupStatus } from './lib/api';

type BootstrapState = {
  loading: boolean;
  setup: SetupStatus | null;
  user: CurrentUser | null;
  status: ServiceStatus | null;
  error: string | null;
};

const initialState: BootstrapState = {
  loading: true,
  setup: null,
  user: null,
  status: null,
  error: null,
};

function App() {
  const [state, setState] = useState<BootstrapState>(initialState);
  const location = useLocation();
  const navigate = useNavigate();

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [setup, status] = await Promise.all([api.getSetupStatus(), api.getStatus()]);
      let user: CurrentUser | null = null;

      if (setup.isInitialized) {
        try {
          const userResponse = await api.getCurrentUser();
          user = userResponse.user;
        } catch {
          user = null;
        }
      }

      setState({
        loading: false,
        setup,
        user,
        status,
        error: null,
      });
    } catch (error) {
      setState({
        loading: false,
        setup: null,
        user: null,
        status: null,
        error: error instanceof Error ? error.message : 'Failed to load application state.',
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (state.loading || !state.setup) {
      return;
    }

    if (!state.setup.isInitialized) {
      if (location.pathname !== '/setup') {
        navigate('/setup', { replace: true });
      }
      return;
    }

    if (!state.user) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }

    if (location.pathname === '/login' || location.pathname === '/setup') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, state.loading, state.setup, state.user]);

  const content = useMemo(() => {
    if (state.loading || !state.setup) {
      return <div className="screen-state">Loading nodew-api...</div>;
    }

    if (state.error) {
      return (
        <div className="screen-state error-state">
          <h1>Failed to load application</h1>
          <p>{state.error}</p>
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      );
    }

    return (
      <SetupCheck setup={state.setup} loading={state.loading}>
        <Routes>
          <Route
            path="/setup"
            element={<SetupPage onSuccess={() => void refresh()} setup={state.setup} />}
          />
          <Route path="/login" element={<LoginPage onSuccess={() => void refresh()} />} />
          <Route
            path="/"
            element={
              state.user && state.status ? (
                <HomePage
                  user={state.user}
                  status={state.status}
                  onLogout={async () => {
                    await api.logout();
                    await refresh();
                  }}
                />
              ) : (
                <Navigate to={state.setup.isInitialized ? '/login' : '/setup'} replace />
              )
            }
          />
        </Routes>
      </SetupCheck>
    );
  }, [state.error, state.loading, state.setup, state.status, state.user]);

  return <div className="app-shell">{content}</div>;
}

export default App;
