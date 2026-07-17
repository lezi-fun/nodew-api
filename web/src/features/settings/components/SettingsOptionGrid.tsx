import { Input, InputNumber, Select, Switch, TextArea } from '@douyinfe/semi-ui';

import type { SystemOptionKey } from '../../../lib/api';
import type { SettingsOptionMeta } from '../option-metadata';

type SettingsOptionGridProps = {
  options: ReadonlyArray<SettingsOptionMeta>;
  values: Partial<Record<SystemOptionKey, string>>;
  onChange: (key: SystemOptionKey, value: string) => void;
  isNonBooleanDisabled?: (option: SettingsOptionMeta) => boolean;
};

export default function SettingsOptionGrid({
  options,
  values,
  onChange,
  isNonBooleanDisabled,
}: SettingsOptionGridProps) {
  return (
    <div className="settings-grid" style={{ width: '100%' }}>
      {options.map((option) => {
        const value = values[option.key] ?? '';
        const disabled = option.type !== 'boolean' && Boolean(isNonBooleanDisabled?.(option));

        return (
          <label className="setting-field" key={option.key}>
            <span>
              <strong>{option.title}</strong>
              <em>{option.description}</em>
            </span>
            {option.type === 'boolean' ? (
              <Switch checked={value === 'true'} onChange={(checked) => onChange(option.key, String(checked))} />
            ) : option.type === 'number' ? (
              <InputNumber
                min={option.min}
                value={value === '' ? undefined : Number(value)}
                disabled={disabled}
                onChange={(nextValue) => onChange(option.key, nextValue === null || nextValue === undefined ? '' : String(nextValue))}
              />
            ) : option.type === 'textarea' ? (
              <TextArea
                rows={option.rows ?? 5}
                value={value}
                placeholder={option.key}
                disabled={disabled}
                onChange={(nextValue) => onChange(option.key, nextValue)}
              />
            ) : option.type === 'select' ? (
              <Select value={value} disabled={disabled} onChange={(nextValue) => onChange(option.key, String(nextValue))}>
                {(option.options ?? []).map((item) => (
                  <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
                ))}
              </Select>
            ) : (
              <Input
                value={value}
                placeholder={option.key}
                disabled={disabled}
                onChange={(nextValue) => onChange(option.key, nextValue)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
