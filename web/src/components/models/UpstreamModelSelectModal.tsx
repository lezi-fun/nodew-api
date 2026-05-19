import { Checkbox, Collapse, Empty, Input, Modal, Tag, Typography } from '@douyinfe/semi-ui';
import { IllustrationNoResult } from '@douyinfe/semi-illustrations';
import { IconSearch } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';

import type { UpstreamModelItem } from '../../lib/api';

type GroupedModels = Array<{
  label: string;
  models: UpstreamModelItem[];
}>;

type UpstreamModelSelectModalProps = {
  visible: boolean;
  models: UpstreamModelItem[];
  selected: string[];
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
};

const normalizeModelName = (model: string) => model.trim();

const dedupeModels = (models: UpstreamModelItem[]) => {
  const seen = new Map<string, UpstreamModelItem>();

  for (const model of models) {
    const id = normalizeModelName(model.id);
    if (!id || seen.has(id)) {
      continue;
    }

    seen.set(id, {
      id,
      ownedBy: model.ownedBy?.trim() || null,
    });
  }

  return [...seen.values()];
};

const groupModels = (models: UpstreamModelItem[]): GroupedModels => {
  const groups = new Map<string, UpstreamModelItem[]>();

  for (const model of models) {
    const label = model.ownedBy?.trim() || '其他';
    const current = groups.get(label) ?? [];
    current.push(model);
    groups.set(label, current);
  }

  return [...groups.entries()]
    .map(([label, groupModels]) => ({
      label,
      models: groupModels.sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => {
      if (left.label === '其他') {
        return 1;
      }

      if (right.label === '其他') {
        return -1;
      }

      return left.label.localeCompare(right.label);
    });
};

export default function UpstreamModelSelectModal({
  visible,
  models,
  selected,
  onConfirm,
  onCancel,
}: UpstreamModelSelectModalProps) {
  const [keyword, setKeyword] = useState('');
  const [checkedList, setCheckedList] = useState<string[]>([]);

  const normalizedModels = useMemo(() => dedupeModels(models), [models]);
  const normalizedSelected = useMemo(
    () => Array.from(new Set(selected.map(normalizeModelName).filter(Boolean))),
    [selected],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setKeyword('');
    setCheckedList(normalizedSelected);
  }, [normalizedSelected, visible]);

  const filteredModels = useMemo(() => {
    const needle = keyword.trim().toLowerCase();

    if (!needle) {
      return normalizedModels;
    }

    return normalizedModels.filter((model) => {
      const ownedBy = model.ownedBy ?? '';
      return (
        model.id.toLowerCase().includes(needle) ||
        ownedBy.toLowerCase().includes(needle)
      );
    });
  }, [keyword, normalizedModels]);

  const groupedModels = useMemo(() => groupModels(filteredModels), [filteredModels]);
  const selectedSet = useMemo(() => new Set(checkedList), [checkedList]);

  const toggleModel = (modelId: string, checked: boolean) => {
    const normalized = normalizeModelName(modelId);

    setCheckedList((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(normalized);
      } else {
        next.delete(normalized);
      }

      return [...next];
    });
  };

  const toggleGroup = (groupModels: UpstreamModelItem[], checked: boolean) => {
    const ids = groupModels.map((model) => normalizeModelName(model.id)).filter(Boolean);

    setCheckedList((current) => {
      const next = new Set(current);

      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return [...next];
    });
  };

  const isGroupAllSelected = (groupModels: UpstreamModelItem[]) =>
    groupModels.length > 0 && groupModels.every((model) => selectedSet.has(normalizeModelName(model.id)));

  const isGroupIndeterminate = (groupModels: UpstreamModelItem[]) => {
    const selectedCount = groupModels.filter((model) => selectedSet.has(normalizeModelName(model.id))).length;
    return selectedCount > 0 && selectedCount < groupModels.length;
  };

  const selectedCount = checkedList.length;

  return (
    <Modal
      title={(
        <div className="flex items-center gap-2">
          <Typography.Title heading={5} className="m-0">
            选择上游模型
          </Typography.Title>
          <Tag color="blue">{selectedCount}</Tag>
        </div>
      )}
      visible={visible}
      onOk={() => onConfirm(checkedList)}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      width={760}
      centered
      closeOnEsc
      maskClosable
    >
      <Input
        prefix={<IconSearch />}
        placeholder="搜索模型或供应商"
        value={keyword}
        onChange={setKeyword}
        showClear
      />

      <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 8, marginTop: 12 }}>
        {filteredModels.length === 0 ? (
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            description="暂无匹配模型"
            style={{ padding: 30 }}
          />
        ) : (
          <Collapse defaultActiveKey={groupedModels.map((_, index) => String(index))}>
            {groupedModels.map((group, index) => (
              <Collapse.Panel
                key={`${group.label}-${index}`}
                itemKey={String(index)}
                header={(
                  <span className="flex items-center gap-2">
                    <span>{group.label}</span>
                    <Tag size="small">{group.models.length}</Tag>
                  </span>
                )}
                extra={(
                  <Checkbox
                    checked={isGroupAllSelected(group.models)}
                    indeterminate={isGroupIndeterminate(group.models)}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleGroup(group.models, Boolean(event.target.checked));
                    }}
                  />
                )}
              >
                <div className="grid grid-cols-2 gap-x-4">
                  {group.models.map((model) => (
                    <Checkbox
                      key={model.id}
                      value={model.id}
                      checked={selectedSet.has(model.id)}
                      className="my-1"
                      onChange={(event) => toggleModel(model.id, Boolean(event.target.checked))}
                    >
                      <span className="flex items-center gap-2 break-all">
                        <span>{model.id}</span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </div>

      <Typography.Text
        type="secondary"
        size="small"
        className="block text-right mt-4"
      >
        已选择 {selectedCount} / {normalizedModels.length}
      </Typography.Text>
    </Modal>
  );
}
