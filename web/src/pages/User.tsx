import { Button, Input, Modal, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconKey, IconLock, IconRefresh, IconUnlock } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type GroupItem, type UserItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

type UserDraft = {
  id?: string;
  email: string;
  username: string;
  password: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  groupId: string;
  quotaRemaining: string;
};

const emptyDraft: UserDraft = {
  email: '',
  username: '',
  password: '',
  displayName: '',
  role: 'USER',
  status: 'ACTIVE',
  groupId: '',
  quotaRemaining: '',
};

const toDraft = (user?: UserItem): UserDraft => {
  if (!user) {
    return emptyDraft;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    password: '',
    displayName: user.displayName ?? '',
    role: user.role,
    status: user.status,
    groupId: user.group?.id ?? '',
    quotaRemaining: user.quotaRemaining,
  };
};

const copyText = async (value: string, message: string) => {
  await navigator.clipboard.writeText(value);
  Toast.success(message);
};

export default function UserPage() {
  const { user: currentUser } = useContext(UserContext);
  const [rows, setRows] = useState<UserItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [passwordUser, setPasswordUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        api.listUsers({ limit: 100 }),
        api.listGroups({ limit: 100 }),
      ]);
      setRows(usersResponse.items ?? []);
      setGroups(groupsResponse.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const adminCount = rows.filter((row) => row.role === 'ADMIN').length;
  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;

  const openCreate = () => {
    setDraft({ ...emptyDraft });
    setModalVisible(true);
  };

  const openEdit = (user: UserItem) => {
    setDraft(toDraft(user));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSaving(false);
  };

  const submitDraft = async () => {
    if (!draft.email.trim() || !draft.username.trim()) {
      Toast.error('请填写邮箱和用户名');
      return;
    }

    if (!draft.id && draft.password.length < 8) {
      Toast.error('新用户密码至少 8 位');
      return;
    }

    setSaving(true);
    try {
      const commonPayload = {
        email: draft.email.trim(),
        username: draft.username.trim(),
        displayName: draft.displayName.trim() || null,
        role: draft.role,
        status: draft.status,
        groupId: draft.groupId || null,
        ...(draft.quotaRemaining.trim() ? { quotaRemaining: draft.quotaRemaining.trim() } : {}),
      };

      if (draft.id) {
        await api.updateUser(draft.id, commonPayload);
        Toast.success('用户已更新');
      } else {
        await api.createUser({
          ...commonPayload,
          displayName: draft.displayName.trim() || undefined,
          password: draft.password,
        });
        Toast.success('用户已创建');
      }

      closeModal();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存用户失败');
      setSaving(false);
    }
  };

  const updateStatus = async (target: UserItem, status: UserItem['status']) => {
    try {
      await api.updateUser(target.id, { status });
      Toast.success(status === 'ACTIVE' ? '用户已启用' : '用户已禁用');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '更新用户状态失败');
    }
  };

  const resetPassword = async () => {
    if (!passwordUser) {
      return;
    }

    if (newPassword.length < 8) {
      Toast.error('新密码至少 8 位');
      return;
    }

    try {
      await api.resetUserPassword(passwordUser.id, { password: newPassword, revokeSession: true });
      Toast.success('密码已重置，会话已撤销');
      setPasswordUser(null);
      setNewPassword('');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '重置密码失败');
    }
  };

  const revokeSession = async (target: UserItem) => {
    try {
      await api.revokeUserSession(target.id);
      Toast.success('用户会话已撤销');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '撤销会话失败');
    }
  };

  const generateAccessToken = async (target: UserItem) => {
    try {
      const response = await api.generateUserAccessToken(target.id);
      setAccessToken(response.accessToken);
      Toast.success('Access token 已生成');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '生成 access token 失败');
    }
  };

  const deleteUser = async (target: UserItem) => {
    if (!window.confirm(`删除用户「${target.email}」？该操作不可恢复。`)) {
      return;
    }

    try {
      await api.deleteUser(target.id);
      Toast.success('用户已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除用户失败');
    }
  };

  return (
    <>
      <ConsoleTablePage
        title="用户管理"
        description="管理账户、角色、状态、分组、额度和会话。"
        note="禁用用户会自动撤销 access token；重置密码默认撤销已有会话。"
        eyebrow="Identity"
        rows={rows}
        loading={loading}
        primaryActionText="新增用户"
        onPrimaryAction={openCreate}
        onRefresh={load}
        stats={[
          { label: '总用户', value: rows.length, tone: 'blue' },
          { label: '活跃', value: activeCount, tone: 'green' },
          { label: '管理员', value: adminCount, tone: 'orange' },
          { label: '禁用', value: rows.length - activeCount, tone: 'red' },
        ]}
        searchKeys={['email', 'username', 'displayName', 'role', 'status']}
        columns={[
          {
            title: '账号',
            dataIndex: 'email',
            render: (value, record) => (
              <div className="table-primary-cell">
                <strong>{String(value)}</strong>
                <span>{record.displayName ?? record.username}</span>
              </div>
            ),
          },
          {
            title: '角色',
            dataIndex: 'role',
            render: (value) => <Tag color={value === 'ADMIN' ? 'blue' : 'grey'}>{String(value)}</Tag>,
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'orange'}>{String(value)}</Tag>,
          },
          { title: '分组', dataIndex: 'group', render: (value) => (value && typeof value === 'object' && 'name' in value ? String(value.name) : '-') },
          { title: '剩余额度', dataIndex: 'quotaRemaining', render: (value) => formatQuota(value as string) },
          { title: '已用额度', dataIndex: 'quotaUsed', render: (value) => formatQuota(value as string) },
          { title: '最后登录', dataIndex: 'lastLoginAt', render: (value) => formatDateTime(value as string | null) },
          {
            title: '操作',
            dataIndex: 'id',
            render: (_value, record) => (
              <Space wrap>
                <Button size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>编辑</Button>
                {record.status === 'ACTIVE'
                  ? <Button size="small" type="warning" icon={<IconLock />} onClick={() => void updateStatus(record, 'DISABLED')}>禁用</Button>
                  : <Button size="small" icon={<IconUnlock />} onClick={() => void updateStatus(record, 'ACTIVE')}>启用</Button>}
                <Button size="small" icon={<IconRefresh />} onClick={() => setPasswordUser(record)}>重置密码</Button>
                <Button size="small" icon={<IconKey />} onClick={() => void generateAccessToken(record)}>Token</Button>
                <Button size="small" onClick={() => void revokeSession(record)}>撤销会话</Button>
                <Button
                  size="small"
                  type="danger"
                  icon={<IconDelete />}
                  disabled={record.id === currentUser?.id}
                  onClick={() => void deleteUser(record)}
                >
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={draft.id ? '编辑用户' : '新增用户'}
        visible={modalVisible}
        onOk={() => void submitDraft()}
        onCancel={closeModal}
        confirmLoading={saving}
        width={760}
      >
        <div className="form-grid two-columns">
          <label>
            <span>邮箱</span>
            <Input value={draft.email} onChange={(email) => setDraft((current) => ({ ...current, email }))} />
          </label>
          <label>
            <span>用户名</span>
            <Input value={draft.username} onChange={(username) => setDraft((current) => ({ ...current, username }))} />
          </label>
          {!draft.id ? (
            <label className="form-wide">
              <span>初始密码</span>
              <Input mode="password" value={draft.password} onChange={(password) => setDraft((current) => ({ ...current, password }))} />
            </label>
          ) : null}
          <label>
            <span>显示名</span>
            <Input value={draft.displayName} onChange={(displayName) => setDraft((current) => ({ ...current, displayName }))} />
          </label>
          <label>
            <span>角色</span>
            <Select value={draft.role} onChange={(role) => setDraft((current) => ({ ...current, role: String(role) as UserDraft['role'] }))}>
              <Select.Option value="USER">USER</Select.Option>
              <Select.Option value="ADMIN">ADMIN</Select.Option>
            </Select>
          </label>
          <label>
            <span>状态</span>
            <Select value={draft.status} onChange={(status) => setDraft((current) => ({ ...current, status: String(status) as UserDraft['status'] }))}>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="DISABLED">DISABLED</Select.Option>
            </Select>
          </label>
          <label>
            <span>分组</span>
            <Select value={draft.groupId} onChange={(groupId) => setDraft((current) => ({ ...current, groupId: String(groupId) }))}>
              <Select.Option value="">无分组</Select.Option>
              {groups.map((group) => <Select.Option key={group.id} value={group.id}>{group.name}</Select.Option>)}
            </Select>
          </label>
          <label className="form-wide">
            <span>剩余额度</span>
            <Input value={draft.quotaRemaining} placeholder="留空不修改" onChange={(quotaRemaining) => setDraft((current) => ({ ...current, quotaRemaining }))} />
          </label>
        </div>
      </Modal>

      <Modal
        title={passwordUser ? `重置 ${passwordUser.email} 的密码` : '重置密码'}
        visible={Boolean(passwordUser)}
        onOk={() => void resetPassword()}
        onCancel={() => {
          setPasswordUser(null);
          setNewPassword('');
        }}
      >
        <Input mode="password" value={newPassword} placeholder="新密码，至少 8 位" onChange={setNewPassword} />
      </Modal>

      <Modal
        title="Access token 已生成"
        visible={Boolean(accessToken)}
        onOk={() => setAccessToken(null)}
        onCancel={() => setAccessToken(null)}
        okText="我已保存"
      >
        <Typography.Paragraph type="warning">该 token 可用于用户级访问，请按敏感凭证保存。</Typography.Paragraph>
        <div className="secret-box">
          <code>{accessToken}</code>
          <Button icon={<IconKey />} onClick={() => accessToken ? void copyText(accessToken, 'Access token 已复制') : undefined}>复制</Button>
        </div>
      </Modal>
    </>
  );
}
