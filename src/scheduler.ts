import type { ScheduledAlert } from './alerts/evaluate.js';

const DUE_TOLERANCE_MS = 2_000;
const MAX_TIMEOUT_MS = 2_000_000_000;

interface ArmedTimer {
  dueAtMs: number;
  handle: ReturnType<typeof setTimeout>;
}

export function createTimerStore(onNotified: (key: string) => void) {
  const timers = new Map<string, ArmedTimer>();
  const inflight = new Set<string>();

  return {
    arm(alerts: ScheduledAlert[], onFire: (alert: ScheduledAlert) => Promise<void>): void {
      const desired = alerts.filter((alert) => !inflight.has(alert.key));
      const keys = new Set(desired.map((alert) => alert.key));

      for (const [key, timer] of timers) {
        if (!keys.has(key)) {
          clearTimeout(timer.handle);
          timers.delete(key);
        }
      }

      for (const alert of desired) {
        const delay = alert.dueAtMs - Date.now();
        if (delay > MAX_TIMEOUT_MS) {
          const existing = timers.get(alert.key);
          if (existing) {
            clearTimeout(existing.handle);
            timers.delete(alert.key);
          }
          continue;
        }

        const existing = timers.get(alert.key);
        if (existing && Math.abs(existing.dueAtMs - alert.dueAtMs) <= DUE_TOLERANCE_MS) {
          continue;
        }
        if (existing) clearTimeout(existing.handle);

        const handle = setTimeout(
          () => {
            timers.delete(alert.key);
            inflight.add(alert.key);
            void onFire(alert)
              .then(() => onNotified(alert.key))
              .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                console.error(
                  `${new Date().toISOString()} error Failed to send ${alert.key}: ${message}`,
                );
              })
              .finally(() => {
                inflight.delete(alert.key);
              });
          },
          Math.max(0, delay),
        );

        timers.set(alert.key, { dueAtMs: alert.dueAtMs, handle });
      }
    },
    clear(): void {
      for (const timer of timers.values()) clearTimeout(timer.handle);
      timers.clear();
    },
  };
}
