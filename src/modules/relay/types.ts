import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export const claudeContentBlockSchema = z.record(z.string(), z.unknown());

export const claudeMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(claudeContentBlockSchema).min(1)]),
}).passthrough();

export const claudeMessagesBodySchema = z.object({
  model: z.string().min(1).max(128),
  messages: z.array(claudeMessageSchema).min(1),
  system: z.union([z.string(), z.array(claudeContentBlockSchema).min(1)]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  stop_sequences: z.array(z.string().min(1)).max(16).optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  max_tokens: z.number().int().min(0).max(32768).optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.record(z.string(), z.unknown())).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
}).passthrough();

export type ClaudeMessagesBody = z.infer<typeof claudeMessagesBodySchema>;

export const embeddingsBodySchema = z.object({
  model: z.string().min(1).max(128),
  input: z.union([
    z.string().min(1),
    z.array(z.string().min(1)).min(1),
    z.array(z.number()).min(1),
    z.array(z.array(z.number()).min(1)).min(1),
  ]),
  user: z.string().min(1).max(256).optional(),
  dimensions: z.number().int().positive().optional(),
  encoding_format: z.enum(['float', 'base64']).optional(),
}).passthrough();

export type EmbeddingsBody = z.infer<typeof embeddingsBodySchema>;

export const responsesBodySchema = z.object({
  model: z.string().min(1).max(128),
  input: z.unknown(),
  instructions: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
}).passthrough();

export type ResponsesBody = z.infer<typeof responsesBodySchema>;

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

export type GeminiGenerateContentBody = {
  contents: Array<{
    role?: string;
    parts: Array<Record<string, unknown>>;
  }>;
  safetySettings?: Array<Record<string, unknown>>;
  generationConfig?: Record<string, unknown>;
  tools?: unknown;
  toolConfig?: Record<string, unknown>;
  systemInstruction?: {
    role?: string;
    parts: Array<Record<string, unknown>>;
  };
  cachedContent?: string;
  [key: string]: unknown;
};

export type RelayExecutionResult = {
  result: RelayResult;
  channel: RelayChannel;
  attempts: RelayAttempt[];
};
