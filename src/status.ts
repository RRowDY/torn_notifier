import type { BarSnapshot, Snapshot } from './torn/client.js';
export function formatStatus(snapshot: Snapshot, nowMs: number): string {
  const lines = [
    formatBar('Energy', snapshot.energy, nowMs),
    formatBar('Nerve', snapshot.nerve, nowMs),
    formatCooldown('Booster', snapshot.cooldowns.booster, nowMs),
    formatCooldown('Drug', snapshot.cooldowns.drug, nowMs),
    formatCooldown('Health', snapshot.cooldowns.medical, nowMs),
  ];
  if (snapshot.educationTimeLeft > 0) {
    lines.push(`Education: ${endsAt(nowMs, snapshot.educationTimeLeft)}`);
  }
  if (snapshot.bankTimeLeft > 0 || snapshot.bankAmount > 0) {
    lines.push(
      snapshot.bankTimeLeft > 0 ? `Bank: ${endsAt(nowMs, snapshot.bankTimeLeft)}` : 'Bank: ready',
    );
  }
  if (snapshot.travel.timeLeft > 0) {
    const destination = snapshot.travel.destination || 'destination';
    lines.push(`Travel to ${destination}: ${endsAt(nowMs, snapshot.travel.timeLeft)}`);
  }
  return lines.join('\n');
}
function formatBar(label: string, bar: BarSnapshot, nowMs: number): string {
  const remaining = bar.current >= bar.maximum ? 0 : Math.max(0, bar.fulltime);
  if (remaining <= 0) return `${label}: ${bar.current}/${bar.maximum} · full`;
  return `${label}: ${bar.current}/${bar.maximum} · full ${endsAt(nowMs, remaining)}`;
}
function formatCooldown(label: string, remainingSec: number, nowMs: number): string {
  if (remainingSec <= 0) return `${label}: ready`;
  return `${label}: ${endsAt(nowMs, remainingSec)}`;
}
function endsAt(nowMs: number, remainingSec: number): string {
  const unixSeconds = Math.floor(nowMs / 1000) + Math.max(0, Math.round(remainingSec));
  return `<t:${unixSeconds}:R>`;
}
