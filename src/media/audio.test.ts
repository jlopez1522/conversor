import { describe, expect, it } from 'vitest';
import { mixChannels, normalizeSpeechAudio, textInsideWindow } from './audio';

describe('procesamiento de audio', () => {
  it('evita que canales con fase invertida cancelen la voz', () => {
    const left = new Float32Array([0.2, -0.4, 0.6]);
    const right = new Float32Array([-0.2, 0.4, -0.6]);
    expect([...mixChannels([left, right])]).toEqual([...left]);
  });

  it('elimina componente continua y normaliza sin superar el límite', () => {
    const audio = new Float32Array([0.11, 0.09, 0.11, 0.09]);
    const normalized = normalizeSpeechAudio(audio);
    const mean = [...normalized].reduce((sum, value) => sum + value, 0) / normalized.length;
    expect(Math.abs(mean)).toBeLessThan(1e-6);
    expect(Math.max(...normalized.map(Math.abs))).toBeLessThanOrEqual(0.98);
  });
});

describe('recorte del contexto por palabras', () => {
  it('conserva solo palabras cuyo centro pertenece a la ventana lógica', () => {
    const text = textInsideWindow({
      text: 'antes hola mundo después',
      words: [
        { text: ' antes', start: 0, end: 1 },
        { text: ' hola', start: 2.6, end: 3 },
        { text: ' mundo', start: 26, end: 26.4 },
        { text: ' después', start: 28, end: 29 },
      ],
    }, 22.5, 25, 50, false);
    expect(text).toBe('hola mundo');
  });
});
