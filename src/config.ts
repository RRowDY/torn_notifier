import 'dotenv/config';
import { z } from 'zod';
import type { NtfySettings } from './notify/alert.js';

function blankToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_USER_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'DISCORD_USER_ID must be a valid Discord user ID'),
  TORN_API_KEY: z.string().min(1, 'TORN_API_KEY is required'),
  NTFY_TOPIC: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{16,64}$/,
        'NTFY_TOPIC must be 16-64 characters and use only letters, numbers, underscores, or hyphens',
      )
      .optional(),
  ),
  NTFY_SERVER: z.preprocess(
    blankToUndefined,
    z.string().url('NTFY_SERVER must be a valid URL').optional(),
  ),
  NTFY_TOKEN: z.preprocess(blankToUndefined, z.string().min(1).optional()),
});

export interface AppConfig {
  discordToken: string;
  discordUserId: string;
  tornApiKey: string;
  ntfy?: NtfySettings;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  const topic = parsed.data.NTFY_TOPIC;
  return {
    discordToken: parsed.data.DISCORD_TOKEN,
    discordUserId: parsed.data.DISCORD_USER_ID,
    tornApiKey: parsed.data.TORN_API_KEY,
    ntfy: topic
      ? {
          topic,
          server: parsed.data.NTFY_SERVER ?? 'https://ntfy.sh',
          token: parsed.data.NTFY_TOKEN,
        }
      : undefined,
  };
}
