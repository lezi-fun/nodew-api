import { Tag } from '@douyinfe/semi-ui';

import ConsoleTablePage from '../components/common/ConsoleTablePage';

type DrawingLogRow = {
  id: string;
  action: string;
  prompt: string;
  status: string;
  createdAt: string;
};

export default function MidjourneyPage() {
  const rows: DrawingLogRow[] = [];

  return (
    <ConsoleTablePage
      title="绘图日志"
      description="预留绘图、多模态和图片生成任务日志入口。"
      note="当前 nodew-api Relay 已包含图片生成端点，独立绘图任务日志 API 后续接入。"
      eyebrow="Images"
      rows={rows}
      loading={false}
      stats={[
        { label: '任务数', value: 0, tone: 'blue' },
        { label: '排队中', value: 0, tone: 'orange' },
        { label: '完成', value: 0, tone: 'green' },
        { label: '失败', value: 0, tone: 'red' },
      ]}
      searchKeys={['id', 'action', 'prompt', 'status']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '动作', dataIndex: 'action' },
        { title: '提示词', dataIndex: 'prompt' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: '创建时间', dataIndex: 'createdAt' },
      ]}
    />
  );
}
