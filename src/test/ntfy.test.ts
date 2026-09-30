import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNtfyChannel } from '../notify/ntfy.js';
import type { Alert } from '../notify/alert.js';
const alert: Alert = {
  key: 'energy',
  text: 'Energy is full',
  buttonLabel: 'Open gym',
  url: 'https://www.torn.com/gym.php',
};
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('createNtfyChannel', () => {
  it('posts the alert with ntfy headers', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const topic = 'a'.repeat(16);
    await createNtfyChannel({ server: 'https://ntfy.sh/', topic }).send(alert);
    expect(fetchMock).toHaveBeenCalledWith(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: 'Torn',
        Priority: 'high',
        Click: alert.url,
        Actions: `view, ${alert.buttonLabel}, ${alert.url}`,
      },
      body: alert.text,
    });
  });
  it('sends the bearer token only when one is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createNtfyChannel({
      server: 'https://ntfy.sh',
      topic: 'b'.repeat(16),
      token: 'tk_test',
    }).send(alert);
    expect(fetchMock).toHaveBeenCalledWith(`https://ntfy.sh/${'b'.repeat(16)}`, {
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer tk_test' }),
      body: alert.text,
    });
  });
  it('throws when ntfy returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const channel = createNtfyChannel({ server: 'https://ntfy.sh', topic: 'c'.repeat(16) });
    await expect(channel.send(alert)).rejects.toThrow('ntfy responded 500: nope');
  });
});
