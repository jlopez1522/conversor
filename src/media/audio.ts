export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  words: TimedWord[];
}

function energy(channel: Float32Array): number {
  let sum = 0;
  for (const value of channel) sum += value * value;
  return sum;
}

export function mixChannels(channels: readonly Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  if (channels.length === 0) return new Float32Array();
  if (channels.length === 1) return channels[0]?.slice() ?? new Float32Array();

  if (channels.length === 2) {
    const left = channels[0];
    const right = channels[1];
    if (!left || !right) return new Float32Array();
    const leftEnergy = energy(left);
    const rightEnergy = energy(right);
    let dot = 0;
    for (let index = 0; index < length; index += 1) dot += (left[index] ?? 0) * (right[index] ?? 0);
    const correlation = dot / Math.max(Number.EPSILON, Math.sqrt(leftEnergy * rightEnergy));
    if (correlation < -0.25) return (leftEnergy >= rightEnergy ? left : right).slice();
  }

  const result = new Float32Array(length);
  for (const channel of channels) {
    for (let index = 0; index < length; index += 1) {
      result[index] = (result[index] ?? 0) + (channel[index] ?? 0) / channels.length;
    }
  }
  return result;
}

export function normalizeSpeechAudio(audio: Float32Array): Float32Array {
  if (audio.length === 0) return audio;
  let mean = 0;
  for (const value of audio) mean += value;
  mean /= audio.length;

  let sumSquares = 0;
  let peak = 0;
  for (let index = 0; index < audio.length; index += 1) {
    const centered = (audio[index] ?? 0) - mean;
    audio[index] = centered;
    sumSquares += centered * centered;
    peak = Math.max(peak, Math.abs(centered));
  }
  const rms = Math.sqrt(sumSquares / audio.length);
  if (rms < 0.001 || peak === 0) return audio;
  const targetRms = 0.08;
  const gain = Math.min(8, Math.max(0.25, targetRms / rms), 0.98 / peak);
  for (let index = 0; index < audio.length; index += 1) audio[index] = (audio[index] ?? 0) * gain;
  return audio;
}

export function textInsideWindow(
  result: TranscriptionResult,
  contextStart: number,
  windowStart: number,
  windowEnd: number,
  isLastWindow: boolean,
): string {
  if (result.words.length === 0) return result.text.trim();
  const selected = result.words.filter((word) => {
    const midpoint = contextStart + (word.start + word.end) / 2;
    return midpoint >= windowStart && (isLastWindow ? midpoint <= windowEnd : midpoint < windowEnd);
  });
  return selected.map((word) => word.text).join('').replace(/\s+/g, ' ').trim();
}
