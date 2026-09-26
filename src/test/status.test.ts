import { describe, expect, it } from 'vitest';
import { formatStatus } from '../status.js';
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
describe('formatStatus', () => {
  it('shows ready bars and cooldowns, and hides idle timers', () => {
    const text = formatStatus(snapshot(), 1_700_000_000_000);
    expect(text).toBe(
      [
        'Energy: 100/100 · full',
        'Nerve: 50/50 · full',
        'Booster: ready',
        'Drug: ready',
        'Health: ready',
      ].join('\n'),
    );
  });
  it('includes active timers with a Discord countdown', () => {
    const now = 1_700_000_000_000;
    const text = formatStatus(
      snapshot({
        energy: { current: 90, maximum: 100, fulltime: 120 },
        cooldowns: { booster: 0, drug: 3600, medical: 0 },
        educationTimeLeft: 90,
        bankAmount: 1_000_000,
        bankTimeLeft: 0,
        travel: { departed: 1, destination: 'Mexico', timeLeft: 45, timestamp: 1 },
      }),
      now,
    );
    expect(text).toContain('Energy: 90/100 · full <t:1700000120:R>');
    expect(text).toContain('Drug: <t:1700003600:R>');
    expect(text).toContain('Education: <t:1700000090:R>');
    expect(text).toContain('Bank: ready');
    expect(text).toContain('Travel to Mexico: <t:1700000045:R>');
  });
});
