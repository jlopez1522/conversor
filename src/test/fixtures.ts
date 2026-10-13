import { DEFAULT_SETTINGS, type TranscriptSegment } from '../domain/types';

export function segment(index: number, text = `Texto ${index}`): TranscriptSegment {
  return {
    jobId: 'job-1',
    index,
    start: index * 30,
    end: (index + 1) * 30,
    text,
    sourceFingerprint: 'abc123',
    modelId: DEFAULT_SETTINGS.modelId,
    modelRevision: DEFAULT_SETTINGS.modelRevision,
    settings: { ...DEFAULT_SETTINGS },
    committedAt: 1_700_000_000_000 + index,
  };
}
