import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export const chatCompletionsBodySchema = z.object({
  model: z.string().min(1).max(128),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().max(16).optional(),
  max_tokens: z.number().int().positive().max(32768).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string().min(1)).max(4)]).optional(),
  user: z.string().min(1).max(256).optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  response_format: z.record(z.string(), z.unknown()).optional(),
  seed: z.number().int().optional(),
  stream: z.boolean().optional(),
  stream_options: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type ChatCompletionsBody = z.infer<typeof chatCompletionsBodySchema>;

export type RelayChannel = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  encryptedKey: string;
  priority: number;
  weight: number;
};

export type RelayResult = {
  statusCode: number;
  body: unknown;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type RelayAttempt = {
  channelId: string;
  channelName: string;
  provider: string;
  statusCode: number;
  errorMessage: string | null;
};

export type RelayExecutionResult = {
  result: RelayResult;
  channel: RelayChannel;
  attempts: RelayAttempt[];
};
