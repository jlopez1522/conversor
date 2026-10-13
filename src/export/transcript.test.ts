import { describe, expect, it } from 'vitest';
import { buildDocx } from './docx';
import { buildTxt, sanitizeFileName } from './transcript';
import { segment } from '../test/fixtures';

describe('exportaciones', () => {
  const data = {
    title: 'entrevista.mp4',
    duration: 75,
    exportedAt: new Date('2026-01-02T12:00:00Z'),
    segments: [segment(1, 'Segundo'), { ...segment(0, 'Original'), editedText: 'Corregido', editedAt: 2 }],
  };

  it('genera TXT completo, ordenado, con metadatos y edición', () => {
    const text = buildTxt(data);
    expect(text).toContain('Archivo original: entrevista.mp4');
    expect(text.indexOf('[00:00:00] Corregido')).toBeLessThan(text.indexOf('[00:00:30] Segundo'));
    expect(text).toContain('Marcas de tiempo: inicio absoluto de cada fragmento');
  });

  it('genera un DOCX no vacío', async () => {
    const blob = await buildDocx(data);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(1_000);
  });

  it('limpia nombres inseguros', () => {
    expect(sanitizeFileName('reunión: ventas?.m4a')).toBe('reunión_ ventas_');
  });
});
