import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { displayedText, orderSegments } from '../domain/resume';
import { formatDuration, formatTimestamp } from '../domain/time';
import type { ExportDocument } from './transcript';

export async function buildDocx(document: ExportDocument): Promise<Blob> {
  const paragraphs = orderSegments(document.segments).map((segment) => new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: `[${formatTimestamp(segment.start)}] `, bold: true, color: '175C48' }),
      new TextRun(displayedText(segment).trim()),
    ],
  }));
  const doc = new Document({
    creator: 'Transcriptor Web Local',
    title: `Transcripción de ${document.title}`,
    description: 'Transcripción generada localmente en el navegador.',
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: 'Transcripción', heading: HeadingLevel.TITLE }),
        new Paragraph({ children: [new TextRun({ text: 'Archivo original: ', bold: true }), new TextRun(document.title)] }),
        new Paragraph({ children: [new TextRun({ text: 'Duración: ', bold: true }), new TextRun(formatDuration(document.duration))] }),
        new Paragraph({ children: [new TextRun({ text: 'Fecha de exportación: ', bold: true }), new TextRun(document.exportedAt.toLocaleString('es-CO'))] }),
        new Paragraph({
          spacing: { after: 320 },
          children: [new TextRun({ text: 'Las marcas indican el inicio absoluto de cada fragmento de audio; no son tiempos por palabra.', italics: true })],
        }),
        ...paragraphs,
      ],
    }],
  });
  return Packer.toBlob(doc);
}
