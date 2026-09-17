import { useEffect, useState } from 'react';
import { useChat, type UseChatHelpers } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import { TypographyResponse } from './typography-response';

const transport = new DefaultChatTransport({ api: '/api/chat' });
const params = new URLSearchParams(window.location.search);
const room = params.get('room') ?? 'demo';
const backend = params.get('backend') === 'cloudflare' ? 'cloudflare' : 'ai-sdk';
const storageKey = `typograph-recording:${room}`;

function AiSdkChat() {
  const [initialMessages] = useState<UIMessage[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });
  const chat = useChat({ id: room, transport, messages: initialMessages });
  useEffect(() => {
    if (chat.status === 'ready' || chat.status === 'error') {
      sessionStorage.setItem(storageKey, JSON.stringify(chat.messages));
    }
  }, [chat.messages, chat.status]);
  return <ChatView chat={chat} connected />;
}

function CloudflareChat() {
  const [connected, setConnected] = useState(false);
  const agent = useAgent({
    agent: 'RecordedChat',
    name: room,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
  });
  const chat = useAgentChat({ agent });
  return <ChatView chat={chat} connected={connected} streaming={chat.isStreaming} />;
}

function ChatView({
  chat,
  connected,
  streaming = chat.status === 'streaming',
}: {
  chat: Pick<
    UseChatHelpers<UIMessage>,
    'messages' | 'sendMessage' | 'regenerate' | 'stop' | 'status' | 'error'
  >;
  connected: boolean;
  streaming?: boolean;
}) {
  const [locale, setLocale] = useState('en-US');
  const [spacing, setSpacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = streaming || chat.status === 'submitted';
  const assistantMessages = chat.messages.filter((message) => message.role === 'assistant');
  return (
    <>
      <div className="controls">
        {['rich', 'boundary', 'slow', 'error'].map((name) => (
          <button
            key={name}
            disabled={busy || !connected}
            onClick={() => {
              void chat.sendMessage({ text: name });
            }}
          >
            Run {name}
          </button>
        ))}
        <button
          disabled={!busy}
          onClick={() => {
            void chat.stop();
          }}
        >
          Stop
        </button>
        <button
          disabled={busy || !connected || !assistantMessages.length}
          onClick={() => {
            void chat.regenerate();
          }}
        >
          Regenerate
        </button>
      </div>
      <div className="controls">
        <label>
          Response language{' '}
          <select
            aria-label="Response language"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="en-US">English</option>
            <option value="fr">French (pass through)</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={spacing}
            onChange={(event) => setSpacing(event.target.checked)}
          />{' '}
          No-break spacing
        </label>
      </div>
      <output data-testid="connection">{connected ? 'connected' : 'disconnected'}</output>
      {' · '}
      <output data-testid="status">{busy ? 'streaming' : chat.status}</output>
      {chat.error && <p role="alert">{chat.error.message}</p>}
      {assistantMessages.map((message, index) => {
        const text = message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n');
        return (
          <article key={message.id} data-testid="message" data-message-id={message.id}>
            <div className="label">ASSISTANT · {index + 1}</div>
            {message.parts.map((part, partIndex) =>
              part.type === 'text' ? (
                <div className="response" data-testid="response" key={partIndex}>
                  <TypographyResponse
                    text={part.text}
                    locale={locale}
                    spacing={spacing}
                    streaming={busy && index === assistantMessages.length - 1}
                  />
                </div>
              ) : (
                <pre data-testid="tool-result" key={partIndex}>
                  {JSON.stringify(part, null, 2)}
                </pre>
              ),
            )}
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              }}
            >
              Copy original
            </button>
            {copied && <span role="status"> Copied</span>}
            <details>
              <summary>Original Markdown</summary>
              <pre data-testid="original">{text}</pre>
            </details>
          </article>
        );
      })}
    </>
  );
}

export function App() {
  return (
    <main>
      <header>
        <h1>Typograph integration checks</h1>
        <p>Recorded responses through real chat SDKs. No model calls or API keys.</p>
      </header>
      <nav aria-label="Chat backend">
        <a
          href={`?backend=ai-sdk&room=${encodeURIComponent(room)}`}
          aria-current={backend === 'ai-sdk' ? 'page' : undefined}
        >
          AI SDK + AI Elements
        </a>
        <a
          href={`?backend=cloudflare&room=${encodeURIComponent(room)}`}
          aria-current={backend === 'cloudflare' ? 'page' : undefined}
        >
          Cloudflare Agents + AI Elements
        </a>
      </nav>
      {backend === 'cloudflare' ? <CloudflareChat /> : <AiSdkChat />}
    </main>
  );
}
