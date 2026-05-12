import { Button, Card, Input, Select, Space, Switch, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconPlay } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';

import { api, type ChannelItem } from '../lib/api';

const readModels = (channels: ChannelItem[]) => {
  const models = new Set<string>();

  for (const channel of channels) {
    const metadataModels = channel.metadata?.models;
    if (Array.isArray(metadataModels)) {
      for (const model of metadataModels) {
        if (typeof model === 'string' && model.trim()) {
          models.add(model);
        }
      }
    }

    if (channel.model) {
      models.add(channel.model);
    }
  }

  return [...models].sort();
};

export default function PlaygroundPage() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [message, setMessage] = useState('Say hello from NodEW-api.');
  const [stream, setStream] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');

  useEffect(() => {
    api.listChannels()
      .then((response) => setChannels(response.items ?? []))
      .catch(() => undefined);
  }, []);

  const models = useMemo(() => readModels(channels), [channels]);

  const run = async () => {
    if (!apiKey.trim()) {
      Toast.error('请填写用于 Relay 的 API Key');
      return;
    }

    setRunning(true);
    setOutput('');
    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey.trim()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (!response.ok) {
        setOutput(await response.text());
        Toast.error(`请求失败 HTTP ${response.status}`);
        return;
      }

      if (!stream || !response.body) {
        const json = await response.json();
        setOutput(JSON.stringify(json, null, 2));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        text += decoder.decode(chunk.value, { stream: true });
        setOutput(text);
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '请求失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="console-page playground-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Playground</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>操练场</Typography.Title>
          <Typography.Paragraph className="console-description">
            直接从浏览器调用 `/v1/chat/completions`，用于验证令牌、模型路由和 SSE 流式透传。
          </Typography.Paragraph>
        </div>
        <Button theme="solid" type="primary" icon={<IconPlay />} loading={running} onClick={() => void run()}>
          发送请求
        </Button>
      </section>

      <section className="playground-grid">
        <Card title="请求配置" bordered={false} className="dashboard-card">
          <div className="form-grid">
            <label>
              <span>API Key</span>
              <Input mode="password" value={apiKey} placeholder="nwk_..." onChange={setApiKey} />
            </label>
            <label>
              <span>模型</span>
              <Select value={model} filter onChange={(value) => setModel(String(value))}>
                {[model, ...models.filter((item) => item !== model)].map((item) => (
                  <Select.Option key={item} value={item}>{item}</Select.Option>
                ))}
              </Select>
            </label>
            <label>
              <span>用户消息</span>
              <TextArea autosize value={message} onChange={setMessage} />
            </label>
            <label className="switch-field">
              <span>流式响应</span>
              <Switch checked={stream} onChange={setStream} />
            </label>
          </div>
        </Card>
        <Card title="响应输出" bordered={false} className="dashboard-card playground-output-card">
          <pre>{output || '等待请求结果...'}</pre>
        </Card>
      </section>
    </main>
  );
}
