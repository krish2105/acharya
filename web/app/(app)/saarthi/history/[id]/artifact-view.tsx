'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, Loader2, Save, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalCard } from '@/components/shared/approval-card';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { approveArtifactAction, renderArtifactPdf, saveArtifact, shareArtifact, signedUrl } from '../../actions';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
interface Artifact {
  id: string; kind: string; title: string; body: Json; generated_version: Json | null; status: string; language: string; grade: string | null; file_path: string | null;
  subjects: { name: string } | null; frameworks: { code: string } | null; students: { full_name: string } | null;
  artifact_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[];
  artifact_shares: { shared_with_role: string; shared_with_subject: string | null; shared_at: string }[];
  approvals: { edit_distance: number | null; approved_at: string }[] | null;
}

/** Flattens a JSON body into readable prose for the side-by-side diff. */
function toProse(v: Json, depth = 0): string {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.map((x) => `• ${toProse(x, depth + 1)}`).join('\n');
  return Object.entries(v).map(([k, x]) => (typeof x === 'object' && x !== null ? `${k.replace(/_/g, ' ')}:\n${toProse(x, depth + 1)}` : `${k.replace(/_/g, ' ')}: ${toProse(x, depth + 1)}`)).join('\n');
}

function Field({ path, value, onChange, disabled }: { path: (string | number)[]; value: Json; onChange: (path: (string | number)[], v: Json) => void; disabled: boolean }) {
  const label = String(path[path.length - 1]).replace(/_/g, ' ');
  if (typeof value === 'string') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {value.length > 80 ? <Textarea rows={Math.min(8, Math.ceil(value.length / 90) + 1)} value={value} disabled={disabled} onChange={(e) => onChange(path, e.target.value)} /> : <Input value={value} disabled={disabled} onChange={(e) => onChange(path, e.target.value)} />}
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Input type="number" value={value} disabled={disabled} className="w-32" onChange={(e) => onChange(path, Number(e.target.value))} />
      </label>
    );
  }
  if (Array.isArray(value)) {
    return (
      <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</legend>
        {value.map((item, i) => <Field key={i} path={[...path, i]} value={item} onChange={onChange} disabled={disabled} />)}
      </fieldset>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</legend>
        {Object.entries(value).map(([k, v]) => <Field key={k} path={[...path, k]} value={v} onChange={onChange} disabled={disabled} />)}
      </fieldset>
    );
  }
  return null;
}

function setAt(obj: Json, path: (string | number)[], v: Json): Json {
  if (path.length === 0) return v;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) return obj.map((x, i) => (i === head ? setAt(x, rest, v) : x));
  const o = { ...(obj as { [k: string]: Json }) };
  o[head as string] = setAt(o[head as string], rest, v);
  return o;
}

export function ArtifactView({ artifact, versions, subjects, canApprove, canEdit }: { artifact: Artifact; versions: { version: number; body: Json; edited_at: string }[]; subjects: { id: string; name: string }[]; canApprove: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState<Json>(artifact.body);
  const [title, setTitle] = useState(artifact.title);
  const [compare, setCompare] = useState<number>(versions[0]?.version ?? 1);
  const [shareRole, setShareRole] = useState('teacher');
  const [shareSubject, setShareSubject] = useState<string>('');
  const generated = useMemo(() => toProse(artifact.generated_version ?? versions.find((v) => v.version === compare)?.body ?? artifact.body), [artifact, versions, compare]);
  const current = useMemo(() => toProse(body), [body]);
  const outcome = artifact.artifact_outcomes[0]?.learning_outcomes;
  const approved = artifact.status === 'approved' || artifact.status === 'shared';

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusPill status={artifact.status} />
        {artifact.artifact_outcomes.map((ao) => ao.learning_outcomes && <OutcomeChip key={ao.learning_outcomes.ref_code} size="sm" outcome={{ frameworkCode: ao.learning_outcomes.frameworks?.code ?? '', refCode: ao.learning_outcomes.ref_code, statement: ao.learning_outcomes.statement }} />)}
        {artifact.students && <span>for {artifact.students.full_name}</span>}
        {artifact.approvals?.[0] && <span>edit distance {artifact.approvals[0].edit_distance}</span>}
        {artifact.artifact_shares.map((s) => <span key={s.shared_with_role} className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">shared with {s.shared_with_role}s</span>)}
      </div>

      <ApprovalCard
        title={title}
        outcome={{ frameworkCode: outcome?.frameworks?.code ?? artifact.frameworks?.code ?? '', refCode: outcome?.ref_code ?? '', statement: outcome?.statement ?? '' }}
        generatedText={generated}
        finalText={current}
        approved={approved}
        meta={`${versions.length} version${versions.length === 1 ? '' : 's'} · ${artifact.language === 'hi' ? 'हिन्दी' : 'English'}`}
        onApprove={canApprove && !approved ? () => new Promise<void>((resolve) => { run(() => approveArtifactAction(artifact.id), 'Approved'); resolve(); }) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="card-surface flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">{canEdit ? 'Edit the draft' : 'Content'}</h3>
            {canEdit && (
              <Button size="sm" disabled={pending} onClick={() => run(() => saveArtifact(artifact.id, body, title), 'Saved as a new version')}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save version
              </Button>
            )}
          </div>
          <Input value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} className="font-medium" aria-label="Title" />
          {body && typeof body === 'object' && !Array.isArray(body) && Object.entries(body).map(([k, v]) => <Field key={k} path={[k]} value={v} onChange={(p, val) => setBody((b) => setAt(b, p, val))} disabled={!canEdit} />)}
        </section>

        <aside className="flex flex-col gap-3">
          <div className="card-surface flex flex-col gap-2 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Compare against</p>
            <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={compare} onChange={(e) => setCompare(Number(e.target.value))}>
              {versions.map((v) => <option key={v.version} value={v.version}>v{v.version} · {new Date(v.edited_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">The card above shows the generated version beside your current text with changed spans highlighted.</p>
          </div>
          <div className="card-surface flex flex-col gap-2 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Export</p>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(async () => { const p = artifact.file_path ?? (await renderArtifactPdf(artifact.id)); const url = await signedUrl('artifacts', p); window.open(url, '_blank', 'noopener'); })}>
              <FileDown className="size-4" /> {artifact.file_path ? 'Open PDF' : 'Render PDF (A4)'}
            </Button>
          </div>
          {approved && (
            <div className="card-surface flex flex-col gap-2 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Share with department</p>
              <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                {['teacher', 'hod', 'academic_head'].map((r) => <option key={r} value={r}>{r.replace('_', ' ')}s</option>)}
              </select>
              <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={shareSubject} onChange={(e) => setShareSubject(e.target.value)}>
                <option value="">Any subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button size="sm" disabled={pending} onClick={() => run(() => shareArtifact(artifact.id, shareRole, shareSubject || null), 'Shared')}>
                <Share2 className="size-4" /> Share
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
