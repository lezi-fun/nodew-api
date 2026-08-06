import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconSave } from '@douyinfe/semi-icons';

import type { SystemOptionKey } from '../../../lib/api';
import type { SettingsOptionMeta } from '../option-metadata';
import SettingsOptionGrid from './SettingsOptionGrid';

type SettingsOptionCardProps = {
  visible: boolean;
  title: string;
  description: string;
  options: ReadonlyArray<SettingsOptionMeta>;
  values: Partial<Record<SystemOptionKey, string>>;
  saving: boolean;
  saveLabel: string;
  onChange: (key: SystemOptionKey, value: string) => void;
  onSave: () => void;
  isNonBooleanDisabled?: (option: SettingsOptionMeta) => boolean;
};

export default function SettingsOptionCard({
  visible,
  title,
  description,
  options,
  values,
  saving,
  saveLabel,
  onChange,
  onSave,
  isNonBooleanDisabled,
}: SettingsOptionCardProps) {
  return (
    <Card
      bordered={false}
      className="dashboard-card settings-card"
      style={{ marginTop: 16, display: visible ? undefined : 'none' }}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <div>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>{title}</Typography.Title>
          <Typography.Paragraph type="tertiary">{description}</Typography.Paragraph>
        </div>
        <SettingsOptionGrid
          options={options}
          values={values}
          onChange={onChange}
          isNonBooleanDisabled={isNonBooleanDisabled}
        />
        <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={onSave}>
          {saveLabel}
        </Button>
      </Space>
    </Card>
  );
}
