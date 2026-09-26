import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_USER_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'DISCORD_USER_ID must be a valid Discord user ID'),
  TORN_API_KEY: z.string().min(1, 'TORN_API_KEY is required'),
});

export interface AppConfig {
  discordToken: string;
  discordUserId: string;
  tornApiKey: string;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return {
    discordToken: parsed.data.DISCORD_TOKEN,
    discordUserId: parsed.data.DISCORD_USER_ID,
    tornApiKey: parsed.data.TORN_API_KEY,
  };
}
