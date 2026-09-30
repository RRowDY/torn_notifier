import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFanout, type AlertChannel } from '../notify/fanout.js';
import type { Alert } from '../notify/alert.js';
const alert: Alert = {
  key: 'energy',
  text: 'Energy is full',
  buttonLabel: 'Open gym',
  url: 'https://www.torn.com/gym.php',
};
function channel(name: string, send: AlertChannel['send']): AlertChannel {
  return { name, send };
}
describe('createFanout', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      //
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('resolves when one channel fails', async () => {
    const fanout = createFanout([
      channel('discord', async () => {
        //
      }),
      channel('ntfy', async () => {
        throw new Error('down');
      }),
    ]);
    await fanout.send(alert);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('energy via ntfy: down'));
  });
  it('throws when every channel fails', async () => {
    const fanout = createFanout([
      channel('discord', async () => {
        throw new Error('discord down');
      }),
      channel('ntfy', async () => {
        throw new Error('ntfy down');
      }),
    ]);
    await expect(fanout.send(alert)).rejects.toThrow('discord: discord down; ntfy: ntfy down');
  });
  it('throws when the only channel fails', async () => {
    const fanout = createFanout([
      channel('discord', async () => {
        throw new Error('discord down');
      }),
    ]);
    await expect(fanout.send(alert)).rejects.toThrow('discord: discord down');
  });
});
