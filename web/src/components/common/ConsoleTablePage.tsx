import { Button, Card, Empty, Input, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { IllustrationNoResult } from '@douyinfe/semi-illustrations';
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type ConsoleColumn<T> = {
  title: string;
  dataIndex: string;
  render?: (value: unknown, record: T, index: number) => ReactNode;
};

type ConsoleTablePageProps<T extends Record<string, unknown>> = {
  title: string;
  description: string;
  note?: string;
  eyebrow?: string;
  rows: T[];
  loading: boolean;
  columns: Array<ConsoleColumn<T>>;
  searchKeys?: Array<keyof T>;
  stats?: Array<{ label: string; value: ReactNode; tone?: 'blue' | 'green' | 'orange' | 'red' | 'grey' }>;
  primaryActionText?: string;
  onPrimaryAction?: () => void;
  onRefresh?: () => void;
  toolbarExtra?: ReactNode;
  extraContent?: ReactNode;
};

const stringifyCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return '';
};

export default function ConsoleTablePage<T extends Record<string, unknown>>({
  title,
  description,
  note,
  eyebrow = 'Console',
  rows,
  loading,
  columns,
  searchKeys,
  stats = [],
  primaryActionText = '新建',
  onPrimaryAction,
  onRefresh,
  toolbarExtra,
  extraContent,
}: ConsoleTablePageProps<T>) {
  const [keyword, setKeyword] = useState('');
  const [compact, setCompact] = useState(localStorage.getItem('nodew-table-compact') === 'true');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    localStorage.setItem('nodew-table-compact', String(compact));
  }, [compact]);

  const filteredRows = useMemo(() => {
    if (!keyword.trim()) {
      return rows;
    }

    const needle = keyword.trim().toLowerCase();
    const keys = searchKeys ?? (rows[0] ? (Object.keys(rows[0]) as Array<keyof T>) : []);

    return rows.filter((row) =>
      keys.some((key) => stringifyCell(row[key]).toLowerCase().includes(needle)),
    );
  }, [keyword, rows, searchKeys]);

  return (
    <main className="console-page card-pro-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">{eyebrow}</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>{title}</Typography.Title>
          <Typography.Paragraph className="console-description">{description}</Typography.Paragraph>
        </div>
        <Space wrap>
          {onRefresh ? <Button icon={<IconRefresh />} onClick={onRefresh}>刷新</Button> : null}
          {onPrimaryAction ? <Button theme="solid" type="primary" icon={<IconPlus />} onClick={onPrimaryAction}>{primaryActionText}</Button> : null}
        </Space>
      </section>

      {stats.length > 0 ? (
        <section className="metric-grid">
          {stats.map((stat) => (
            <Card key={stat.label} className={`metric-card tone-${stat.tone ?? 'blue'}`} bordered={false}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </Card>
          ))}
        </section>
      ) : null}

      <Card bordered={false} className="console-table-card" bodyStyle={{ padding: 0 }}>
        <div className="table-toolbar">
          <div>
            <Typography.Text strong>数据列表</Typography.Text>
            {note ? <Typography.Text type="tertiary" className="table-note">{note}</Typography.Text> : null}
          </div>
          <Space wrap>
            {toolbarExtra}
            <Button type="tertiary" theme={compact ? 'solid' : 'outline'} onClick={() => setCompact((value) => !value)}>
              {compact ? '紧凑' : '舒适'}
            </Button>
            <Input
              showClear
              prefix={<IconSearch />}
              placeholder="搜索名称 / 模型 / 状态"
              value={keyword}
              onChange={setKeyword}
            />
            <Tag color="blue" size="large">{filteredRows.length}</Tag>
          </Space>
        </div>
        {isMobile ? (
          <div className={`mobile-card-table ${compact ? 'compact' : ''}`}>
            {filteredRows.map((record, rowIndex) => (
              <Card
                key={String((record?.id as string | undefined) ?? (record?.requestId as string | undefined) ?? rowIndex)}
                bordered={false}
                className="mobile-row-card"
              >
                {columns.map((column, columnIndex) => {
                  const value = record[column.dataIndex as keyof T];
                  const rendered = column.render ? column.render(value, record, rowIndex) : stringifyCell(value);

                  return (
                    <div className="mobile-row-field" key={`${column.dataIndex}-${columnIndex}`}>
                      <span>{column.title}</span>
                      <div>{rendered || '-'}</div>
                    </div>
                  );
                })}
              </Card>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <Empty description="暂无数据" image={<IllustrationNoResult style={{ width: 120, height: 120 }} />} />
            ) : null}
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            size={compact ? 'small' : 'default'}
            pagination={{ pageSize: compact ? 16 : 12, showSizeChanger: true }}
            empty={
              <Empty description="暂无数据" image={<IllustrationNoResult style={{ width: 120, height: 120 }} />} />
            }
            rowKey={(record) => String((record?.id as string | undefined) ?? (record?.requestId as string | undefined) ?? 'row')}
          />
        )}
      </Card>

      {extraContent}
    </main>
  );
}
