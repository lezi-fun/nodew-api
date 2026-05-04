import { Button, Input, Modal, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCopy, IconDelete, IconEdit, IconGift, IconLock, IconUnlock } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type CreatedRedemptionItem, type RedemptionItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

type RedemptionDraft = {
  id?: string;
  quotaAmount: string;
  status: RedemptionItem['status'];
  expiresAt: string;
};

type StatusFilter = 'all' | RedemptionItem['status'];

const emptyDraft: RedemptionDraft = {
  quotaAmount: '',
  status: 'ACTIVE',
  expiresAt: '',
};

const toDraft = (redemption?: RedemptionItem): RedemptionDraft => {
  if (!redemption) {
    return emptyDraft;
  }

  return {
    id: redemption.id,
    quotaAmount: redemption.quotaAmount,
    status: redemption.status,
    expiresAt: redemption.expiresAt ?? '',
  };
};

const copyText = async (value: string, message: string) => {
  await navigator.clipboard.writeText(value);
  Toast.success(message);
};

export default function RedemptionPage() {
  const [rows, setRows] = useState<RedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<RedemptionDraft>(emptyDraft);
  const [createdRedemption, setCreatedRedemption] = useState<CreatedRedemptionItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listRedemptions({
        limit: 100,
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      });
      setRows(response.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载兑换码失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;
  const redeemedCount = rows.filter((row) => row.status === 'REDEEMED').length;
  const revokedCount = rows.filter((row) => row.status === 'REVOKED').length;

  const openCreate = () => {
    setDraft({ ...emptyDraft });
    setModalVisible(true);
  };

  const openEdit = (redemption: RedemptionItem) => {
    setDraft(toDraft(redemption));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSaving(false);
  };

  const submitDraft = async () => {
    if (!draft.quotaAmount.trim()) {
      Toast.error('请填写额度');
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await api.updateRedemption(draft.id, {
          quotaAmount: draft.quotaAmount.trim(),
          status: draft.status,
          expiresAt: draft.expiresAt.trim() || null,
        });
        Toast.success('兑换码已更新');
      } else {
        const response = await api.createRedemption({
          quotaAmount: draft.quotaAmount.trim(),
          ...(draft.expiresAt.trim() ? { expiresAt: draft.expiresAt.trim() } : {}),
        });
        setCreatedRedemption(response.item);
        Toast.success('兑换码已生成');
      }

      closeModal();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存兑换码失败');
      setSaving(false);
    }
  };

  const updateStatus = async (redemption: RedemptionItem, status: RedemptionItem['status']) => {
    try {
      await api.updateRedemption(redemption.id, { status });
      Toast.success(status === 'ACTIVE' ? '兑换码已恢复' : '兑换码已撤销');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '更新兑换码失败');
    }
  };

  const deleteRedemption = async (redemption: RedemptionItem) => {
    if (!window.confirm(`删除兑换码「${redemption.maskedCode}」？该操作不可恢复。`)) {
      return;
    }

    try {
      await api.deleteRedemption(redemption.id);
      Toast.success('兑换码已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除兑换码失败');
    }
  };

  return (
    <>
      <ConsoleTablePage
        title="兑换码管理"
        description="生成额度兑换码，管理状态、过期时间和核销信息。"
        note="明文兑换码只会在生成成功后显示一次；已核销记录建议保留用于审计。"
        eyebrow="Growth"
        rows={rows}
        loading={loading}
        primaryActionText="生成兑换码"
        onPrimaryAction={openCreate}
        onRefresh={load}
        toolbarExtra={
          <Select value={statusFilter} onChange={(value) => setStatusFilter(String(value) as StatusFilter)} style={{ width: 132 }}>
            <Select.Option value="all">全部状态</Select.Option>
            <Select.Option value="ACTIVE">可用</Select.Option>
            <Select.Option value="REDEEMED">已核销</Select.Option>
            <Select.Option value="REVOKED">已撤销</Select.Option>
          </Select>
        }
        stats={[
          { label: '总数量', value: rows.length, tone: 'blue' },
          { label: '可用', value: activeCount, tone: 'green' },
          { label: '已核销', value: redeemedCount, tone: 'orange' },
          { label: '已撤销', value: revokedCount, tone: 'grey' },
        ]}
        searchKeys={['maskedCode', 'status', 'quotaAmount', 'codePrefix']}
        columns={[
          {
            title: '兑换码',
            dataIndex: 'maskedCode',
            render: (value, record) => (
              <div className="table-primary-cell">
                <strong>{String(value)}</strong>
                <span>prefix: {record.codePrefix}</span>
              </div>
            ),
          },
          { title: '额度', dataIndex: 'quotaAmount', render: (value) => formatQuota(value as string) },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => {
              const color = value === 'ACTIVE' ? 'green' : value === 'REDEEMED' ? 'blue' : 'orange';
              return <Tag color={color}>{String(value)}</Tag>;
            },
          },
          { title: '创建人', dataIndex: 'createdBy', render: (value) => (value && typeof value === 'object' && 'email' in value ? String(value.email) : '-') },
          { title: '核销用户', dataIndex: 'redeemedByUser', render: (value) => (value && typeof value === 'object' && 'email' in value ? String(value.email) : '-') },
          { title: '过期时间', dataIndex: 'expiresAt', render: (value) => formatDateTime(value as string | null) },
          { title: '创建时间', dataIndex: 'createdAt', render: (value) => formatDateTime(value as string | null) },
          {
            title: '操作',
            dataIndex: 'id',
            render: (_value, record) => (
              <Space wrap>
                <Button size="small" icon={<IconCopy />} onClick={() => void copyText(record.codePrefix, 'Code Prefix 已复制')}>复制</Button>
                <Button size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>编辑</Button>
                {record.status === 'ACTIVE'
                  ? <Button size="small" type="warning" icon={<IconLock />} onClick={() => void updateStatus(record, 'REVOKED')}>撤销</Button>
                  : record.status === 'REVOKED'
                    ? <Button size="small" icon={<IconUnlock />} onClick={() => void updateStatus(record, 'ACTIVE')}>恢复</Button>
                    : null}
                <Button size="small" type="danger" icon={<IconDelete />} onClick={() => void deleteRedemption(record)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={draft.id ? '编辑兑换码' : '生成兑换码'}
        visible={modalVisible}
        onOk={() => void submitDraft()}
        onCancel={closeModal}
        confirmLoading={saving}
        width={620}
      >
        <div className="form-grid two-columns">
          <label>
            <span>额度</span>
            <Input value={draft.quotaAmount} placeholder="100000" onChange={(quotaAmount) => setDraft((current) => ({ ...current, quotaAmount }))} />
          </label>
          {draft.id ? (
            <label>
              <span>状态</span>
              <Select value={draft.status} onChange={(status) => setDraft((current) => ({ ...current, status: String(status) as RedemptionDraft['status'] }))}>
                <Select.Option value="ACTIVE">ACTIVE</Select.Option>
                <Select.Option value="REDEEMED">REDEEMED</Select.Option>
                <Select.Option value="REVOKED">REVOKED</Select.Option>
              </Select>
            </label>
          ) : null}
          <label className="form-wide">
            <span>过期时间</span>
            <Input value={draft.expiresAt} placeholder="2026-12-31T23:59:59.000Z" onChange={(expiresAt) => setDraft((current) => ({ ...current, expiresAt }))} />
          </label>
        </div>
      </Modal>

      <Modal
        title="兑换码已生成"
        visible={Boolean(createdRedemption)}
        onOk={() => setCreatedRedemption(null)}
        onCancel={() => setCreatedRedemption(null)}
        okText="我已保存"
        cancelText="关闭"
      >
        <Typography.Paragraph type="warning">
          明文兑换码只显示这一次。关闭后只能看到 masked code。
        </Typography.Paragraph>
        <div className="secret-box">
          <code>{createdRedemption?.code}</code>
          <Button icon={<IconGift />} onClick={() => createdRedemption ? void copyText(createdRedemption.code, '兑换码已复制') : undefined}>复制</Button>
        </div>
      </Modal>
    </>
  );
}
