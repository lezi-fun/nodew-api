import { Button, Card, Input, Space, Switch, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconSave, IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';

import { api, type SystemOptionItem, type SystemOptionKey } from '../lib/api';

const optionMeta: Array<{
  key: SystemOptionKey;
  title: string;
  description: string;
  type: 'text' | 'textarea' | 'boolean';
}> = [
  { key: 'site_name', title: '站点名称', description: '显示在浏览器标题、顶栏和公开页面。', type: 'text' },
  { key: 'site_description', title: '站点描述', description: '公开首页与控制台说明文案。', type: 'text' },
  { key: 'default_model', title: '默认模型', description: '操练场和示例请求的默认模型。', type: 'text' },
  { key: 'notice', title: '站点公告', description: '公开首页、关于页和控制台提示使用。', type: 'textarea' },
  { key: 'home_page_content', title: '首页补充内容', description: '展示在公开首页的补充 Markdown/纯文本内容。', type: 'textarea' },
  { key: 'about', title: '关于内容', description: '关于页面展示的项目或站点介绍。', type: 'textarea' },
  { key: 'user_agreement', title: '用户协议', description: '预留给注册和合规页面使用。', type: 'textarea' },
  { key: 'privacy_policy', title: '隐私政策', description: '预留给注册和合规页面使用。', type: 'textarea' },
  { key: 'registration_enabled', title: '允许注册', description: '关闭后仅管理员可创建用户。', type: 'boolean' },
  { key: 'self_use_mode_enabled', title: '自用模式', description: '隐藏注册和部分公开入口。', type: 'boolean' },
  { key: 'demo_site_enabled', title: '演示站点', description: '用于标记演示环境。', type: 'boolean' },
];

const toMap = (items: SystemOptionItem[]) =>
  Object.fromEntries(items.map((item) => [item.key, item.value])) as Partial<Record<SystemOptionKey, string>>;

export default function SettingPage() {
  const [values, setValues] = useState<Partial<Record<SystemOptionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listOptions();
      setValues(toMap(response.items ?? []));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(optionMeta.map((option) => api.updateOption(option.key, values[option.key] ?? '')));
      Toast.success('系统设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="console-page settings-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Settings</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>系统设置</Typography.Title>
          <Typography.Paragraph className="console-description">
            管理站点基础信息、注册开关和默认模型。配置会写入后端 system options。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void load()}>刷新</Button>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={() => void save()}>保存</Button>
        </Space>
      </section>

      <Card bordered={false} className="dashboard-card settings-card">
        <div className="settings-grid">
          {optionMeta.map((option) => (
            <label className="setting-field" key={option.key}>
              <span>
                <strong>{option.title}</strong>
                <em>{option.description}</em>
              </span>
              {option.type === 'boolean' ? (
                <Switch
                  checked={values[option.key] === 'true'}
                  onChange={(checked) => setValues((current) => ({ ...current, [option.key]: String(checked) }))}
                />
              ) : option.type === 'textarea' ? (
                <TextArea
                  rows={5}
                  value={values[option.key] ?? ''}
                  placeholder={option.key}
                  onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                />
              ) : (
                <Input
                  value={values[option.key] ?? ''}
                  placeholder={option.key}
                  onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                />
              )}
            </label>
          ))}
        </div>
      </Card>
    </main>
  );
}
