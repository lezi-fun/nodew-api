import { sendOpenAIChatCompletion } from './openai-adapter.js';
import type { ChatCompletionsBody, GeminiGenerateContentBody, RelayChannel, RelayResult } from './types.js';

const extractText = (parts: Array<Record<string, unknown>>) => parts.map((part) => {
  if (typeof part.text === 'string') {
    return part.text;
  }

  return JSON.stringify(part);
}).join('\n');

const geminiRoleToOpenAI = (role: string | undefined) => role === 'model' ? 'assistant' : 'user';

const openAIFinishReasonToGemini = (reason: unknown) => {
  if (reason === 'stop') {
    return 'STOP';
  }

  if (reason === 'length') {
    return 'MAX_TOKENS';
  }

  if (reason === 'content_filter') {
    return 'SAFETY';
  }

  return 'STOP';
};

const buildOpenAIBody = (model: string, body: GeminiGenerateContentBody): ChatCompletionsBody => {
  const messages = [] as ChatCompletionsBody['messages'];

  if (body.systemInstruction?.parts?.length) {
    messages.push({
      role: 'system',
      content: extractText(body.systemInstruction.parts),
    });
  }

  for (const content of body.contents) {
    messages.push({
      role: geminiRoleToOpenAI(content.role),
      content: extractText(content.parts),
    });
  }

  const generationConfig = body.generationConfig ?? {};

  return {
    model,
    messages,
    ...(typeof generationConfig.temperature === 'number' ? { temperature: generationConfig.temperature } : {}),
    ...(typeof generationConfig.topP === 'number' ? { top_p: generationConfig.topP } : {}),
    ...(typeof generationConfig.maxOutputTokens === 'number' ? { max_tokens: generationConfig.maxOutputTokens } : {}),
    ...(Array.isArray(generationConfig.stopSequences) ? { stop: generationConfig.stopSequences as string[] } : {}),
  };
};

const openAIToGeminiBody = (body: unknown) => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const response = body as {
    choices?: Array<{
      index?: number;
      finish_reason?: unknown;
      message?: { content?: unknown };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  if (!Array.isArray(response.choices)) {
    return body;
  }

  const promptTokenCount = response.usage?.prompt_tokens ?? 0;
  const candidatesTokenCount = response.usage?.completion_tokens ?? 0;

  return {
    candidates: response.choices.map((choice, index) => ({
      content: {
        parts: [{ text: typeof choice.message?.content === 'string' ? choice.message.content : '' }],
        role: 'model',
      },
      finishReason: openAIFinishReasonToGemini(choice.finish_reason),
      index: choice.index ?? index,
    })),
    usageMetadata: {
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount: response.usage?.total_tokens ?? promptTokenCount + candidatesTokenCount,
    },
  };
};

export const sendGeminiViaOpenAIChatCompletion = async (
  channel: RelayChannel,
  model: string,
  body: GeminiGenerateContentBody,
): Promise<RelayResult> => {
  const result = await sendOpenAIChatCompletion(channel, buildOpenAIBody(model, body));

  if (result.statusCode < 200 || result.statusCode >= 300 || typeof result.body === 'string') {
    return result;
  }

  return {
    ...result,
    body: openAIToGeminiBody(result.body),
  };
};
