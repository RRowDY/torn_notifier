const TORN_USER_URL =
  'https://api.torn.com/v2/user?selections=bars,cooldowns,travel,education,money&comment=torn-notifier';

export class TornApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'TornApiError';
  }
}

export interface BarSnapshot {
  current: number;
  maximum: number;
  fulltime: number;
}

export interface Snapshot {
  energy: BarSnapshot;
  nerve: BarSnapshot;
  cooldowns: {
    booster: number;
    drug: number;
    medical: number;
  };
  travel: {
    departed: number;
    destination: string;
    timeLeft: number;
    timestamp: number;
  };
  educationCurrent: number;
  educationTimeLeft: number;
  bankAmount: number;
  bankTimeLeft: number;
}

export async function fetchSnapshot(apiKey: string): Promise<Snapshot> {
  const response = await fetch(TORN_USER_URL, {
    headers: {
      Accept: 'application/json',
      Authorization: `ApiKey ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new TornApiError(`Torn API HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  const root = asRecord(body);
  if (!root) {
    throw new TornApiError('Torn API returned a non-object body');
  }

  const error = asRecord(root.error);
  if (error) {
    const code = typeof error.code === 'number' ? error.code : undefined;
    const message = typeof error.error === 'string' ? error.error : 'Torn API error';
    throw new TornApiError(message, code);
  }

  return parseSnapshot(root);
}

function parseSnapshot(root: Record<string, unknown>): Snapshot {
  const bars = asRecord(root.bars);
  const energySource = asRecord(root.energy) ?? (bars ? asRecord(bars.energy) : null);
  const nerveSource = asRecord(root.nerve) ?? (bars ? asRecord(bars.nerve) : null);

  if (!energySource || !nerveSource) {
    throw new TornApiError('Torn response is missing energy or nerve');
  }

  const cooldownSource = unwrapCooldowns(root);
  const educationSource = asRecord(root.education);
  const moneySource = asRecord(root.money);
  const bankSource =
    asRecord(root.city_bank) ?? (moneySource ? asRecord(moneySource.city_bank) : null);
  const travelSource = asRecord(root.travel);

  return {
    energy: {
      current: requireNumber(energySource.current, 'energy.current'),
      maximum: requireNumber(energySource.maximum, 'energy.maximum'),
      // fulltime: requireNumber(energySource.fulltime, 'energy.fulltime'),
      fulltime: barFullTime(energySource, 'energy'),
    },
    nerve: {
      current: requireNumber(nerveSource.current, 'nerve.current'),
      maximum: requireNumber(nerveSource.maximum, 'nerve.maximum'),
      // fulltime: requireNumber(nerveSource.fulltime, 'nerve.fulltime'),
      fulltime: barFullTime(nerveSource, 'energy'),
    },
    cooldowns: {
      booster: requireNumber(cooldownSource.booster, 'cooldowns.booster'),
      drug: requireNumber(cooldownSource.drug, 'cooldowns.drug'),
      medical: requireNumber(cooldownSource.medical, 'cooldowns.medical'),
    },
    travel: {
      departed: optionalNumber(travelSource?.departed),
      destination: typeof travelSource?.destination === 'string' ? travelSource.destination : '',
      timeLeft: optionalNumber(travelSource?.time_left),
      timestamp: optionalNumber(travelSource?.timestamp),
    },
    educationCurrent: optionalNumber(
      root.education_timeleft ?? educationSource?.education_timeleft ?? educationSource?.time_left,
    ),
    educationTimeLeft: optionalNumber(
      root.education_timeleft ?? educationSource?.education_timeleft ?? educationSource?.time_left,
    ),
    bankAmount: optionalNumber(bankSource?.amount),
    bankTimeLeft: bankRemainingSeconds(bankSource),
  };
}

function bankRemainingSeconds(bank: Record<string, unknown> | null): number {
  if (!bank) return 0;
  const until = coerceNumber(bank.until);
  if (until !== null && until > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    return Math.max(0, until - nowSec);
  }
  return Math.max(0, optionalNumber(bank.time_left));
}

function unwrapCooldowns(root: Record<string, unknown>): Record<string, unknown> {
  const block = asRecord(root.cooldowns);

  if (!block) {
    throw new TornApiError('Torn response is missing cooldowns');
  }
  return asRecord(block.cooldowns) ?? block;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function barFullTime(bar: Record<string, unknown>, label: string): number {
  const fulltime = coerceNumber(bar.fulltime ?? bar.full_time);
  if (fulltime !== null) return fulltime;
  const current = coerceNumber(bar.current);
  const maximum = coerceNumber(bar.maximum);
  if (current !== null && maximum !== null && current >= maximum) return 0;
  throw new TornApiError(`Expected number for ${label}.fulltime`);
}

function requireNumber(value: unknown, label: string): number {
  const number = coerceNumber(value);
  if (number === null) {
    throw new TornApiError(`Expected number for ${label}`);
  }
  return number;
}

function optionalNumber(value: unknown): number {
  return coerceNumber(value) ?? 0;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}
