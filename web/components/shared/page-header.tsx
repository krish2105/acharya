import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tabs,
  current,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: { href: string; label: string }[];
  current?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</p>}
          <h2 className="font-display text-display-md font-medium tracking-tight">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && (
        <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Section">
          {tabs.map((t) => {
            const active = current === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                  active ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function StatTile({ label, value, hint, tone = 'neutral' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'neutral' | 'pending' | 'approved' | 'rejected' }) {
  const toneClass = { neutral: '', pending: 'text-pending-foreground', approved: 'text-approved-foreground', rejected: 'text-rejected-foreground' }[tone];
  return (
    <div className="card-surface flex flex-col gap-1 p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-display text-3xl font-medium tracking-tight tabular', toneClass)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-pending text-pending-foreground',
  pending: 'bg-pending text-pending-foreground',
  approved: 'bg-approved text-approved-foreground',
  shared: 'bg-approved text-approved-foreground',
  printed: 'bg-approved text-approved-foreground',
  released: 'bg-approved text-approved-foreground',
  rejected: 'bg-rejected text-rejected-foreground',
  retired: 'bg-rejected text-rejected-foreground',
  human_confirmed: 'bg-approved text-approved-foreground',
  embedding_suggested: 'bg-pending text-pending-foreground',
  llm_suggested: 'bg-pending text-pending-foreground',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_TONE[status] ?? 'bg-muted text-muted-foreground')}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
