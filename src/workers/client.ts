import type { InferenceDevice, WorkerCommand, WorkerRequest, WorkerResponse } from './protocol';
import type { TranscriptionResult } from '../media/audio';

interface PendingCall {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
}

export class TranscriptionClient {
  private readonly worker = new Worker(new URL('./transcription.worker.ts', import.meta.url), { type: 'module' });
  private readonly pending = new Map<number, PendingCall>();
  private sequence = 0;

  constructor(private readonly onProgress: (message: string, progress?: number) => void) {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        this.onProgress(response.status, response.progress);
        return;
      }
      const call = this.pending.get(response.id);
      if (!call) return;
      this.pending.delete(response.id);
      if (response.type === 'error') call.reject(new Error(response.message));
      else call.resolve(response);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'El worker de transcripción dejó de responder.');
      for (const call of this.pending.values()) call.reject(error);
      this.pending.clear();
    };
  }

  private call(request: WorkerCommand, transfer: Transferable[] = []): Promise<WorkerResponse> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...request, id } as WorkerRequest, transfer);
    });
  }

  async load(
    modelId: string,
    revision: string,
    preferredDevice: InferenceDevice = navigator.gpu ? 'webgpu' : 'wasm',
  ): Promise<InferenceDevice> {
    const response = await this.call({ type: 'load', modelId, revision, preferredDevice });
    if (response.type !== 'loaded') throw new Error('Respuesta inesperada al cargar el modelo.');
    return response.device;
  }

  async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
    const response = await this.call({ type: 'transcribe', audio, language: 'spanish' }, [audio.buffer]);
    if (response.type !== 'result') throw new Error('Respuesta inesperada durante la transcripción.');
    return { text: response.text, words: response.words };
  }

  terminate(): void {
    this.worker.terminate();
    for (const call of this.pending.values()) call.reject(new Error('Transcripción cancelada.'));
    this.pending.clear();
  }
}
