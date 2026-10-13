import { formatBytes, formatDuration } from '../domain/time';
import type { RuntimeJob } from '../domain/types';

interface JobCardProps {
  job: RuntimeJob;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRelink: (file: File) => void;
}

const STATUS: Record<RuntimeJob['status'], string> = {
  pendiente: 'Pendiente',
  'requiere-archivo': 'Volver a seleccionar',
  'cargando-modelo': 'Cargando modelo',
  procesando: 'Transcribiendo',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  error: 'Requiere atención',
};

export function JobCard({ job, active, onSelect, onStart, onPause, onCancel, onDelete, onRelink }: JobCardProps) {
  const total = job.totalSegments ?? 0;
  const progress = total > 0 ? Math.min(100, Math.round(job.completedSegments / total * 100)) : 0;
  const running = job.status === 'procesando' || job.status === 'cargando-modelo';
  const canStart = Boolean(job.file) && !running && job.status !== 'completado';

  return (
    <article className={`card p-5 ${active ? 'ring-2 ring-moss/30' : ''}`}>
      <button className="w-full text-left" onClick={onSelect} aria-label={`Ver transcripción de ${job.source.name}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold">{job.source.name}</h3>
            <p className="mt-1 text-xs text-black/55">{formatBytes(job.source.size)} · {formatDuration(job.duration)}</p>
          </div>
          <span className={`badge ${job.status === 'error' ? 'bg-red-100 text-red-800' : job.status === 'completado' ? 'bg-mint text-moss' : 'bg-black/5 text-black/65'}`}>{STATUS[job.status]}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="mt-2 flex justify-between text-xs text-black/55"><span>{job.completedSegments} de {total || '…'} fragmentos</span><span>{progress}%</span></div>
      </button>
      {job.error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{job.error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!job.file && job.status !== 'completado' && <label className="btn-primary cursor-pointer">Vincular archivo<input className="sr-only" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRelink(file); event.currentTarget.value = ''; }} /></label>}
        {canStart && <button className="btn-primary" onClick={onStart}>{job.completedSegments ? 'Reanudar' : 'Iniciar'}</button>}
        {running && <button className="btn-secondary" onClick={onPause}>Pausar al terminar fragmento</button>}
        {running && <button className="btn-secondary text-red-700" onClick={onCancel}>Cancelar</button>}
        <button className="btn-secondary ml-auto" disabled={running} onClick={onDelete}>Eliminar</button>
      </div>
    </article>
  );
}
