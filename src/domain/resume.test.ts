import { describe, expect, it } from 'vitest';
import { displayedText, matchesSource, nextSegmentIndex, orderSegments } from './resume';
import { segment } from '../test/fixtures';

describe('orden y reanudación', () => {
  it('ordena fragmentos por índice, no por fecha de llegada', () => {
    expect(orderSegments([segment(2), segment(0), segment(1)]).map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it('reanuda en el primer hueco confirmado', () => {
    expect(nextSegmentIndex([segment(0), segment(2)], 4)).toBe(1);
    expect(nextSegmentIndex([segment(0), segment(1)], 2)).toBeNull();
  });

  it('exige coincidencia del fingerprint y metadatos de la fuente', () => {
    const source = { fingerprint: 'abc', size: 42, lastModified: 99 };
    expect(matchesSource(source, source)).toBe(true);
    expect(matchesSource(source, { ...source, fingerprint: 'otro' })).toBe(false);
    expect(matchesSource(source, { ...source, size: 41 })).toBe(false);
  });

  it('preserva una corrección manual aunque exista texto reconocido', () => {
    const original = segment(0, 'Texto reconocido');
    expect(displayedText({ ...original, editedText: 'Texto corregido', editedAt: 2 })).toBe('Texto corregido');
  });
});
