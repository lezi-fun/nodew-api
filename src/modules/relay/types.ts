import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional(),
});

export const chatCompletionsBodySchema = z.object({
  model: z.string().min(1).max(128),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32768).optional(),
  stream: z.boolean().optional(),
});

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
