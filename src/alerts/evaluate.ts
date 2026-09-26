import { LINKS } from './links.js';
import type { Snapshot } from '../torn/client.js';

export const SYNC_IDLE_MS = 5 * 60 * 1000;
export const SYNC_FAR_MS = 10 * 60 * 1000;
export const SYNC_MID_MS = 60 * 1000;
export const SYNC_NEAR_MS = 30 * 1000;

const FAR_THRESHOLD_SEC = 15 * 60;
const NEAR_THRESHOLD_SEC = 2 * 60;
const LEAD_SEC = 2 * 60;

export interface AlertState {
  seenSnapshot: boolean;
  notified: Record<string, boolean>;
}

export interface ScheduledAlert {
  key: string;
  dueAtMs: number;
  text: string;
  buttonLabel: string;
  url: string;
}

export interface Evaluation {
  alerts: ScheduledAlert[];
  nextSyncDelayMs: number;
  state: AlertState;
}

export function initialAlertState(): AlertState {
  return { seenSnapshot: false, notified: {} };
}

export function nextSyncDelayMs(soonestSec: number | null): number {
  if (soonestSec === null) return SYNC_IDLE_MS;
  if (soonestSec < NEAR_THRESHOLD_SEC) return SYNC_NEAR_MS;
  if (soonestSec < FAR_THRESHOLD_SEC) return SYNC_MID_MS;
  const untilLeadMs = (soonestSec - LEAD_SEC) * 1000;

  return Math.min(SYNC_FAR_MS, Math.max(SYNC_NEAR_MS, untilLeadMs));
}

export function evaluate(snapshot: Snapshot, nowMs: number, previous: AlertState): Evaluation {
  const alerts: ScheduledAlert[] = [];
  const soonest: number[] = [];
  const nextNotified: Record<string, boolean> = { ...previous.notified };

  considerReady(
    {
      key: 'energy',
      remainingSec: barRemaining(snapshot.energy),
      text: 'Energy is full',
      buttonLabel: 'Open gym',
      url: LINKS.gym,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'nerve',
      remainingSec: barRemaining(snapshot.nerve),
      text: 'Nerve is full',
      buttonLabel: 'Open crimes',
      url: LINKS.crimes,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'booster',
      remainingSec: Math.max(0, snapshot.cooldowns.booster),
      text: 'Booster cooldown is over',
      buttonLabel: 'Open armory',
      url: LINKS.armory,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'drug',
      remainingSec: Math.max(0, snapshot.cooldowns.drug),
      text: 'Drug cooldown is over',
      buttonLabel: 'Open items',
      url: LINKS.items,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'medical',
      remainingSec: Math.max(0, snapshot.cooldowns.medical),
      text: 'Health cooldown is over',
      buttonLabel: 'Open armory',
      url: LINKS.armory,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'education',
      remainingSec: Math.max(0, snapshot.educationTimeLeft),
      text: 'Education is finished',
      buttonLabel: 'Open education',
      url: LINKS.education,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );
  considerReady(
    {
      key: 'bank',
      remainingSec: Math.max(0, snapshot.bankTimeLeft),
      text: 'Bank investment is over',
      buttonLabel: 'Open bank',
      url: LINKS.bank,
    },
    nowMs,
    previous,
    nextNotified,
    alerts,
    soonest,
  );

  const flightId = considerTravel(snapshot, nowMs, previous, nextNotified, alerts, soonest);
  dropOldTravelKeys(nextNotified, flightId);

  return {
    alerts,
    nextSyncDelayMs: nextSyncDelayMs(soonest.length === 0 ? null : Math.min(...soonest)),
    state: {
      seenSnapshot: true,
      notified: nextNotified,
    },
  };
}

function barRemaining(bar: Snapshot['energy']): number {
  if (bar.current >= bar.maximum) return 0;
  return Math.max(0, bar.fulltime);
}

interface ReadySpec {
  key: string;
  remainingSec: number;
  text: string;
  buttonLabel: string;
  url: string;
}

function considerReady(
  spec: ReadySpec,
  nowMs: number,
  previous: AlertState,
  nextNotified: Record<string, boolean>,
  alerts: ScheduledAlert[],
  soonest: number[],
): void {
  if (spec.remainingSec > 0) {
    nextNotified[spec.key] = false;
    alerts.push({
      key: spec.key,
      dueAtMs: nowMs + spec.remainingSec * 1000,
      text: spec.text,
      buttonLabel: spec.buttonLabel,
      url: spec.url,
    });
    soonest.push(spec.remainingSec);
    return;
  }

  if (!previous.seenSnapshot || previous.notified[spec.key]) {
    nextNotified[spec.key] = true;
    return;
  }

  alerts.push({
    key: spec.key,
    dueAtMs: nowMs,
    text: spec.text,
    buttonLabel: spec.buttonLabel,
    url: spec.url,
  });
  soonest.push(0);
}

function considerTravel(
  snapshot: Snapshot,
  nowMs: number,
  previous: AlertState,
  nextNotified: Record<string, boolean>,
  alerts: ScheduledAlert[],
  soonest: number[],
): string | null {
  if (snapshot.travel.timeLeft <= 0) return null;

  const flightId = String(snapshot.travel.departed || snapshot.travel.timestamp || 'current');
  const destination = snapshot.travel.destination || 'your destination';
  const marks = [
    { secondsBefore: 30, label: '30 seconds' },
    { secondsBefore: 5, label: '5 seconds' },
  ];
  let nextMarkIn: number | null = null;

  for (const mark of marks) {
    const key = `travel:${flightId}:${mark.secondsBefore}`;
    const firesIn = snapshot.travel.timeLeft - mark.secondsBefore;
    if (firesIn < 0 || previous.notified[key]) {
      nextNotified[key] = true;
      continue;
    }

    nextNotified[key] = false;
    alerts.push({
      key,
      dueAtMs: nowMs + firesIn * 1000,
      text: `Landing in ${destination} in ${mark.label}`,
      buttonLabel: 'Open travel',
      url: LINKS.travel,
    });
    if (nextMarkIn === null || firesIn < nextMarkIn) nextMarkIn = firesIn;
  }

  soonest.push(nextMarkIn ?? snapshot.travel.timeLeft);
  return flightId;
}

function dropOldTravelKeys(notified: Record<string, boolean>, flightId: string | null): void {
  const prefix = flightId === null ? null : `travel:${flightId}:`;
  for (const key of Object.keys(notified)) {
    if (!key.startsWith('travel:')) continue;
    if (prefix === null || !key.startsWith(prefix)) delete notified[key];
  }
}
