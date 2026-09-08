import Link from 'next/link';
import { PageHeader, StatusPill } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { SectionPicker } from '../section-picker';
import { CURRENT_TERM, DARPAN_TABS, DOMAIN_LABEL, DOMAINS } from '../nav';

export default async function DescriptorsPage({ searchParams }: { searchParams: Promise<{ section?: string; term?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = await mySections(supabase, user);
  const current = sections.find((s) => s.id === sp.section) ?? sections[0];
  const term = sp.term ?? CURRENT_TERM;
  if (!current) return <div><PageHeader eyebrow="DARPAN" title="Descriptors" tabs={DARPAN_TABS} current="/darpan/descriptors" /></div>;
  const { data: students } = await supabase.from('students').select('id, full_name').eq('section_id', current.id).order('full_name');
  const ids = (students ?? []).map((s) => s.id);
  const { data: descs } = ids.length ? await supabase.from('hpc_descriptors').select('student_id, domain, status').in('student_id', ids).eq('term', term) : { data: [] };
  const grid = new Map<string, string>();
  for (const d of descs ?? []) grid.set(`${d.student_id}:${d.domain}`, d.status);

  return (
    <div>
      <PageHeader eyebrow="DARPAN" title="Descriptors" description="One narrative per domain per child, drafted from redacted evidence and approved by you. Click a child to draft, edit and approve." tabs={DARPAN_TABS} current="/darpan/descriptors" actions={<SectionPicker sections={sections} current={current.id} term={term} />} />
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Child</th>{DOMAINS.map((d) => <th key={d} className="px-4 py-2 font-medium">{DOMAIN_LABEL[d].en}</th>)}</tr></thead>
          <tbody>
            {(students ?? []).map((st) => (
              <tr key={st.id} className="border-t">
                <td className="px-4 py-2"><Link href={`/darpan/descriptors/${st.id}?term=${encodeURIComponent(term)}`} className="font-medium hover:text-primary">{st.full_name}</Link></td>
                {DOMAINS.map((d) => { const s = grid.get(`${st.id}:${d}`); return <td key={d} className="px-4 py-2">{s ? <StatusPill status={s} /> : <span className="text-xs text-muted-foreground">not drafted</span>}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
