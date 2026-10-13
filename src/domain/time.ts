export function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function formatDuration(seconds?: number): string {
  return seconds === undefined || !Number.isFinite(seconds) ? 'Duración por detectar' : formatTimestamp(seconds);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${unit}`;
}

export function segmentBounds(index: number, duration: number, segmentSeconds: number): { start: number; end: number } {
  if (!Number.isInteger(index) || index < 0 || duration < 0 || segmentSeconds <= 0) {
    throw new RangeError('Los límites del fragmento no son válidos.');
  }
  const start = index * segmentSeconds;
  return { start, end: Math.min(duration, start + segmentSeconds) };
}
