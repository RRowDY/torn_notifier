import type { Alert } from './alert.js';
export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}
export function createFanout(channels: AlertChannel[]) {
  return {
    async send(alert: Alert): Promise<void> {
      if (channels.length === 0) {
        throw new Error('No alert channels configured');
      }
      const results = await Promise.allSettled(channels.map((channel) => channel.send(alert)));
      const failures: string[] = [];
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') continue;
        const channel = channels[index];
        if (!channel) continue;
        const message =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(
          `${new Date().toISOString()} error ${alert.key} via ${channel.name}: ${message}`,
        );
        failures.push(`${channel.name}: ${message}`);
      }
      if (failures.length === channels.length) {
        throw new Error(failures.join('; '));
      }
    },
  };
}
