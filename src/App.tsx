import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { JobCard } from './components/JobCard';
import { LockIcon, LogoMark } from './components/Icons';
import { TranscriptPanel } from './components/TranscriptPanel';
import { describeError } from './domain/errors';
import { fingerprintFile } from './domain/fingerprint';
import { matchesSource, nextSegmentIndex, orderSegments } from './domain/resume';
import { segmentBounds } from './domain/time';
import { DEFAULT_SETTINGS, type PersistedJob, type RuntimeJob, type TranscriptSegment } from './domain/types';
import { CONTEXT_SECONDS } from './domain/types';
import { textInsideWindow, type TranscriptionResult } from './media/audio';
import { buildTxt, downloadBlob, exportData, sanitizeFileName } from './export/transcript';
import { clearAllData, commitSegment, deleteJob, getSegments, listJobs, saveEditedSegment, saveJob } from './storage/database';
import { TranscriptionClient } from './workers/client';

interface ControlState { pause: boolean; cancel: boolean }
const WEBGPU_SEGMENTS_BEFORE_RECYCLE = 4;

function persisted(job: RuntimeJob): PersistedJob {
  return {
    id: job.id,
    source: job.source,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    status: job.status,
    completedSegments: job.completedSegments,
    settings: job.settings,
    ...(job.duration !== undefined ? { duration: job.duration } : {}),
    ...(job.totalSegments !== undefined ? { totalSegments: job.totalSegments } : {}),
    ...(job.error !== undefined ? { error: job.error } : {}),
  };
}

function withOptionalDuration(base: Omit<RuntimeJob, 'duration'>, duration: number | undefined): RuntimeJob {
  return duration === undefined ? base : { ...base, duration };
}

function withoutError(job: RuntimeJob): RuntimeJob {
  const clean = { ...job };
  delete clean.error;
  return clean;
}

export function App() {
  const [jobs, setJobs] = useState<RuntimeJob[]>([]);
  const jobsRef = useRef<RuntimeJob[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState('Listo para procesar en este dispositivo.');
  const [modelProgress, setModelProgress] = useState<number>();
  const controls = useRef(new Map<string, ControlState>());
  const activeClient = useRef<{ jobId: string; client: TranscriptionClient } | undefined>(undefined);
  const running = useRef(false);

  const replaceJobs = (updater: (current: RuntimeJob[]) => RuntimeJob[]) => {
    const next = updater(jobsRef.current);
    jobsRef.current = next;
    setJobs(next);
  };

  const updateJob = (id: string, updater: (job: RuntimeJob) => RuntimeJob) => {
    replaceJobs((current) => current.map((job) => job.id === id ? updater(job) : job));
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await listJobs();
        const restored = await Promise.all(stored.map(async (job): Promise<RuntimeJob> => ({
          ...job,
          status: job.status === 'completado' ? 'completado' : 'requiere-archivo',
          segments: orderSegments(await getSegments(job.id)),
        })));
        if (!active) return;
        jobsRef.current = restored;
        setJobs(restored);
        setSelectedId(restored[0]?.id);
      } catch (error) {
        setNotice(`No se pudo abrir el historial local: ${describeError(error)}`);
      }
    })();
    return () => { active = false; activeClient.current?.client.terminate(); };
  }, []);

  const selected = useMemo(() => jobs.find((job) => job.id === selectedId), [jobs, selectedId]);

  const addFiles = async (files: File[]) => {
    setScanning(true);
    const { inspectMedia } = await import('./media/decoder');
    for (const file of files) {
      try {
        const fingerprint = await fingerprintFile(file);
        const existing = jobsRef.current.find((job) => job.source.fingerprint === fingerprint);
        if (existing) {
          updateJob(existing.id, (job) => withoutError({ ...job, file, status: job.status === 'completado' ? 'completado' : 'pausado' }));
          setSelectedId(existing.id);
          setNotice(`Se vinculó de nuevo “${file.name}” con su avance guardado.`);
          continue;
        }
        const metadata = await inspectMedia(file);
        const now = Date.now();
        const totalSegments = Math.ceil(metadata.duration / DEFAULT_SETTINGS.segmentSeconds);
        const base: Omit<RuntimeJob, 'duration'> = {
          id: fingerprint,
          source: { fingerprint, name: file.name, size: file.size, type: file.type, lastModified: file.lastModified },
          file,
          createdAt: now,
          updatedAt: now,
          status: 'pendiente',
          completedSegments: 0,
          totalSegments,
          settings: { ...DEFAULT_SETTINGS },
          segments: [],
        };
        const job = withOptionalDuration(base, metadata.duration);
        await saveJob(persisted(job));
        replaceJobs((current) => [job, ...current]);
        setSelectedId(job.id);
        setNotice(`“${file.name}” está listo. Códec de audio detectado: ${metadata.codec}.`);
      } catch (error) {
        setNotice(`No se pudo agregar “${file.name}”: ${describeError(error)}`);
      }
    }
    setScanning(false);
  };

  const relink = async (jobId: string, file: File) => {
    try {
      const { inspectMedia } = await import('./media/decoder');
      const job = jobsRef.current.find((item) => item.id === jobId);
      if (!job) return;
      const fingerprint = await fingerprintFile(file);
      const actual = { fingerprint, size: file.size, lastModified: file.lastModified };
      if (!matchesSource(job.source, actual)) throw new Error('El archivo no coincide con el original guardado. Selecciona exactamente la misma fuente.');
      await inspectMedia(file);
      updateJob(jobId, (current) => withoutError({ ...current, file, status: 'pausado' }));
      setNotice('Archivo verificado. Puedes reanudar desde el primer fragmento pendiente.');
    } catch (error) {
      updateJob(jobId, (job) => ({ ...job, error: describeError(error) }));
    }
  };

  const setStatus = async (jobId: string, status: RuntimeJob['status'], error?: string) => {
    const current = jobsRef.current.find((job) => job.id === jobId);
    if (!current) return;
    const updated: RuntimeJob = error
      ? { ...current, status, updatedAt: Date.now(), error }
      : withoutError({ ...current, status, updatedAt: Date.now() });
    updateJob(jobId, () => updated);
    await saveJob(persisted(updated));
  };

  const runJob = async (jobId: string) => {
    if (running.current) {
      setNotice('Ya hay una transcripción activa. Paúsala o espera a que termine antes de iniciar otra.');
      return;
    }
    const initial = jobsRef.current.find((job) => job.id === jobId);
    if (!initial?.file) {
      setNotice('Vuelve a seleccionar el archivo original antes de reanudar.');
      return;
    }
    running.current = true;
    const control: ControlState = { pause: false, cancel: false };
    controls.current.set(jobId, control);
    const progressHandler = (message: string, progress?: number) => {
      setNotice(message);
      setModelProgress(progress);
    };
    let client = new TranscriptionClient(progressHandler);
    activeClient.current = { jobId, client };

    try {
      await setStatus(jobId, 'cargando-modelo');
      const { IncrementalMediaDecoder } = await import('./media/decoder');
      const decoder = new IncrementalMediaDecoder(initial.file);
      const metadata = await decoder.inspect();
      const totalSegments = Math.ceil(metadata.duration / initial.settings.segmentSeconds);
      updateJob(jobId, (job) => ({ ...job, duration: metadata.duration, totalSegments }));
      let device = await client.load(initial.settings.modelId, initial.settings.modelRevision);
      setModelProgress(undefined);
      setNotice(`Modelo listo con ${device === 'webgpu' ? 'WebGPU' : 'WASM/CPU'}.`);
      await setStatus(jobId, 'procesando');

      while (true) {
        if (control.cancel) {
          await setStatus(jobId, 'cancelado');
          break;
        }
        const current = jobsRef.current.find((job) => job.id === jobId);
        if (!current) break;
        const index = nextSegmentIndex(current.segments, totalSegments);
        if (index === null) {
          await setStatus(jobId, 'completado');
          setNotice(`Transcripción completa de “${current.source.name}”.`);
          break;
        }
        const { start, end } = segmentBounds(index, metadata.duration, current.settings.segmentSeconds);
        const contextSeconds = current.settings.contextSeconds ?? CONTEXT_SECONDS;
        const contextStart = Math.max(0, start - contextSeconds);
        const contextEnd = Math.min(metadata.duration, end + contextSeconds);
        setNotice(`Decodificando fragmento ${index + 1} de ${totalSegments}…`);
        const audio = await decoder.decodeSegment(contextStart, contextEnd);
        if (control.cancel) continue;
        setNotice(`Transcribiendo fragmento ${index + 1} de ${totalSegments}…`);
        let result: TranscriptionResult;
        const fallbackAudio = device === 'webgpu' ? audio.slice() : undefined;
        try {
          result = await client.transcribe(audio);
        } catch (error) {
          if (device !== 'webgpu' || control.cancel) throw error;
          if (!fallbackAudio) throw error;
          setNotice('WebGPU falló durante la inferencia; reintentando el fragmento con WASM/CPU…');
          client.terminate();
          client = new TranscriptionClient(progressHandler);
          activeClient.current = { jobId, client };
          device = await client.load(initial.settings.modelId, initial.settings.modelRevision, 'wasm');
          result = await client.transcribe(fallbackAudio);
        }
        const text = textInsideWindow(result, contextStart, start, end, end >= metadata.duration);
        const latest = jobsRef.current.find((job) => job.id === jobId);
        if (!latest || control.cancel) continue;
        const segment: TranscriptSegment = {
          jobId,
          index,
          start,
          end,
          text,
          sourceFingerprint: latest.source.fingerprint,
          modelId: latest.settings.modelId,
          modelRevision: latest.settings.modelRevision,
          settings: { ...latest.settings },
          committedAt: Date.now(),
        };
        const segments = orderSegments([...latest.segments.filter((item) => item.index !== index), segment]);
        const updated: RuntimeJob = withoutError({ ...latest, segments, completedSegments: segments.length, totalSegments, status: 'procesando', updatedAt: Date.now() });
        await commitSegment(persisted(updated), segment);
        updateJob(jobId, () => updated);
        if (control.pause) {
          await setStatus(jobId, 'pausado');
          setNotice('Pausa confirmada al terminar el fragmento actual.');
          break;
        }
        if (device === 'webgpu'
          && segments.length % WEBGPU_SEGMENTS_BEFORE_RECYCLE === 0
          && segments.length < totalSegments) {
          setNotice('Liberando memoria de la GPU antes de continuar…');
          client.terminate();
          client = new TranscriptionClient(progressHandler);
          activeClient.current = { jobId, client };
          device = await client.load(initial.settings.modelId, initial.settings.modelRevision);
        }
      }
    } catch (error) {
      if (control.cancel) {
        await setStatus(jobId, 'cancelado');
        setNotice('Transcripción cancelada. Los fragmentos confirmados se conservaron.');
      } else {
        const message = describeError(error);
        await setStatus(jobId, 'error', message);
        setNotice(`La transcripción se detuvo: ${message}`);
      }
    } finally {
      client.terminate();
      activeClient.current = undefined;
      controls.current.delete(jobId);
      running.current = false;
      setModelProgress(undefined);
    }
  };

  const pause = (jobId: string) => {
    const control = controls.current.get(jobId);
    if (control) {
      control.pause = true;
      setNotice('La pausa se aplicará cuando termine el fragmento en curso.');
    }
  };

  const cancel = (jobId: string) => {
    const control = controls.current.get(jobId);
    if (!control) return;
    control.cancel = true;
    if (activeClient.current?.jobId === jobId) activeClient.current.client.terminate();
  };

  const editSegment = async (segment: TranscriptSegment, text: string) => {
    const edited: TranscriptSegment = { ...segment, editedText: text, editedAt: Date.now() };
    await saveEditedSegment(edited);
    updateJob(segment.jobId, (job) => ({ ...job, segments: job.segments.map((item) => item.index === segment.index ? edited : item) }));
    setNotice('Corrección guardada localmente. No será reemplazada al reanudar.');
  };

  const remove = async (job: RuntimeJob) => {
    if (job.status === 'procesando' || job.status === 'cargando-modelo') return;
    if (!window.confirm(`¿Eliminar “${job.source.name}” y todos sus fragmentos guardados?`)) return;
    await deleteJob(job.id);
    replaceJobs((current) => current.filter((item) => item.id !== job.id));
    if (selectedId === job.id) setSelectedId(jobsRef.current[0]?.id);
    setNotice('Trabajo y transcripción eliminados del navegador.');
  };

  const clearHistory = async () => {
    if (running.current || !window.confirm('¿Eliminar todo el historial y todas las transcripciones guardadas en este navegador?')) return;
    await clearAllData();
    replaceJobs(() => []);
    setSelectedId(undefined);
    setNotice('Se eliminaron todos los datos locales de la aplicación.');
  };

  const exportTxt = () => {
    if (!selected) return;
    const content = buildTxt(exportData(selected, selected.segments));
    downloadBlob(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }), `${sanitizeFileName(selected.source.name)}.txt`);
  };

  const exportDocx = async () => {
    if (!selected) return;
    const { buildDocx } = await import('./export/docx');
    const blob = await buildDocx(exportData(selected, selected.segments));
    downloadBlob(blob, `${sanitizeFileName(selected.source.name)}.docx`);
  };

  return (
    <div className="noise min-h-screen">
      <header className="border-b border-black/[.06] bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3"><LogoMark /><div><p className="font-extrabold tracking-tight">Transcriptor Web Local</p><p className="text-xs text-black/50">Audio a texto, sin salir de tu dispositivo</p></div></div>
          <div className="hidden items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-moss sm:flex"><LockIcon /> Privado y local</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">
        <section className="mb-9 grid items-end gap-6 lg:grid-cols-[1fr_390px]">
          <div><p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-ember">Transcripción privada en español</p><h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Tus grabaciones se quedan contigo.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-black/60">Procesa audios y videos largos dentro del navegador. Puedes pausar, cerrar la pestaña y recuperar los fragmentos ya confirmados al volver a seleccionar el archivo.</p></div>
          <div className="rounded-2xl border border-moss/10 bg-mint/70 p-4 text-sm leading-6 text-moss"><strong>Antes de empezar:</strong> el modelo Whisper se descarga desde Hugging Face la primera vez (aprox. 250–600 MB según el motor). No cierres la pestaña durante un fragmento; el trabajo no continúa con la pestaña cerrada.</div>
        </section>

        <FileDropzone busy={scanning} onFiles={(files) => void addFiles(files)} />

        <div className="my-5 flex items-center justify-between gap-4 rounded-2xl border border-black/[.06] bg-white/70 px-4 py-3 text-sm" role="status" aria-live="polite">
          <span className="min-w-0 truncate">{notice}</span>
          {modelProgress !== undefined && <span className="shrink-0 font-semibold text-moss">{Math.round(modelProgress)}%</span>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <section aria-labelledby="queue-title">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Cola local</p><h2 id="queue-title" className="text-2xl font-bold">Grabaciones</h2></div>{jobs.length > 0 && <button className="text-xs font-semibold text-red-700 underline-offset-4 hover:underline" onClick={() => void clearHistory()}>Borrar todo</button>}</div>
            <div className="space-y-3">
              {!jobs.length && <div className="card p-8 text-center text-sm text-black/50">Todavía no hay grabaciones en la cola.</div>}
              {jobs.map((job) => <JobCard key={job.id} job={job} active={job.id === selectedId} onSelect={() => setSelectedId(job.id)} onStart={() => void runJob(job.id)} onPause={() => pause(job.id)} onCancel={() => cancel(job.id)} onDelete={() => void remove(job)} onRelink={(file) => void relink(job.id, file)} />)}
            </div>
          </section>
          <TranscriptPanel {...(selected ? { job: selected } : {})} onEdit={(segment, text) => void editSegment(segment, text)} onTxt={exportTxt} onDocx={() => void exportDocx()} />
        </div>

        <section className="mt-10 grid gap-4 text-sm md:grid-cols-3">
          <div className="card p-5"><h2 className="font-bold">Qué permanece local</h2><p className="mt-2 leading-6 text-black/60">El archivo, el audio decodificado y la transcripción. Solo se descargan los archivos estáticos de la app y el modelo.</p></div>
          <div className="card p-5"><h2 className="font-bold">Límites reales</h2><p className="mt-2 leading-6 text-black/60">WebGPU, WebAssembly, códecs, memoria y almacenamiento dependen del navegador y de las políticas del dispositivo.</p></div>
          <div className="card p-5"><h2 className="font-bold">Uso responsable</h2><p className="mt-2 leading-6 text-black/60">La aplicación no está aprobada por sí sola para material confidencial. Sigue siempre las políticas de tu organización.</p></div>
        </section>
      </main>
    </div>
  );
}
