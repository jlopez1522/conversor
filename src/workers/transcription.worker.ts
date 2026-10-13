/// <reference lib="webworker" />
import { env, pipeline } from '@huggingface/transformers';
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { TranscriptionResult } from '../media/audio';
import type { InferenceDevice, WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: AutomaticSpeechRecognitionPipeline | undefined;
let loadedDevice: InferenceDevice | undefined;

type AsrFactory = (
  task: 'automatic-speech-recognition',
  model: string,
  options: {
    revision: string;
    device: InferenceDevice;
    dtype: { encoder_model: 'fp32' | 'q8'; decoder_model_merged: 'q4' | 'q8' };
    progress_callback: (event: { status?: string; progress?: number; file?: string }) => void;
  },
) => Promise<AutomaticSpeechRecognitionPipeline>;

const createAsr = pipeline as unknown as AsrFactory;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido del motor de transcripción.';
}

function extractResult(output: unknown): TranscriptionResult {
  if (Array.isArray(output) && output.length > 0) return extractResult(output[0]);
  if (typeof output === 'object' && output !== null && 'text' in output) {
    const candidate = output as { text?: unknown; chunks?: unknown };
    if (typeof candidate.text !== 'string') throw new Error('Whisper devolvió texto con un formato no reconocido.');
    const words: TranscriptionResult['words'] = [];
    if (Array.isArray(candidate.chunks)) {
      for (const chunk of candidate.chunks) {
        if (typeof chunk !== 'object' || chunk === null) continue;
        const value = chunk as { text?: unknown; timestamp?: unknown };
        if (typeof value.text !== 'string' || !Array.isArray(value.timestamp)) continue;
        const start = value.timestamp[0];
        const end = value.timestamp[1];
        if (typeof start !== 'number' || !Number.isFinite(start)) continue;
        words.push({
          text: value.text,
          start,
          end: typeof end === 'number' && Number.isFinite(end) ? end : start,
        });
      }
    }
    return { text: candidate.text.trim(), words };
  }
  throw new Error('Whisper devolvió una respuesta sin texto reconocible.');
}

async function createPipeline(
  id: number,
  modelId: string,
  revision: string,
  device: InferenceDevice,
): Promise<AutomaticSpeechRecognitionPipeline> {
  const dtype = device === 'webgpu'
    ? { encoder_model: 'fp32' as const, decoder_model_merged: 'q4' as const }
    : { encoder_model: 'q8' as const, decoder_model_merged: 'q8' as const };
  return createAsr('automatic-speech-recognition', modelId, {
    revision,
    device,
    dtype,
    progress_callback: (event: { status?: string; progress?: number; file?: string }) => {
      post({
        id,
        type: 'progress',
        status: event.status ?? 'descargando',
        ...(typeof event.progress === 'number' ? { progress: event.progress } : {}),
        ...(event.file ? { file: event.file } : {}),
      });
    },
  });
}

async function load(request: Extract<WorkerRequest, { type: 'load' }>): Promise<void> {
  if (transcriber && loadedDevice) {
    post({ id: request.id, type: 'loaded', device: loadedDevice });
    return;
  }
  try {
    transcriber = await createPipeline(request.id, request.modelId, request.revision, request.preferredDevice);
    loadedDevice = request.preferredDevice;
  } catch (error) {
    if (request.preferredDevice !== 'webgpu') throw error;
    post({ id: request.id, type: 'progress', status: 'WebGPU no disponible; cambiando a WASM/CPU.' });
    transcriber = await createPipeline(request.id, request.modelId, request.revision, 'wasm');
    loadedDevice = 'wasm';
  }
  post({ id: request.id, type: 'loaded', device: loadedDevice });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'load') {
      await load(request);
      return;
    }
    if (request.type === 'dispose') {
      await transcriber?.dispose();
      transcriber = undefined;
      loadedDevice = undefined;
      post({ id: request.id, type: 'disposed' });
      return;
    }
    if (!transcriber) throw new Error('El modelo todavía no está cargado.');
    const output: unknown = await transcriber(request.audio, {
      language: request.language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      force_full_sequences: false,
    });
    const result = extractResult(output);
    post({ id: request.id, type: 'result', text: result.text, words: result.words });
  } catch (error) {
    post({ id: request.id, type: 'error', message: messageFrom(error) });
  }
};

export {};
