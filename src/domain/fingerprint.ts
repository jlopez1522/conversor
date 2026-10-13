const SAMPLE_BYTES = 512 * 1024;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintFile(file: File): Promise<string> {
  const head = file.slice(0, Math.min(SAMPLE_BYTES, file.size));
  const tailStart = Math.max(0, file.size - SAMPLE_BYTES);
  const tail = file.slice(tailStart, file.size);
  const metadata = new TextEncoder().encode(`${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`);
  const [headBuffer, tailBuffer] = await Promise.all([head.arrayBuffer(), tail.arrayBuffer()]);
  const combined = new Uint8Array(metadata.byteLength + headBuffer.byteLength + tailBuffer.byteLength);
  combined.set(metadata, 0);
  combined.set(new Uint8Array(headBuffer), metadata.byteLength);
  combined.set(new Uint8Array(tailBuffer), metadata.byteLength + headBuffer.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  return bytesToHex(new Uint8Array(digest));
}
