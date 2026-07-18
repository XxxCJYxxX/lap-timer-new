import type { LapRecord, RecordColor } from '../types';

export function computeColor(
  records: LapRecord[],
  newTimeMs: number,
): RecordColor {
  if (records.length === 0) return null;

  const times = records.map((r) => r.timeMs);
  const pb = Math.min(...times);
  const lastTime = records[records.length - 1].timeMs;

  if (newTimeMs < pb) return 'purple';
  if (newTimeMs < lastTime) return 'green';
  return 'yellow';
}

export const COLOR_MAP: Record<string, { bg: string; text: string; label: string }> = {
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-300', label: 'PB' },
  green: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Faster' },
  yellow: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Slower' },
};
