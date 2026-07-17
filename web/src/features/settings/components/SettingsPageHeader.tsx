import { Button, Space, Typography } from '@douyinfe/semi-ui';
import { IconRefresh, IconSave } from '@douyinfe/semi-icons';

import {
  getSettingSectionNavigationProps,
  getSettingSectionPageDescription,
  settingSections,
  type SettingSection,
} from '../sections';

type SettingsPageHeaderProps = {
  activeSection: SettingSection;
  loading: boolean;
  saving: boolean;
  onRefresh: () => void;
  onSaveGeneral: () => void;
  onSectionChange: (section: SettingSection) => void;
};

export default function SettingsPageHeader({
  activeSection,
  loading,
  saving,
  onRefresh,
  onSaveGeneral,
  onSectionChange,
}: SettingsPageHeaderProps) {
  return (
    <>
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Settings</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>系统设置</Typography.Title>
          <Typography.Paragraph className="console-description">
            {getSettingSectionPageDescription(activeSection)}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={onRefresh}>刷新</Button>
          {activeSection === 'general' ? (
            <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={onSaveGeneral}>
              保存基础设置
            </Button>
          ) : null}
        </Space>
      </section>

      <nav className="settings-section-nav" aria-label="设置业务域">
        {settingSections.map((section) => {
          const active = activeSection === section.key;

          return (
            <button
              key={section.key}
              type="button"
              className={`settings-section-link${active ? ' is-active' : ''}`}
              {...getSettingSectionNavigationProps(activeSection, section.key)}
              onClick={() => onSectionChange(section.key)}
            >
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
