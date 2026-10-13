import { useRef, useState } from 'react';
import { UploadIcon } from './Icons';

interface FileDropzoneProps {
  busy: boolean;
  onFiles: (files: File[]) => void;
}

const ACCEPT = '.mp4,.mov,.mkv,.mp3,.wav,.m4a,audio/*,video/mp4,video/quicktime,video/x-matroska';

export function FileDropzone({ busy, onFiles }: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (list: FileList | null) => {
    if (list?.length) onFiles(Array.from(list));
  };

  return (
    <section
      className={`card border-2 border-dashed p-7 text-center transition ${dragging ? 'border-moss bg-mint/50' : 'border-moss/20'}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }}
      aria-label="Selección de archivos"
    >
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(event) => { accept(event.target.files); event.currentTarget.value = ''; }}
      />
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-mint text-moss"><UploadIcon /></div>
      <h2 className="text-xl font-bold">Suelta tus grabaciones aquí</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/60">MP4, MOV, MKV, MP3, WAV o M4A. La compatibilidad final depende del códec y del navegador.</p>
      <button className="btn-primary mt-5" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Analizando archivos…' : 'Seleccionar archivos'}
      </button>
    </section>
  );
}
