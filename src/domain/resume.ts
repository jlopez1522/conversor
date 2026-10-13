import type { TranscriptSegment } from './types';

export function orderSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  return [...segments].sort((a, b) => a.index - b.index || a.start - b.start);
}

export function nextSegmentIndex(segments: readonly TranscriptSegment[], totalSegments: number): number | null {
  const completed = new Set(segments.map((segment) => segment.index));
  for (let index = 0; index < totalSegments; index += 1) {
    if (!completed.has(index)) return index;
  }
  return null;
}

export function matchesSource(
  expected: { fingerprint: string; size: number; lastModified: number },
  actual: { fingerprint: string; size: number; lastModified: number },
): boolean {
  return expected.fingerprint === actual.fingerprint
    && expected.size === actual.size
    && expected.lastModified === actual.lastModified;
}

export function displayedText(segment: TranscriptSegment): string {
  return segment.editedText ?? segment.text;
}
