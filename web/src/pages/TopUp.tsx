import { Button, Card, Input, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconGift, IconRefresh } from '@douyinfe/semi-icons';
import { useContext, useState } from 'react';

import { UserContext } from '../context/User';
import { api } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function TopUpPage() {
  const { user, refresh } = useContext(UserContext);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const redeem = async () => {
    if (!code.trim()) {
      Toast.error('请输入兑换码');
      return;
    }

    setRedeeming(true);
    try {
      await api.redeemCode({ code: code.trim() });
      setCode('');
      await refresh();
      Toast.success('兑换成功');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <main className="console-page topup-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Wallet</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>钱包管理</Typography.Title>
          <Typography.Paragraph className="console-description">
            查看当前额度并使用兑换码充值。支付渠道接入前，兑换码是当前可用的充值入口。
          </Typography.Paragraph>
        </div>
        <Button icon={<IconRefresh />} onClick={() => void refresh()}>刷新余额</Button>
      </section>

      <section className="dashboard-grid">
        <Card bordered={false} className="metric-card tone-green">
          <span>剩余额度</span>
          <strong>{formatQuota(user?.quotaRemaining)}</strong>
        </Card>
        <Card bordered={false} className="metric-card tone-orange">
          <span>已用额度</span>
          <strong>{formatQuota(user?.quotaUsed)}</strong>
        </Card>
        <Card bordered={false} className="metric-card tone-grey">
          <span>最近登录</span>
          <strong>{formatDateTime(user?.lastLoginAt)}</strong>
        </Card>
      </section>

      <Card title={<span><IconGift /> 兑换码充值</span>} bordered={false} className="dashboard-card wallet-card">
        <Typography.Paragraph type="tertiary">
          输入管理员生成的兑换码，成功后额度会立即写入当前账户。
        </Typography.Paragraph>
        <Space className="wallet-redeem-row" align="center">
          <Input value={code} placeholder="nodew-xxxx-xxxx" onChange={setCode} />
          <Button theme="solid" type="primary" loading={redeeming} onClick={() => void redeem()}>
            立即兑换
          </Button>
        </Space>
      </Card>
    </main>
  );
}
