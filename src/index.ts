import { evaluate, initialAlertState, type AlertState } from './alerts/evaluate.js';
import { loadConfig } from './config.js';
import { createNotifier } from './discord.js';
import { createFanout, type AlertChannel } from './notify/fanout.js';
import { createNtfyChannel } from './notify/ntfy.js';
import { createTimerStore } from './scheduler.js';
import { formatStatus } from './status.js';
import { fetchSnapshot } from './torn/client.js';

const MAX_BACKOFF_MS = 5 * 60 * 1000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const onAbort = () => {
      clearTimeout(handle);
      resolve();
    };
    const handle = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const discord = await createNotifier(config.discordToken, config.discordUserId, async () =>
    formatStatus(await fetchSnapshot(config.tornApiKey), Date.now()),
  );
  const channels: AlertChannel[] = [{ name: 'discord', send: (alert) => discord.send(alert) }];
  if (config.ntfy) channels.push(createNtfyChannel(config.ntfy));
  const fanout = createFanout(channels);

  const abort = new AbortController();
  let state: AlertState = initialAlertState();
  const timers = createTimerStore((key) => {
    state.notified[key] = true;
  });

  const shutdown = () => {
    abort.abort();
    timers.clear();
    void discord.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  let failureStreak = 0;
  console.log(
    `${new Date().toISOString()} info Torn notifier started (${channels.map((channel) => channel.name).join(', ')})`,
  );

  while (!abort.signal.aborted) {
    try {
      const snapshot = await fetchSnapshot(config.tornApiKey);
      const result = evaluate(snapshot, Date.now(), state);
      state = result.state;
      timers.arm(result.alerts, (alert) => fanout.send(alert));
      failureStreak = 0;
      console.log(
        `${new Date().toISOString()} info Next Torn sync in ${Math.round(result.nextSyncDelayMs / 1000)}s (${result.alerts.length} timer(s) armed)`,
      );
      await sleep(result.nextSyncDelayMs, abort.signal);
    } catch (error) {
      if (abort.signal.aborted) break;
      failureStreak += 1;
      const delay = Math.min(MAX_BACKOFF_MS, 5_000 * 2 ** (failureStreak - 1));
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `${new Date().toISOString()} error Torn sync failed: ${message}. Retrying in ${Math.round(delay / 1000)}s...`,
      );
      await sleep(delay, abort.signal);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${new Date().toISOString()} error ${message}`);
  process.exitCode = 1;
});
