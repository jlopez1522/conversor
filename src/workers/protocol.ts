import type { TimedWord } from '../media/audio';

export type InferenceDevice = 'webgpu' | 'wasm';

export type WorkerRequest =
  | { id: number; type: 'load'; modelId: string; revision: string; preferredDevice: InferenceDevice }
  | { id: number; type: 'transcribe'; audio: Float32Array; language: 'spanish' }
  | { id: number; type: 'dispose' };

export type WorkerCommand =
  | { type: 'load'; modelId: string; revision: string; preferredDevice: InferenceDevice }
  | { type: 'transcribe'; audio: Float32Array; language: 'spanish' }
  | { type: 'dispose' };

export type WorkerResponse =
  | { id: number; type: 'loaded'; device: InferenceDevice }
  | { id: number; type: 'result'; text: string; words: TimedWord[] }
  | { id: number; type: 'disposed' }
  | { id: number; type: 'error'; message: string }
  | { id: number; type: 'progress'; status: string; progress?: number; file?: string };
