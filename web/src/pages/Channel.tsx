import { Button, Input, Modal, Select, Space, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCopy, IconDelete, IconEdit, IconPlay, IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type ChannelItem, type ChannelPayload } from '../lib/api';
import { formatDateTime } from '../lib/format';

type ChannelDraft = {
  id?: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  status: 'ACTIVE' | 'DISABLED';
  priority: string;
  weight: string;
  rateLimitPerMin: string;
  metadata: string;
};

const providerOptions = [
  'openai',
  'openai-compatible',
  'openrouter',
  'deepseek',
  'siliconflow',
  'xai',
  'moonshot',
  'mistral',
  'perplexity',
  'together',
  'groq',
  'fireworks',
  'ollama',
  'anthropic',
  'google',
];

const emptyDraft: ChannelDraft = {
  name: '',
  provider: 'openai',
  baseUrl: '',
  model: '',
  apiKey: '',
  status: 'ACTIVE',
  priority: '0',
  weight: '1',
  rateLimitPerMin: '',
  metadata: '{\n  "models": []\n}',
};

const stringifyMetadata = (metadata: ChannelItem['metadata']) =>
  JSON.stringify(metadata ?? { models: [] }, null, 2);

const toDraft = (channel?: ChannelItem): ChannelDraft => {
  if (!channel) {
    return emptyDraft;
  }

  return {
    id: channel.id,
    name: channel.name,
    provider: channel.provider,
    baseUrl: channel.baseUrl ?? '',
    model: channel.model ?? '',
    apiKey: '',
    status: channel.status,
    priority: String(channel.priority),
    weight: String(channel.weight),
    rateLimitPerMin: channel.rateLimitPerMin ? String(channel.rateLimitPerMin) : '',
    metadata: stringifyMetadata(channel.metadata),
  };
};

const parseOptionalJson = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('metadata 必须是 JSON object');
  }

  return parsed as Record<string, unknown>;
};

const toPayload = (draft: ChannelDraft): ChannelPayload & { apiKey?: string } => ({
  name: draft.name.trim(),
  provider: draft.provider.trim(),
  baseUrl: draft.baseUrl.trim() || null,
  model: draft.model.trim() || null,
  ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
  status: draft.status,
  priority: Number(draft.priority || 0),
  weight: Number(draft.weight || 1),
  rateLimitPerMin: draft.rateLimitPerMin.trim() ? Number(draft.rateLimitPerMin) : null,
  metadata: parseOptionalJson(draft.metadata),
});

export default function ChannelPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listChannels();
      setRows(response.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载渠道失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const action = searchParams.get('action');
    const model = searchParams.get('model')?.trim() ?? '';

    if (action !== 'create' || !model) {
      return;
    }

    const providerHint = searchParams.get('provider')?.trim() || 'openai';
    const suggestedName = searchParams.get('name')?.trim() || `${model} Channel`;
    const metadataModels = JSON.stringify({ models: [model] }, null, 2);

    setDraft({
      ...emptyDraft,
      name: suggestedName,
      provider: providerHint,
      model,
      metadata: metadataModels,
    });
    setModalVisible(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    nextParams.delete('model');
    nextParams.delete('provider');
    nextParams.delete('name');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;
  const providerCount = new Set(rows.map((row) => row.provider)).size;

  const openCreate = () => {
    setDraft({ ...emptyDraft });
    setModalVisible(true);
  };

  const openEdit = (channel: ChannelItem) => {
    setDraft(toDraft(channel));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSaving(false);
  };

  const submitDraft = async () => {
    if (!draft.name.trim()) {
      Toast.error('请填写渠道名称');
      return;
    }

    if (!draft.id && !draft.apiKey.trim()) {
      Toast.error('新增渠道必须填写 API Key');
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(draft);

      if (draft.id) {
        await api.updateChannel(draft.id, payload);
        Toast.success('渠道已更新');
      } else {
        await api.createChannel(payload as ChannelPayload & { apiKey: string });
        Toast.success('渠道已创建');
      }

      closeModal();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存渠道失败');
      setSaving(false);
    }
  };

  const testChannel = async (channel: ChannelItem) => {
    setTestingId(channel.id);
    try {
      const response = await api.testChannel(channel.id, channel.model ? { model: channel.model } : undefined);
      const result = response.item;
      if (result.success) {
        Toast.success(`测试成功，HTTP ${result.statusCode}`);
      } else {
        Toast.error(result.errorMessage ?? `测试失败，HTTP ${result.statusCode}`);
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '测试渠道失败');
    } finally {
      setTestingId(null);
    }
  };

  const syncModels = async (channel: ChannelItem) => {
    setSyncingId(channel.id);
    try {
      const response = await api.syncChannelModels(channel.id);
      if (response.item.success) {
        Toast.success(`已同步 ${response.item.total} 个模型`);
        await load();
      } else {
        Toast.error(response.item.errorMessage ?? '同步模型失败');
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '同步模型失败');
    } finally {
      setSyncingId(null);
    }
  };

  const copyChannel = async (channel: ChannelItem) => {
    try {
      await api.copyChannel(channel.id);
      Toast.success('渠道副本已创建');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '复制渠道失败');
    }
  };

  const deleteChannel = async (channel: ChannelItem) => {
    if (!window.confirm(`删除渠道「${channel.name}」？该操作不可恢复。`)) {
      return;
    }

    try {
      await api.deleteChannel(channel.id);
      Toast.success('渠道已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除渠道失败');
    }
  };

  const modelStats = useMemo(() => {
    const models = rows.flatMap((row) => {
      const list = row.metadata?.models;
      return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
    });

    return new Set(models).size;
  }, [rows]);

  return (
    <>
      <ConsoleTablePage
        title="渠道管理"
        description="管理上游供应商、模型路由、优先级、权重和自动发现模型。"
        note="新增渠道后可先测试连通性，再同步模型列表；metadata 会参与 relay 路由和计费策略。"
        eyebrow="Gateway"
        rows={rows}
        loading={loading}
        primaryActionText="新增渠道"
        onPrimaryAction={openCreate}
        onRefresh={load}
        stats={[
          { label: '总渠道', value: rows.length, tone: 'blue' },
          { label: '活跃渠道', value: activeCount, tone: 'green' },
          { label: '供应商', value: providerCount, tone: 'orange' },
          { label: '已同步模型', value: modelStats, tone: 'grey' },
        ]}
        searchKeys={['name', 'provider', 'model', 'baseUrl', 'status']}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            render: (value, record) => (
              <div className="table-primary-cell">
                <strong>{String(value)}</strong>
                <span>{record.keyPreview}</span>
              </div>
            ),
          },
          { title: '提供商', dataIndex: 'provider', render: (value) => <Tag color="cyan">{String(value)}</Tag> },
          { title: '模型', dataIndex: 'model', render: (value) => value ? <Tag>{String(value)}</Tag> : <Tag color="grey">wildcard</Tag> },
          { title: 'Base URL', dataIndex: 'baseUrl', render: (value) => value ? String(value) : '-' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'orange'}>{String(value)}</Tag>,
          },
          { title: '优先级', dataIndex: 'priority' },
          { title: '权重', dataIndex: 'weight' },
          { title: '限速', dataIndex: 'rateLimitPerMin', render: (value) => value ? `${String(value)}/min` : '-' },
          { title: '更新', dataIndex: 'updatedAt', render: (value) => formatDateTime(String(value)) },
          {
            title: '操作',
            dataIndex: 'id',
            render: (_value, record) => (
              <Space wrap>
                <Button size="small" icon={<IconPlay />} loading={testingId === record.id} onClick={() => void testChannel(record)}>测试</Button>
                <Button size="small" icon={<IconRefresh />} loading={syncingId === record.id} onClick={() => void syncModels(record)}>同步</Button>
                <Button size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>编辑</Button>
                <Button size="small" icon={<IconCopy />} onClick={() => void copyChannel(record)}>复制</Button>
                <Button size="small" type="danger" icon={<IconDelete />} onClick={() => void deleteChannel(record)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={draft.id ? '编辑渠道' : '新增渠道'}
        visible={modalVisible}
        onOk={() => void submitDraft()}
        onCancel={closeModal}
        confirmLoading={saving}
        width={760}
      >
        <div className="form-grid two-columns">
          <label>
            <span>名称</span>
            <Input value={draft.name} placeholder="OpenAI Primary" onChange={(name) => setDraft((current) => ({ ...current, name }))} />
          </label>
          <label>
            <span>提供商</span>
            <Select value={draft.provider} onChange={(provider) => setDraft((current) => ({ ...current, provider: String(provider) }))}>
              {providerOptions.map((provider) => <Select.Option key={provider} value={provider}>{provider}</Select.Option>)}
            </Select>
          </label>
          <label>
            <span>Base URL</span>
            <Input value={draft.baseUrl} placeholder="https://api.openai.com/v1" onChange={(baseUrl) => setDraft((current) => ({ ...current, baseUrl }))} />
          </label>
          <label>
            <span>模型</span>
            <Input value={draft.model} placeholder="留空表示 wildcard" onChange={(model) => setDraft((current) => ({ ...current, model }))} />
          </label>
          <label>
            <span>API Key</span>
            <Input mode="password" value={draft.apiKey} placeholder={draft.id ? '留空则不更新密钥' : 'sk-...'} onChange={(apiKey) => setDraft((current) => ({ ...current, apiKey }))} />
          </label>
          <label>
            <span>状态</span>
            <Select value={draft.status} onChange={(status) => setDraft((current) => ({ ...current, status: String(status) as ChannelDraft['status'] }))}>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="DISABLED">DISABLED</Select.Option>
            </Select>
          </label>
          <label>
            <span>优先级</span>
            <Input value={draft.priority} onChange={(priority) => setDraft((current) => ({ ...current, priority }))} />
          </label>
          <label>
            <span>权重</span>
            <Input value={draft.weight} onChange={(weight) => setDraft((current) => ({ ...current, weight }))} />
          </label>
          <label>
            <span>每分钟限速</span>
            <Input value={draft.rateLimitPerMin} placeholder="留空不限制" onChange={(rateLimitPerMin) => setDraft((current) => ({ ...current, rateLimitPerMin }))} />
          </label>
        </div>
        <label className="form-block">
          <span>Metadata JSON</span>
          <TextArea rows={8} value={draft.metadata} onChange={(metadata) => setDraft((current) => ({ ...current, metadata }))} />
        </label>
        <Typography.Text type="tertiary">
          常用字段：models、modelMap、headers、costPerMillionTokensCents、autoDisableFailureThreshold。
        </Typography.Text>
      </Modal>
    </>
  );
}
