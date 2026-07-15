import { Button, Card, Input, Select, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconSave, IconUser } from '@douyinfe/semi-icons';
import { useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { UserContext } from '../context/User';
import { api, type CheckinStatus } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';
import TwoFASettingCard from '../components/security/TwoFASettingCard';
import PasskeySettingCard from '../components/security/PasskeySettingCard';
import OAuthBindingCard from '../components/security/OAuthBindingCard';
import EmailBindingModal from '../components/security/EmailBindingModal';

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

type CheckinCalendarCell = {
  date: string;
  day: number;
  checkedIn: boolean;
  rewardQuota: string | null;
  createdAt: string | null;
  isToday: boolean;
};

const shiftMonth = (month: string, offset: number) => dayjs(`${month}-01`).add(offset, 'month').format('YYYY-MM');

const formatMonthLabel = (month: string) => dayjs(`${month}-01`).format('YYYY年MM月');

const getCalendarCells = (month: string, records: CheckinStatus['records'], today: string) => {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDay = new Date(`${month}-01T00:00:00+08:00`);
  const leadingEmpty = (firstDay.getDay() + 6) % 7;
  const recordMap = new Map(records.map((record) => [record.checkinDate, record]));
  const cells: Array<CheckinCalendarCell | null> = Array.from({ length: leadingEmpty }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const record = recordMap.get(date);

    cells.push({
      date,
      day,
      checkedIn: Boolean(record),
      rewardQuota: record?.rewardQuota ?? null,
      createdAt: record?.createdAt ?? null,
      isToday: date === today,
    });
  }

  return cells;
};

export default function PersonalPage() {
  const { user, refresh } = useContext(UserContext);
  const { i18n, t } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [language, setLanguage] = useState(i18n.language.startsWith('zh') ? 'zh-CN' : 'en');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [emailBindingVisible, setEmailBindingVisible] = useState(false);
  const [bindingEmail, setBindingEmail] = useState('');
  const [bindingCode, setBindingCode] = useState('');
  const [requestingEmailBinding, setRequestingEmailBinding] = useState(false);
  const [verifyingEmailBinding, setVerifyingEmailBinding] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => dayjs().format('YYYY-MM'));
  const [loadingCheckin, setLoadingCheckin] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    setLanguage(i18n.language.startsWith('zh') ? 'zh-CN' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    let active = true;

    const loadCheckinStatus = async () => {
      if (!user) {
        setCheckinStatus(null);
        setLoadingCheckin(false);
        return;
      }

      setLoadingCheckin(true);

      try {
        const response = await api.getCheckinStatus({ month: currentMonth });

        if (active) {
          setCheckinStatus(response.status);
        }
      } catch (error) {
        if (active) {
          Toast.error(error instanceof Error ? error.message : t('加载签到状态失败'));
        }
      } finally {
        if (active) {
          setLoadingCheckin(false);
        }
      }
    };

    void loadCheckinStatus();

    return () => {
      active = false;
    };
  }, [user?.id, currentMonth, t]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateCurrentUser({
        displayName: displayName.trim() || undefined,
        language: language as 'zh-CN' | 'en',
      });
      await i18n.changeLanguage(language);
      localStorage.setItem('i18nextLng', language);
      await refresh();
      Toast.success(t('个人设置已保存'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('保存个人设置失败'));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      Toast.error(t('新密码至少 8 位'));
      return;
    }

    setSavingPassword(true);
    try {
      await api.changeCurrentUserPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Toast.success(t('密码已更新'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('更新密码失败'));
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
        Toast.success(t('邮箱已验证'));
        return;
      }

      Toast.success(t('验证链接已发送'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('发送验证链接失败'));
    } finally {
      setSendingVerification(false);
    }
  };

  const requestEmailBinding = async () => {
    const nextEmail = bindingEmail.trim();

    if (!nextEmail) {
      Toast.error(t('请先填写新的邮箱地址'));
      return;
    }

    setRequestingEmailBinding(true);
    try {
      const response = await api.requestEmailBinding({ email: nextEmail });
      if (response.verificationCode) {
        setBindingCode(response.verificationCode);
      }
      Toast.success(t('验证邮件已发送'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('发送邮箱绑定验证失败'));
    } finally {
      setRequestingEmailBinding(false);
    }
  };

  const verifyEmailBinding = async () => {
    const nextEmail = bindingEmail.trim();
    const code = bindingCode.trim();

    if (!nextEmail) {
      Toast.error(t('请先填写新的邮箱地址'));
      return;
    }

    if (!code) {
      Toast.error(t('请输入验证码'));
      return;
    }

    setVerifyingEmailBinding(true);
    try {
      await api.verifyEmailBinding({ email: nextEmail, code });
      await refresh();
      setEmailBindingVisible(false);
      setBindingEmail('');
      setBindingCode('');
      Toast.success(t('新邮箱已绑定'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('邮箱绑定失败'));
    } finally {
      setVerifyingEmailBinding(false);
    }
  };

  const claimCheckin = async () => {
    setCheckingIn(true);
    try {
      await api.checkIn();
      await refresh();
      const response = await api.getCheckinStatus({ month: currentMonth });
      setCheckinStatus(response.status);
      Toast.success(t('签到成功'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('签到失败'));
    } finally {
      setCheckingIn(false);
    }
  };

  const emailVerifiedAt = user?.emailVerifiedAt;
  const checkinRecords = checkinStatus?.records ?? [];
  const checkinEnabled = checkinStatus?.enabled !== false;
  const recentCheckins = [...checkinRecords].reverse().slice(0, 6);
  const calendarCells = checkinStatus ? getCalendarCells(currentMonth, checkinRecords, checkinStatus.today) : [];
  const monthLabel = i18n.language.startsWith('zh')
    ? formatMonthLabel(currentMonth)
    : dayjs(`${currentMonth}-01`).format('MMMM YYYY');
  const localizedWeekdayLabels = i18n.language.startsWith('zh')
    ? weekdayLabels
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const handlePreviousMonth = () => setCurrentMonth((current) => shiftMonth(current, -1));
  const handleNextMonth = () => setCurrentMonth((current) => shiftMonth(current, 1));
  const handleCurrentMonth = () => setCurrentMonth(dayjs().format('YYYY-MM'));

  return (
    <main className="console-page personal-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Account</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>{t('个人设置')}</Typography.Title>
          <Typography.Paragraph className="console-description">
            {t('管理个人资料、安全设置、语言偏好和登录密码。')}
          </Typography.Paragraph>
        </div>
        <div className="dashboard-user-card">
          <strong>{user?.email}</strong>
          <span>{user?.role} · {user?.status}</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <Card title={<span><IconUser /> {t('账户资料')}</span>} bordered={false} className="dashboard-card">
          <div className="form-grid">
            <label>
              <span>{t('显示名')}</span>
              <Input value={displayName} placeholder={user?.username} onChange={setDisplayName} />
            </label>
            <label>
              <span>{t('界面语言')}</span>
              <Select value={language} onChange={(value) => setLanguage(String(value))}>
                <Select.Option value="zh-CN">{t('简体中文')}</Select.Option>
                <Select.Option value="en">English</Select.Option>
              </Select>
            </label>
            <Button theme="solid" type="primary" icon={<IconSave />} loading={savingProfile} onClick={() => void saveProfile()}>
              {t('保存资料')}
            </Button>
          </div>
        </Card>
        <Card title={t('邮箱验证')} bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Typography.Text type="tertiary">{t('当前邮箱')}</Typography.Text>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              {user?.email ?? '-'}
            </Typography.Title>
            <Typography.Text type="tertiary">{t('验证状态')}</Typography.Text>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              {emailVerifiedAt ? t('已验证') : t('未验证')}
            </Typography.Title>
            <Typography.Text type="tertiary">
              {emailVerifiedAt
                ? t('验证时间 {{time}}', { time: formatDateTime(emailVerifiedAt) })
                : t('完成验证后，账号安全状态会更新。')}
            </Typography.Text>
            <Space>
              <Button
                theme="solid"
                type="primary"
                loading={sendingVerification}
                disabled={Boolean(emailVerifiedAt)}
                onClick={() => void requestVerification()}
              >
                {emailVerifiedAt ? t('邮箱已验证') : t('发送验证链接')}
              </Button>
              <Button onClick={() => {
                setBindingEmail('');
                setBindingCode('');
                setEmailBindingVisible(true);
              }}
              >
                {t('更换邮箱')}
              </Button>
            </Space>
          </Space>
        </Card>
        <OAuthBindingCard />
        <TwoFASettingCard />
        <PasskeySettingCard />
        {checkinEnabled ? (
          <>
            <Card title={t('每日签到')} bordered={false} className="dashboard-card">
              <Space vertical align="start">
                <Typography.Text type="tertiary">{t('今日状态')}</Typography.Text>
                <Typography.Title heading={4} style={{ margin: 0 }}>
                  {loadingCheckin ? t('加载中') : checkinStatus?.checkedInToday ? t('已签到') : t('未签到')}
                </Typography.Title>
                <Typography.Text type="tertiary">
                  {checkinStatus?.checkedInToday
                    ? t('今天已领取 {{quota}} 额度', { quota: formatQuota(checkinStatus.lastRewardQuota) })
                    : t('今日可签到')}
                </Typography.Text>
                <Typography.Text type="tertiary">
                  {t('最近一次签到')}：{formatDateTime(checkinStatus?.lastCheckinAt)}
                </Typography.Text>
                <Button
                  theme="solid"
                  type="primary"
                  loading={checkingIn}
                  disabled={loadingCheckin || !checkinStatus || Boolean(checkinStatus.checkedInToday)}
                  onClick={() => void claimCheckin()}
                >
                  {checkinStatus?.checkedInToday ? t('今天已签到') : t('立即签到')}
                </Button>
              </Space>
            </Card>
            <Card title={t('签到月历与历史统计')} bordered={false} className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <Space vertical align="start" style={{ width: '100%' }}>
                <div className="checkin-panel-header">
                  <div>
                    <Typography.Title heading={4} style={{ margin: 0 }}>{monthLabel}</Typography.Title>
                    <Typography.Text type="tertiary">
                      {t('累计签到 {{count}} 次，累计获得 {{quota}} 额度', {
                        count: checkinStatus?.totalCheckins ?? 0,
                        quota: formatQuota(checkinStatus?.totalQuota),
                      })}
                    </Typography.Text>
                  </div>
                  <Space>
                    <Button onClick={handlePreviousMonth}>{t('上一月')}</Button>
                    <Button onClick={handleCurrentMonth}>{t('本月')}</Button>
                    <Button onClick={handleNextMonth}>{t('下一月')}</Button>
                  </Space>
                </div>

                <div className="checkin-summary-grid">
                  <div className="checkin-summary-card">
                    <Typography.Text type="tertiary">{t('本月签到')}</Typography.Text>
                    <Typography.Title heading={4} style={{ margin: 0 }}>{checkinStatus?.monthCheckins ?? 0}</Typography.Title>
                  </div>
                  <div className="checkin-summary-card">
                    <Typography.Text type="tertiary">{t('本月获得')}</Typography.Text>
                    <Typography.Title heading={4} style={{ margin: 0 }}>{formatQuota(checkinStatus?.monthQuota)}</Typography.Title>
                  </div>
                  <div className="checkin-summary-card">
                    <Typography.Text type="tertiary">{t('当前连签')}</Typography.Text>
                    <Typography.Title heading={4} style={{ margin: 0 }}>{checkinStatus?.currentStreak ?? 0}</Typography.Title>
                  </div>
                  <div className="checkin-summary-card">
                    <Typography.Text type="tertiary">{t('最长连签')}</Typography.Text>
                    <Typography.Title heading={4} style={{ margin: 0 }}>{checkinStatus?.longestStreak ?? 0}</Typography.Title>
                  </div>
                </div>

                <div className="checkin-calendar">
                  {localizedWeekdayLabels.map((label) => (
                    <div className="checkin-calendar-weekday" key={label}>{label}</div>
                  ))}
                  {loadingCheckin
                    ? Array.from({ length: 42 }, (_, index) => (
                        <div className="checkin-calendar-cell placeholder" key={`placeholder-${index}`} />
                      ))
                    : calendarCells.map((cell, index) => (
                        cell ? (
                          <div
                            className={`checkin-calendar-cell${cell.checkedIn ? ' checked-in' : ''}${cell.isToday ? ' today' : ''}`}
                            key={cell.date}
                          >
                            <span className="checkin-calendar-day">{cell.day}</span>
                            <span className="checkin-calendar-meta">
                              {cell.checkedIn ? `+${formatQuota(cell.rewardQuota)}` : t('未签')}
                            </span>
                          </div>
                        ) : (
                          <div className="checkin-calendar-cell placeholder" key={`empty-${index}`} />
                        )
                      ))}
                </div>

                <div className="checkin-history">
                  <Typography.Text type="tertiary">{t('最近签到记录')}</Typography.Text>
                  {recentCheckins.length ? (
                    <div className="checkin-history-list">
                      {recentCheckins.map((record) => (
                        <div className="checkin-history-item" key={record.checkinDate}>
                          <span>{record.checkinDate}</span>
                          <strong>+{formatQuota(record.rewardQuota)}</strong>
                          <em>{formatDateTime(record.createdAt)}</em>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Typography.Text type="tertiary">{t('本月暂无签到记录。')}</Typography.Text>
                  )}
                </div>
              </Space>
            </Card>
          </>
        ) : null}
        <Card title={t('密码安全')} bordered={false} className="dashboard-card">
          <div className="form-grid">
            <label>
              <span>{t('当前密码')}</span>
              <Input mode="password" value={currentPassword} onChange={setCurrentPassword} />
            </label>
            <label>
              <span>{t('新密码')}</span>
              <Input mode="password" value={newPassword} onChange={setNewPassword} />
            </label>
            <Button loading={savingPassword} onClick={() => void changePassword()}>{t('更新密码')}</Button>
          </div>
        </Card>
        <Card title={t('额度信息')} bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Typography.Text type="tertiary">{t('剩余额度')}</Typography.Text>
            <Typography.Title heading={3}>{formatQuota(user?.quotaRemaining)}</Typography.Title>
            <Typography.Text type="tertiary">{t('已用额度')} {formatQuota(user?.quotaUsed)}</Typography.Text>
            <Typography.Text type="tertiary">{t('创建时间')} {formatDateTime(user?.createdAt)}</Typography.Text>
          </Space>
        </Card>
      </section>
      <EmailBindingModal
        visible={emailBindingVisible}
        email={bindingEmail}
        code={bindingCode}
        loadingRequest={requestingEmailBinding}
        loadingVerify={verifyingEmailBinding}
        onCancel={() => {
          setEmailBindingVisible(false);
          setBindingCode('');
        }}
        onEmailChange={setBindingEmail}
        onCodeChange={setBindingCode}
        onRequest={() => void requestEmailBinding()}
        onVerify={() => void verifyEmailBinding()}
      />
    </main>
  );
}
