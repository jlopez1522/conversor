import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';
import { TARGET_SAMPLE_RATE } from '../domain/types';
import { mixChannels, normalizeSpeechAudio } from './audio';

export interface MediaMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

function resampleLinear(source: Float32Array, sourceRate: number, targetRate: number, targetLength: number): Float32Array {
  if (sourceRate === targetRate && source.length === targetLength) return source;
  const result = new Float32Array(targetLength);
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < targetLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.min(Math.floor(sourcePosition), Math.max(0, source.length - 1));
    const right = Math.min(left + 1, Math.max(0, source.length - 1));
    const fraction = sourcePosition - left;
    result[index] = (source[left] ?? 0) * (1 - fraction) + (source[right] ?? 0) * fraction;
  }
  return result;
}

async function resample(source: Float32Array, sourceRate: number, targetLength: number): Promise<Float32Array> {
  if (sourceRate === TARGET_SAMPLE_RATE && source.length === targetLength) return source;
  try {
    const context = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
    const buffer = context.createBuffer(1, source.length, sourceRate);
    buffer.getChannelData(0).set(source);
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(context.destination);
    node.start();
    const rendered = await context.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } catch {
    return resampleLinear(source, sourceRate, TARGET_SAMPLE_RATE, targetLength);
  }
}

export class IncrementalMediaDecoder {
  private readonly input: Input;
  private sink?: AudioSampleSink;
  private metadata?: MediaMetadata;

  constructor(file: File) {
    this.input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  }

  async inspect(): Promise<MediaMetadata> {
    if (this.metadata) return this.metadata;
    const track = await this.input.getPrimaryAudioTrack();
    if (!track) throw new Error('El archivo no contiene una pista de audio compatible.');
    const [duration, sampleRate, channels, codec, decodable] = await Promise.all([
      this.input.computeDuration(),
      track.getSampleRate(),
      track.getNumberOfChannels(),
      track.getCodec(),
      track.canDecode(),
    ]);
    if (!decodable) throw new Error('El navegador reconoce el contenedor, pero no puede decodificar el códec de audio de este archivo.');
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('No fue posible determinar una duración válida.');
    this.sink = new AudioSampleSink(track);
    const resolved: MediaMetadata = { duration, sampleRate, channels, codec: codec ?? 'desconocido' };
    this.metadata = resolved;
    return resolved;
  }

  async decodeSegment(start: number, end: number): Promise<Float32Array> {
    const metadata = await this.inspect();
    if (!this.sink) throw new Error('No se pudo preparar el decodificador.');
    const actualEnd = Math.min(end, metadata.duration);
    const sourceLength = Math.max(1, Math.ceil((actualEnd - start) * metadata.sampleRate));
    const mono = new Float32Array(sourceLength);
    const counts = new Uint8Array(sourceLength);

    for await (const sample of this.sink.samples(start, actualEnd)) {
      try {
        const channelData: Float32Array[] = [];
        for (let channel = 0; channel < sample.numberOfChannels; channel += 1) {
          const data = new Float32Array(sample.numberOfFrames);
          sample.copyTo(data, { format: 'f32-planar', planeIndex: channel });
          channelData.push(data);
        }
        const mixedSample = mixChannels(channelData);
        for (let frame = 0; frame < sample.numberOfFrames; frame += 1) {
          const absoluteTime = sample.timestamp + frame / sample.sampleRate;
          const destination = Math.round((absoluteTime - start) * metadata.sampleRate);
          if (destination < 0 || destination >= mono.length) continue;
          mono[destination] = (mono[destination] ?? 0) + (mixedSample[frame] ?? 0);
          counts[destination] = Math.min(255, (counts[destination] ?? 0) + 1);
        }
      } finally {
        sample.close();
      }
    }

    for (let index = 0; index < mono.length; index += 1) {
      const count = counts[index] ?? 0;
      if (count > 1) mono[index] = (mono[index] ?? 0) / count;
    }
    const targetLength = Math.max(1, Math.round((actualEnd - start) * TARGET_SAMPLE_RATE));
    return normalizeSpeechAudio(await resample(mono, metadata.sampleRate, targetLength));
  }
}

export async function inspectMedia(file: File): Promise<MediaMetadata> {
  return new IncrementalMediaDecoder(file).inspect();
}
