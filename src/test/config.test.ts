import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
const KEYS = [
  'DISCORD_TOKEN',
  'DISCORD_USER_ID',
  'TORN_API_KEY',
  'NTFY_TOPIC',
  'NTFY_SERVER',
  'NTFY_TOKEN',
] as const;
const baseEnv = {
  DISCORD_TOKEN: 'token',
  DISCORD_USER_ID: '12345678901234567',
  TORN_API_KEY: 'torn-key',
};
function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const previous = new Map(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of KEYS) {
      const old = previous.get(key);
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
}
describe('loadConfig', () => {
  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
  });
  it('still requires Discord and the Torn key', () => {
    withEnv(
      { DISCORD_USER_ID: baseEnv.DISCORD_USER_ID, TORN_API_KEY: baseEnv.TORN_API_KEY },
      () => {
        expect(() => loadConfig()).toThrow(/DISCORD_TOKEN/);
      },
    );
  });
  it('leaves ntfy unset when the topic is blank', () => {
    withEnv({ ...baseEnv, NTFY_TOPIC: '', NTFY_SERVER: '', NTFY_TOKEN: '' }, () => {
      expect(loadConfig().ntfy).toBeUndefined();
    });
  });
  it('defaults the ntfy server when only a topic is set', () => {
    const topic = 'a'.repeat(16);
    withEnv({ ...baseEnv, NTFY_TOPIC: topic }, () => {
      expect(loadConfig().ntfy).toEqual({
        topic,
        server: 'https://ntfy.sh',
        token: undefined,
      });
    });
  });
  it('keeps a custom server and token', () => {
    const topic = 'b'.repeat(32);
    withEnv(
      {
        ...baseEnv,
        NTFY_TOPIC: topic,
        NTFY_SERVER: 'https://ntfy.example.com',
        NTFY_TOKEN: 'tk_test',
      },
      () => {
        expect(loadConfig().ntfy).toEqual({
          topic,
          server: 'https://ntfy.example.com',
          token: 'tk_test',
        });
      },
    );
  });
  it('rejects a topic that is too easy to guess', () => {
    withEnv({ ...baseEnv, NTFY_TOPIC: 'short-topic' }, () => {
      expect(() => loadConfig()).toThrow(/NTFY_TOPIC/);
    });
  });
  it('rejects a server that is not a URL', () => {
    withEnv({ ...baseEnv, NTFY_TOPIC: 'c'.repeat(16), NTFY_SERVER: 'not a url' }, () => {
      expect(() => loadConfig()).toThrow(/NTFY_SERVER/);
    });
  });
});
