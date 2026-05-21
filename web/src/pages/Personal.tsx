import { Button, Card, Input, Select, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconSave, IconUser } from '@douyinfe/semi-icons';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UserContext } from '../context/User';
import { api } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function PersonalPage() {
  const { user, refresh } = useContext(UserContext);
  const { i18n } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [language, setLanguage] = useState(i18n.language.startsWith('zh') ? 'zh-CN' : 'en');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateCurrentUser({
        displayName: displayName.trim() || undefined,
        settings: { ...(user?.settings ?? {}), language },
      });
      await i18n.changeLanguage(language);
      localStorage.setItem('i18nextLng', language);
      await refresh();
      Toast.success('个人设置已保存');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存个人设置失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      Toast.error('新密码至少 8 位');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changeCurrentUserPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Toast.success('密码已更新');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '更新密码失败');
    } finally {
      setSavingPassword(false);
    }
  };

  const requestVerification = async () => {
    setSendingVerification(true);
    try {
      const response = await api.requestEmailVerification();

      if (response.verificationToken) {
        await api.verifyEmail({ token: response.verificationToken });
        await refresh();
        Toast.success('邮箱已验证');
        return;
      }

      Toast.success('验证链接已发送');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '发送验证链接失败');
    } finally {
      setSendingVerification(false);
    }
  };

  const emailVerifiedAt = user?.emailVerifiedAt;

  return (
    <main className="console-page personal-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Account</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>个人设置</Typography.Title>
          <Typography.Paragraph className="console-description">
            管理个人资料、语言偏好和登录密码。
          </Typography.Paragraph>
        </div>
        <div className="dashboard-user-card">
          <strong>{user?.email}</strong>
          <span>{user?.role} · {user?.status}</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <Card title={<span><IconUser /> 账户资料</span>} bordered={false} className="dashboard-card">
          <div className="form-grid">
            <label>
              <span>显示名</span>
              <Input value={displayName} placeholder={user?.username} onChange={setDisplayName} />
            </label>
            <label>
              <span>界面语言</span>
              <Select value={language} onChange={(value) => setLanguage(String(value))}>
                <Select.Option value="zh-CN">简体中文</Select.Option>
                <Select.Option value="en">English</Select.Option>
              </Select>
            </label>
            <Button theme="solid" type="primary" icon={<IconSave />} loading={savingProfile} onClick={() => void saveProfile()}>
              保存资料
            </Button>
          </div>
        </Card>
        <Card title="邮箱验证" bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Typography.Text type="tertiary">验证状态</Typography.Text>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              {emailVerifiedAt ? '已验证' : '未验证'}
            </Typography.Title>
            <Typography.Text type="tertiary">
              {emailVerifiedAt ? `验证时间 ${formatDateTime(emailVerifiedAt)}` : '完成验证后，账号安全状态会更新。'}
            </Typography.Text>
            <Button
              theme="solid"
              type="primary"
              loading={sendingVerification}
              disabled={Boolean(emailVerifiedAt)}
              onClick={() => void requestVerification()}
            >
              {emailVerifiedAt ? '邮箱已验证' : '发送验证链接'}
            </Button>
          </Space>
        </Card>
        <Card title="密码安全" bordered={false} className="dashboard-card">
          <div className="form-grid">
            <label>
              <span>当前密码</span>
              <Input mode="password" value={currentPassword} onChange={setCurrentPassword} />
            </label>
            <label>
              <span>新密码</span>
              <Input mode="password" value={newPassword} onChange={setNewPassword} />
            </label>
            <Button loading={savingPassword} onClick={() => void changePassword()}>更新密码</Button>
          </div>
        </Card>
        <Card title="额度信息" bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Typography.Text type="tertiary">剩余额度</Typography.Text>
            <Typography.Title heading={3}>{formatQuota(user?.quotaRemaining)}</Typography.Title>
            <Typography.Text type="tertiary">已用额度 {formatQuota(user?.quotaUsed)}</Typography.Text>
            <Typography.Text type="tertiary">创建时间 {formatDateTime(user?.createdAt)}</Typography.Text>
          </Space>
        </Card>
      </section>
    </main>
  );
}
