import { describe, expect, it } from 'vitest';
import { formatTimestamp, segmentBounds } from './time';

describe('formatTimestamp', () => {
  it('conserva el desplazamiento absoluto incluso después de tres horas', () => {
    expect(formatTimestamp(0)).toBe('00:00:00');
    expect(formatTimestamp(3 * 3600 + 7 * 60 + 9.9)).toBe('03:07:09');
    expect(formatTimestamp(-20)).toBe('00:00:00');
  });
});

describe('segmentBounds', () => {
  it('calcula desplazamientos absolutos y recorta el último fragmento', () => {
    expect(segmentBounds(360, 10_845, 30)).toEqual({ start: 10_800, end: 10_830 });
    expect(segmentBounds(361, 10_845, 30)).toEqual({ start: 10_830, end: 10_845 });
  });
});
