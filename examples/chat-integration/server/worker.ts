import { AIChatAgent } from '@cloudflare/ai-chat';
import { routeAgentRequest } from 'agents';
import type { UIMessage } from 'ai';
import { recordedResponse } from './recorded-response';

export class RecordedChat extends AIChatAgent {
  override async onChatMessage(
    _onFinish: Parameters<AIChatAgent['onChatMessage']>[0],
    options?: Parameters<AIChatAgent['onChatMessage']>[1],
  ) {
    return recordedResponse(this.messages, options?.abortSignal);
  }
}

export default {
  async fetch(request: Request, env: { RecordedChat: DurableObjectNamespace<RecordedChat> }) {
    const path = new URL(request.url).pathname;
    if (path === '/health') return new Response('ready');
    if (path === '/api/chat' && request.method === 'POST') {
      const { messages } = (await request.json()) as { messages: UIMessage[] };
      return recordedResponse(messages, request.signal);
    }
    return (await routeAgentRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
};
