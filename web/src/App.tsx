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
        <Route path="/console/playground" element={<PrivateRoute><PlaceholderPage title="操练场" description="用于快速验证令牌、模型与 Relay 流式响应。后续会接入 OpenAI 兼容调试面板。" module="chat" /></PrivateRoute>} />
        <Route path="/console/chat" element={<PrivateRoute><PlaceholderPage title="聊天" description="与外部 Chat UI 入口保持路由兼容，后续可挂载多会话调试体验。" module="chat" /></PrivateRoute>} />
        <Route path="/console/chat/:id" element={<PrivateRoute><PlaceholderPage title="聊天" description="与外部 Chat UI 入口保持路由兼容，后续可挂载多会话调试体验。" module="chat" /></PrivateRoute>} />
        <Route path="/console/topup" element={<PrivateRoute><PlaceholderPage title="钱包管理" description="管理余额、充值记录和兑换码使用入口。" module="personal" /></PrivateRoute>} />
        <Route path="/console/personal" element={<PrivateRoute><PlaceholderPage title="个人设置" description="维护账号资料、偏好设置、访问安全与通知选项。" module="personal" /></PrivateRoute>} />
        <Route path="/console/task" element={<PrivateRoute><PlaceholderPage title="任务日志" description="异步任务、批量操作和后台队列的审计入口。" module="console" /></PrivateRoute>} />
        <Route path="/console/midjourney" element={<PrivateRoute><PlaceholderPage title="绘图日志" description="预留绘图与多模态任务日志入口，保持控制台导航完整。" module="console" /></PrivateRoute>} />
        <Route path="/console/redemption" element={<AdminRoute><RedemptionPage /></AdminRoute>} />
        <Route path="/console/user" element={<AdminRoute><UserPage /></AdminRoute>} />
        <Route path="/console/log" element={<PrivateRoute><LogPage /></PrivateRoute>} />
        <Route path="/console/models" element={<AdminRoute><PlaceholderPage title="模型管理" description="维护模型别名、倍率、可见性和路由策略。" module="admin" /></AdminRoute>} />
        <Route path="/console/deployment" element={<AdminRoute><PlaceholderPage title="模型部署" description="展示模型到渠道的部署状态和可用性。" module="admin" /></AdminRoute>} />
        <Route path="/console/subscription" element={<AdminRoute><PlaceholderPage title="订阅管理" description="管理订阅计划、额度周期和用户绑定。" module="admin" /></AdminRoute>} />
        <Route path="/console/setting" element={<AdminRoute><PlaceholderPage title="系统设置" description="全局站点、认证、计费、公告与导航配置入口。" module="admin" /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SetupCheck>
  );
}
