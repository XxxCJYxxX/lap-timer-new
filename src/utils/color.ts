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
  purple: { bg: 'rgba(175,82,222,0.12)', text: 'var(--accent-purple)', label: 'PB' },
  green: { bg: 'rgba(52,199,89,0.12)', text: 'var(--green)', label: 'Faster' },
  yellow: { bg: 'rgba(255,149,0,0.12)', text: 'var(--yellow)', label: 'Slower' },
};
