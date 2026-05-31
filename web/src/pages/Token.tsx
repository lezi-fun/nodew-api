import { Button, Input, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCopy, IconDelete, IconEdit, IconLock, IconUnlock } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type CreatedTokenItem, type TokenItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

type TokenDraft = {
  id?: string;
  name: string;
  quotaRemaining: string;
  expiresAt: string;
  allowedModels: string;
  blockedModels: string;
};

const emptyDraft: TokenDraft = {
  name: '',
  quotaRemaining: '',
  expiresAt: '',
  allowedModels: '',
  blockedModels: '',
};

const splitModelList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const readModelList = (metadata: TokenItem['metadata'], key: 'allowedModels' | 'blockedModels') => {
  const value = metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join(', ') : '';
};

const toDraft = (token?: TokenItem): TokenDraft => {
  if (!token) {
    return emptyDraft;
  }

  return {
    id: token.id,
    name: token.name,
    quotaRemaining: token.quotaRemaining ?? '',
    expiresAt: token.expiresAt ?? '',
    allowedModels: readModelList(token.metadata, 'allowedModels'),
    blockedModels: readModelList(token.metadata, 'blockedModels'),
  };
};

const buildMetadata = (draft: TokenDraft) => {
  const metadata: Record<string, unknown> = {};
  const allowedModels = splitModelList(draft.allowedModels);
  const blockedModels = splitModelList(draft.blockedModels);

  if (allowedModels.length > 0) {
    metadata.allowedModels = allowedModels;
  }

  if (blockedModels.length > 0) {
    metadata.blockedModels = blockedModels;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const copyText = async (value: string, message: string) => {
  await navigator.clipboard.writeText(value);
  Toast.success(message);
};

const createdTokenCache = new Map<string, string>();

export default function TokenPage() {
  const [rows, setRows] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<TokenDraft>(emptyDraft);
  const [createdToken, setCreatedToken] = useState<CreatedTokenItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listTokens();
      setRows(response.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载令牌失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;

  const openCreate = () => {
    setDraft({ ...emptyDraft });
    setModalVisible(true);
  };

  const openEdit = (token: TokenItem) => {
    setDraft(toDraft(token));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSaving(false);
  };

  const submitDraft = async () => {
    if (!draft.name.trim()) {
      Toast.error('请填写令牌名称');
      return;
    }

    setSaving(true);
    try {
      const metadata = buildMetadata(draft);

      if (draft.id) {
        await api.updateToken(draft.id, {
          name: draft.name.trim(),
          quotaRemaining: draft.quotaRemaining.trim() || null,
          expiresAt: draft.expiresAt.trim() || null,
          metadata: metadata ?? null,
        });
        Toast.success('令牌已更新');
      } else {
        const response = await api.createToken({
          name: draft.name.trim(),
          ...(draft.quotaRemaining.trim() ? { quotaRemaining: draft.quotaRemaining.trim() } : {}),
          ...(draft.expiresAt.trim() ? { expiresAt: draft.expiresAt.trim() } : {}),
          ...(metadata ? { metadata } : {}),
        });
        createdTokenCache.set(response.item.id, response.item.key);
        setCreatedToken(response.item);
        Toast.success('令牌已创建');
      }

      closeModal();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存令牌失败');
      setSaving(false);
    }
  };

  const updateStatus = async (token: TokenItem, status: 'ACTIVE' | 'REVOKED') => {
    try {
      await api.updateToken(token.id, { status });
      Toast.success(status === 'ACTIVE' ? '令牌已恢复' : '令牌已撤销');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '更新令牌失败');
    }
  };

  const deleteToken = async (token: TokenItem) => {
    if (!window.confirm(`删除令牌「${token.name}」？该操作不可恢复。`)) {
      return;
    }

    try {
      await api.deleteToken(token.id);
      Toast.success('令牌已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除令牌失败');
    }
  };

  const copyToken = async (token: TokenItem) => {
    const plaintextKey = createdTokenCache.get(token.id);

    if (!plaintextKey) {
      Toast.warning('当前只能复制本次创建后仍在本会话内保留的明文 key。刷新后请使用创建弹窗中保存的 key。');
      return;
    }

    await copyText(plaintextKey, 'API Key 已复制');
  };

  return (
    <>
      <ConsoleTablePage
        title="令牌管理"
        description="管理终端应用访问凭证、额度、过期时间和模型访问策略。"
        note="明文 key 只会在创建成功后显示一次；模型 allow/block 列表支持通配符，例如 gpt-*。"
        eyebrow="Access"
        rows={rows}
        loading={loading}
        primaryActionText="创建令牌"
        onPrimaryAction={openCreate}
        onRefresh={load}
        stats={[
          { label: '总令牌', value: rows.length, tone: 'blue' },
          { label: '活跃', value: activeCount, tone: 'green' },
          { label: '已撤销', value: rows.length - activeCount, tone: 'red' },
        ]}
        searchKeys={['name', 'keyPrefix', 'maskedKey', 'status']}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            render: (value, record) => (
              <div className="table-primary-cell">
                <strong>{String(value)}</strong>
                <span>{record.maskedKey}</span>
              </div>
            ),
          },
          { title: 'Key Prefix', dataIndex: 'keyPrefix', render: (value) => <Tag>{String(value)}</Tag> },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'red'}>{String(value)}</Tag>,
          },
          { title: '剩余额度', dataIndex: 'quotaRemaining', render: (value) => formatQuota(value as string | null) },
          {
            title: '模型策略',
            dataIndex: 'metadata',
            render: (_value, record) => {
              const allowed = splitModelList(readModelList(record.metadata, 'allowedModels'));
              const blocked = splitModelList(readModelList(record.metadata, 'blockedModels'));
              return (
                <Space wrap>
                  {allowed.length > 0 ? <Tag color="green">allow {allowed.length}</Tag> : null}
                  {blocked.length > 0 ? <Tag color="red">block {blocked.length}</Tag> : null}
                  {allowed.length === 0 && blocked.length === 0 ? '-' : null}
                </Space>
              );
            },
          },
          { title: '最后使用', dataIndex: 'lastUsedAt', render: (value) => formatDateTime(value as string | null) },
          { title: '过期时间', dataIndex: 'expiresAt', render: (value) => formatDateTime(value as string | null) },
          {
            title: '操作',
            dataIndex: 'id',
            render: (_value, record) => (
              <Space wrap>
                <Button size="small" icon={<IconCopy />} onClick={() => void copyToken(record)}>复制</Button>
                <Button size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>编辑</Button>
                {record.status === 'ACTIVE'
                  ? <Button size="small" type="warning" icon={<IconLock />} onClick={() => void updateStatus(record, 'REVOKED')}>撤销</Button>
                  : <Button size="small" icon={<IconUnlock />} onClick={() => void updateStatus(record, 'ACTIVE')}>恢复</Button>}
                <Button size="small" type="danger" icon={<IconDelete />} onClick={() => void deleteToken(record)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={draft.id ? '编辑令牌' : '创建令牌'}
        visible={modalVisible}
        onOk={() => void submitDraft()}
        onCancel={closeModal}
        confirmLoading={saving}
        width={680}
      >
        <div className="form-grid two-columns">
          <label>
            <span>名称</span>
            <Input value={draft.name} placeholder="my-service-token" onChange={(name) => setDraft((current) => ({ ...current, name }))} />
          </label>
          <label>
            <span>剩余额度</span>
            <Input value={draft.quotaRemaining} placeholder="留空表示不限" onChange={(quotaRemaining) => setDraft((current) => ({ ...current, quotaRemaining }))} />
          </label>
          <label className="form-wide">
            <span>过期时间</span>
            <Input value={draft.expiresAt} placeholder="2026-12-31T23:59:59.000Z" onChange={(expiresAt) => setDraft((current) => ({ ...current, expiresAt }))} />
          </label>
          <label>
            <span>允许模型</span>
            <Input value={draft.allowedModels} placeholder="gpt-4o, claude-3-5-*" onChange={(allowedModels) => setDraft((current) => ({ ...current, allowedModels }))} />
          </label>
          <label>
            <span>禁止模型</span>
            <Input value={draft.blockedModels} placeholder="gpt-4o-audio-*" onChange={(blockedModels) => setDraft((current) => ({ ...current, blockedModels }))} />
          </label>
        </div>
      </Modal>

      <Modal
        title="令牌已创建"
        visible={Boolean(createdToken)}
        onOk={() => setCreatedToken(null)}
        onCancel={() => setCreatedToken(null)}
        okText="我已保存"
        cancelText="关闭"
      >
        <Typography.Paragraph type="warning">
          明文 key 只显示这一次。关闭后只能看到 masked key。
        </Typography.Paragraph>
        <div className="secret-box">
          <code>{createdToken?.key}</code>
          <Button icon={<IconCopy />} onClick={() => createdToken ? void copyText(createdToken.key, 'API Key 已复制') : undefined}>复制</Button>
        </div>
      </Modal>
    </>
  );
}
