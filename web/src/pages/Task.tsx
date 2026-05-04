import { Tag } from '@douyinfe/semi-ui';

import ConsoleTablePage from '../components/common/ConsoleTablePage';

type TaskRow = {
  id: string;
  type: string;
  status: string;
  model: string;
  createdAt: string;
};

export default function TaskPage() {
  const rows: TaskRow[] = [];

  return (
    <ConsoleTablePage
      title="任务日志"
      description="异步任务、批量操作和后台队列的审计入口。"
      note="当前后端尚未提供 task log API，本页先保持原版控制台入口和表格交互。"
      eyebrow="Tasks"
      rows={rows}
      loading={false}
      stats={[
        { label: '任务数', value: 0, tone: 'blue' },
        { label: '运行中', value: 0, tone: 'orange' },
        { label: '成功', value: 0, tone: 'green' },
        { label: '失败', value: 0, tone: 'red' },
      ]}
      searchKeys={['id', 'type', 'status', 'model']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '类型', dataIndex: 'type' },
        { title: '模型', dataIndex: 'model' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: '创建时间', dataIndex: 'createdAt' },
      ]}
    />
  );
}
