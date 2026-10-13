import { useState } from 'react';
import { displayedText, orderSegments } from '../domain/resume';
import { formatTimestamp } from '../domain/time';
import type { RuntimeJob, TranscriptSegment } from '../domain/types';

interface TranscriptPanelProps {
  job?: RuntimeJob;
  onEdit: (segment: TranscriptSegment, text: string) => void;
  onTxt: () => void;
  onDocx: () => void;
}

function SegmentEditor({ segment, onEdit }: { segment: TranscriptSegment; onEdit: (text: string) => void }) {
  const [value, setValue] = useState(displayedText(segment));
  return (
    <div className="grid gap-2 border-b border-black/[.06] py-4 md:grid-cols-[90px_1fr]">
      <label className="pt-2 text-sm font-bold text-moss" htmlFor={`segment-${segment.jobId}-${segment.index}`}>[{formatTimestamp(segment.start)}]</label>
      <textarea
        id={`segment-${segment.jobId}-${segment.index}`}
        rows={2}
        className="w-full resize-y rounded-xl border border-transparent bg-black/[.025] px-3 py-2 leading-6 hover:border-black/10 focus:border-moss focus:bg-white"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => { if (value !== displayedText(segment)) onEdit(value); }}
        aria-label={`Texto del fragmento ${formatTimestamp(segment.start)}`}
      />
    </div>
  );
}

export function TranscriptPanel({ job, onEdit, onTxt, onDocx }: TranscriptPanelProps) {
  if (!job) return <section className="card grid min-h-80 place-items-center p-8 text-center text-black/50"><p>Selecciona un trabajo para revisar su transcripción.</p></section>;
  const segments = orderSegments(job.segments);
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] p-5">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Vista previa editable</p><h2 className="mt-1 max-w-lg truncate text-xl font-bold">{job.source.name}</h2></div>
        <div className="flex gap-2"><button className="btn-secondary" disabled={!segments.length} onClick={onTxt}>Descargar TXT</button><button className="btn-primary" disabled={!segments.length} onClick={onDocx}>Descargar DOCX</button></div>
      </header>
      <div className="max-h-[620px] overflow-y-auto px-5">
        {!segments.length ? <p className="py-16 text-center text-sm text-black/50">Los fragmentos confirmados aparecerán aquí. Cada marca indica el inicio del fragmento, no de cada palabra.</p> : segments.map((segment) => <SegmentEditor key={`${segment.index}-${segment.editedAt ?? 0}`} segment={segment} onEdit={(text) => onEdit(segment, text)} />)}
      </div>
    </section>
  );
}
