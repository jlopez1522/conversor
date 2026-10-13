import { displayedText, orderSegments } from '../domain/resume';
import { formatDuration, formatTimestamp } from '../domain/time';
import type { PersistedJob, TranscriptSegment } from '../domain/types';

export interface ExportDocument {
  title: string;
  duration?: number;
  exportedAt: Date;
  segments: TranscriptSegment[];
}

export function sanitizeFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[<>:"/\\|?*]/g, '_').trim() || 'transcripcion';
}

export function buildTxt(document: ExportDocument): string {
  const header = [
    'TRANSCRIPCIÓN',
    `Archivo original: ${document.title}`,
    `Duración: ${formatDuration(document.duration)}`,
    `Fecha de exportación: ${document.exportedAt.toLocaleString('es-CO')}`,
    'Marcas de tiempo: inicio absoluto de cada fragmento (no corresponden a palabras individuales).',
    '',
  ];
  const body = orderSegments(document.segments).map(
    (segment) => `[${formatTimestamp(segment.start)}] ${displayedText(segment).trim()}`,
  );
  return [...header, ...body, ''].join('\n');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function exportData(job: PersistedJob, segments: TranscriptSegment[]): ExportDocument {
  return { title: job.source.name, exportedAt: new Date(), segments, ...(job.duration !== undefined ? { duration: job.duration } : {}) };
}
