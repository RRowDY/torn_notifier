import { describe, expect, it } from 'vitest';
import {
  evaluate,
  initialAlertState,
  nextSyncDelayMs,
  SYNC_FAR_MS,
  SYNC_IDLE_MS,
  SYNC_MID_MS,
  SYNC_NEAR_MS,
} from '../alerts/evaluate.js';
import type { Snapshot } from '../torn/client.js';
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    energy: { current: 100, maximum: 100, fulltime: 0 },
    nerve: { current: 50, maximum: 50, fulltime: 0 },
    cooldowns: { booster: 0, drug: 0, medical: 0 },
    travel: { departed: 0, destination: '', timeLeft: 0, timestamp: 0 },
    educationCurrent: 0,
    educationTimeLeft: 0,
    bankAmount: 0,
    bankTimeLeft: 0,
    ...overrides,
  };
}
describe('ready timers', () => {
  it('does not alert for a bar that is already full on the first read', () => {
    const result = evaluate(snapshot(), 1_000, initialAlertState());
    expect(result.alerts.map((alert) => alert.key)).not.toContain('energy');
    expect(result.state.notified.energy).toBe(true);
    expect(result.state.seenSnapshot).toBe(true);
  });
  it('arms energy for the remaining fulltime', () => {
    const now = 10_000;
    const result = evaluate(
      snapshot({ energy: { current: 90, maximum: 100, fulltime: 120 } }),
      now,
      initialAlertState(),
    );
    const energy = result.alerts.find((alert) => alert.key === 'energy');
    expect(energy?.dueAtMs).toBe(now + 120_000);
    expect(energy?.text).toBe('Energy is full');
    expect(energy?.buttonLabel).toBe('Open gym');
  });
  it('sends once when a tracked timer reaches zero', () => {
    const now = 5_000;
    const first = evaluate(
      snapshot({ cooldowns: { booster: 30, drug: 0, medical: 0 } }),
      now,
      initialAlertState(),
    );
    const done = evaluate(snapshot(), now + 30_000, first.state);
    expect(done.alerts.map((alert) => alert.key)).toContain('booster');
    expect(done.alerts.find((alert) => alert.key === 'booster')?.dueAtMs).toBe(now + 30_000);
    const sent = {
      ...done.state,
      notified: { ...done.state.notified, booster: true },
    };
    const again = evaluate(snapshot(), now + 31_000, sent);
    expect(again.alerts.map((alert) => alert.key)).not.toContain('booster');
  });
  it('arms a new alarm after the bar is used again', () => {
    const full = evaluate(snapshot(), 1_000, initialAlertState());
    const used = evaluate(
      snapshot({ nerve: { current: 10, maximum: 50, fulltime: 600 } }),
      2_000,
      full.state,
    );
    expect(used.alerts.find((alert) => alert.key === 'nerve')?.dueAtMs).toBe(2_000 + 600_000);
    expect(used.alerts.find((alert) => alert.key === 'nerve')?.url).toContain('crimes.php');
  });
});
describe('travel', () => {
  it('arms 30 second and 5 second landing alerts', () => {
    const now = 50_000;
    const result = evaluate(
      snapshot({
        travel: { departed: 42, destination: 'Mexico', timeLeft: 120, timestamp: 40 },
      }),
      now,
      initialAlertState(),
    );
    const early = result.alerts.find((alert) => alert.key === 'travel:42:30');
    const late = result.alerts.find((alert) => alert.key === 'travel:42:5');
    expect(early?.dueAtMs).toBe(now + 90_000);
    expect(late?.dueAtMs).toBe(now + 115_000);
    expect(early?.text).toBe('Landing in Mexico in 30 seconds');
    expect(late?.text).toBe('Landing in Mexico in 5 seconds');
  });
  it('skips the 30 second alert when the flight is already inside that window', () => {
    const now = 80_000;
    const result = evaluate(
      snapshot({
        travel: { departed: 7, destination: 'Cayman Islands', timeLeft: 20, timestamp: 1 },
      }),
      now,
      initialAlertState(),
    );
    expect(result.alerts.map((alert) => alert.key)).toEqual(['travel:7:5']);
    expect(result.alerts[0]?.dueAtMs).toBe(now + 15_000);
    expect(result.state.notified['travel:7:30']).toBe(true);
  });
  it('does not arm a landing alert that is already in the past', () => {
    const result = evaluate(
      snapshot({
        travel: { departed: 9, destination: 'South Africa', timeLeft: 3, timestamp: 1 },
      }),
      1_000,
      initialAlertState(),
    );
    expect(result.alerts.filter((alert) => alert.key.startsWith('travel:'))).toEqual([]);
  });
});
describe('next sync delay', () => {
  it('waits 5 minutes when nothing is in progress', () => {
    expect(nextSyncDelayMs(null)).toBe(SYNC_IDLE_MS);
    const result = evaluate(snapshot(), 1_000, initialAlertState());
    expect(result.nextSyncDelayMs).toBe(SYNC_IDLE_MS);
  });
  it('polls every 30 seconds inside 2 minutes', () => {
    expect(nextSyncDelayMs(30)).toBe(SYNC_NEAR_MS);
  });
  it('polls every 60 seconds between 2 and 15 minutes', () => {
    expect(nextSyncDelayMs(5 * 60)).toBe(SYNC_MID_MS);
  });
  it('polls every 10 minutes when the next event is far away', () => {
    expect(nextSyncDelayMs(60 * 60)).toBe(SYNC_FAR_MS);
    expect(nextSyncDelayMs(16 * 60)).toBe(SYNC_FAR_MS);
  });
});
