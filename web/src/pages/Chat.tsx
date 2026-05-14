import { Button, Card, Input, Select, Space, Switch, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDelete, IconPlus, IconRefresh, IconSend } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const storageKey = 'nodew-chat-sessions';
const defaultModel = 'gpt-4o-mini';

const now = () => new Date().toISOString();
const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createSession = (model = defaultModel): ChatSession => ({
  id: createId(),
  title: '新的聊天',
  model,
  messages: [],
  updatedAt: now(),
});

const readStoredSessions = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [createSession()];
    }

    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createSession()];
  } catch {
    return [createSession()];
  }
};

const extractOpenAIText = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const data = payload as {
    choices?: Array<{
      delta?: { content?: unknown };
      message?: { content?: unknown };
      text?: unknown;
    }>;
    output_text?: unknown;
  };

  const choice = data.choices?.[0];
  const content = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? data.output_text;

  return typeof content === 'string' ? content : '';
};

const parseNonStreamText = (payload: unknown) => {
  const text = extractOpenAIText(payload);
  return text || JSON.stringify(payload, null, 2);
};

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStoredSessions());
  const [selectedId, setSelectedId] = useState(() => sessions[0]?.id ?? '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('nodew-chat-api-key') ?? '');
  const [model, setModel] = useState(defaultModel);
  const [models, setModels] = useState<string[]>([defaultModel]);
  const [input, setInput] = useState('');
  const [stream, setStream] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? sessions[0],
    [selectedId, sessions],
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('nodew-chat-api-key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (selectedSession?.model) {
      setModel(selectedSession.model);
    }
  }, [selectedSession?.id, selectedSession?.model]);

  useEffect(() => {
    api.listModels()
      .then((response) => {
        const items = response.items ?? [];
        const modelIds = items.map((item) => item.id).filter(Boolean);
        setModels([...new Set([defaultModel, ...modelIds])].sort());
      })
      .catch(() => undefined);
  }, []);

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((current) => current.map((session) => session.id === sessionId ? updater(session) : session));
  };

  const appendMessage = (sessionId: string, message: ChatMessage) => {
    updateSession(sessionId, (session) => ({
      ...session,
      title: session.messages.length === 0 && message.role === 'user'
        ? message.content.slice(0, 28) || session.title
        : session.title,
      messages: [...session.messages, message],
      updatedAt: now(),
    }));
  };

  const updateAssistantMessage = (sessionId: string, messageId: string, content: string) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((message) => message.id === messageId ? { ...message, content } : message),
      updatedAt: now(),
    }));
  };

  const startNewChat = () => {
    const session = createSession(model);
    setSessions((current) => [session, ...current]);
    setSelectedId(session.id);
    setInput('');
  };

  const deleteSession = (sessionId: string) => {
    setSessions((current) => {
      const next = current.filter((session) => session.id !== sessionId);
      if (selectedId === sessionId) {
        setSelectedId(next[0]?.id ?? '');
      }

      return next.length > 0 ? next : [createSession(model)];
    });
  };

  const refreshModels = async () => {
    try {
      const response = await api.listModels();
      const modelIds = (response.items ?? []).map((item) => item.id).filter(Boolean);
      setModels([...new Set([model, defaultModel, ...modelIds])].sort());
      Toast.success('模型列表已刷新');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '模型列表刷新失败');
    }
  };

  const sendMessage = async () => {
    const session = selectedSession ?? createSession(model);
    const content = input.trim();

    if (!apiKey.trim()) {
      Toast.error('请填写 Relay API Key');
      return;
    }

    if (!content) {
      Toast.error('请输入消息');
      return;
    }

    if (!selectedSession) {
      setSessions([session]);
      setSelectedId(session.id);
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content,
      createdAt: now(),
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: now(),
    };

    setInput('');
    appendMessage(session.id, userMessage);
    appendMessage(session.id, assistantMessage);
    updateSession(session.id, (current) => ({ ...current, model }));
    setSending(true);

    try {
      const messages = [...session.messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey.trim()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream,
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        updateAssistantMessage(session.id, assistantMessage.id, errorText);
        Toast.error(`请求失败 HTTP ${response.status}`);
        return;
      }

      if (!stream || !response.body) {
        const json = await response.json();
        updateAssistantMessage(session.id, assistantMessage.id, parseNonStreamText(json));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) {
              continue;
            }

            const data = trimmed.slice('data:'.length).trim();
            if (!data || data === '[DONE]') {
              continue;
            }

            try {
              assistantText += extractOpenAIText(JSON.parse(data));
              updateAssistantMessage(session.id, assistantMessage.id, assistantText);
            } catch {
              assistantText += data;
              updateAssistantMessage(session.id, assistantMessage.id, assistantText);
            }
          }
        }
      }
    } catch (error) {
      updateAssistantMessage(session.id, assistantMessage.id, error instanceof Error ? error.message : '请求失败');
      Toast.error(error instanceof Error ? error.message : '请求失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="console-page chat-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Chat</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>聊天</Typography.Title>
          <Typography.Paragraph className="console-description">
            使用现有 Relay API 进行多轮调试，支持本地会话、模型选择和 SSE 流式响应。
          </Typography.Paragraph>
        </div>
        <Button theme="solid" type="primary" icon={<IconPlus />} onClick={startNewChat}>
          新建聊天
        </Button>
      </section>

      <section className="chat-shell">
        <Card bordered={false} className="dashboard-card chat-session-card">
          <Space vertical align="start" spacing="medium" style={{ width: '100%' }}>
            <Button block icon={<IconPlus />} onClick={startNewChat}>新建会话</Button>
            <div className="chat-session-list">
              {sessions.map((session) => (
                <button
                  className={session.id === selectedSession?.id ? 'chat-session-item active' : 'chat-session-item'}
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedId(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span>{session.model}</span>
                </button>
              ))}
            </div>
          </Space>
        </Card>

        <Card bordered={false} className="dashboard-card chat-main-card">
          <div className="chat-toolbar">
            <Input
              mode="password"
              value={apiKey}
              placeholder="Relay API Key，例如 nwk_..."
              onChange={setApiKey}
            />
            <Select value={model} filter onChange={(value) => setModel(String(value))}>
              {[model, ...models.filter((item) => item !== model)].map((item) => (
                <Select.Option key={item} value={item}>{item}</Select.Option>
              ))}
            </Select>
            <Button icon={<IconRefresh />} onClick={() => void refreshModels()}>刷新模型</Button>
            <label className="chat-stream-switch">
              <span>流式</span>
              <Switch checked={stream} onChange={setStream} />
            </label>
            {selectedSession ? (
              <Button
                type="danger"
                theme="borderless"
                icon={<IconDelete />}
                onClick={() => deleteSession(selectedSession.id)}
              />
            ) : null}
          </div>

          <div className="chat-message-list">
            {selectedSession?.messages.length ? selectedSession.messages.map((message) => (
              <div className={`chat-message ${message.role}`} key={message.id}>
                <div className="chat-message-role">{message.role === 'user' ? '你' : '助手'}</div>
                <div className="chat-message-content">{message.content || '...'}</div>
              </div>
            )) : (
              <div className="chat-empty">
                <strong>开始一次 Relay 对话</strong>
                <span>输入 API Key、选择模型，然后发送第一条消息。</span>
              </div>
            )}
          </div>

          <div className="chat-composer">
            <TextArea
              autosize={{ minRows: 2, maxRows: 6 }}
              value={input}
              placeholder="输入消息，Enter 换行后点击发送"
              onChange={setInput}
            />
            <Button
              theme="solid"
              type="primary"
              icon={<IconSend />}
              loading={sending}
              onClick={() => void sendMessage()}
            >
              发送
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}
