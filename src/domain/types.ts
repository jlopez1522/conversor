export const MODEL_ID = 'onnx-community/whisper-small_timestamped' as const;
export const MODEL_REVISION = '65caa70f294b46e1c33ff820aae6b16d048ab818' as const;
export const SEGMENT_SECONDS = 25;
export const CONTEXT_SECONDS = 2.5;
export const TARGET_SAMPLE_RATE = 16_000;

export type JobStatus =
  | 'pendiente'
  | 'requiere-archivo'
  | 'cargando-modelo'
  | 'procesando'
  | 'pausado'
  | 'completado'
  | 'cancelado'
  | 'error';

export interface SourceIdentity {
  fingerprint: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface ProcessingSettings {
  language: 'spanish';
  segmentSeconds: number;
  sampleRate: number;
  modelId: string;
  modelRevision: string;
  contextSeconds: number;
  normalizeAudio: boolean;
  wordTimestamps: boolean;
}

export interface TranscriptSegment {
  jobId: string;
  index: number;
  start: number;
  end: number;
  text: string;
  editedText?: string;
  editedAt?: number;
  sourceFingerprint: string;
  modelId: string;
  modelRevision: string;
  settings: ProcessingSettings;
  committedAt: number;
}

export interface PersistedJob {
  id: string;
  source: SourceIdentity;
  duration?: number;
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  completedSegments: number;
  totalSegments?: number;
  settings: ProcessingSettings;
  error?: string;
}

export interface RuntimeJob extends PersistedJob {
  file?: File;
  segments: TranscriptSegment[];
}

export const DEFAULT_SETTINGS: ProcessingSettings = {
  language: 'spanish',
  segmentSeconds: SEGMENT_SECONDS,
  sampleRate: TARGET_SAMPLE_RATE,
  modelId: MODEL_ID,
  modelRevision: MODEL_REVISION,
  contextSeconds: CONTEXT_SECONDS,
  normalizeAudio: true,
  wordTimestamps: true,
};
