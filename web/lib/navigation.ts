import type { DictKey } from '@/lib/i18n/dictionaries';
import type { ModuleCode, Role } from '@/lib/rbac';

export interface NavItem {
  href: string;
  labelKey: DictKey;
  subKey?: DictKey;
  icon: 'home' | 'sun' | 'network' | 'file-question' | 'sparkles' | 'mirror' | 'sunrise' | 'check-square' | 'calendar' | 'scroll' | 'shield' | 'file-lock' | 'settings' | 'activity';
  module?: ModuleCode;
  roles?: Role[];
}

const STAFF: Role[] = ['principal', 'academic_head', 'board_coordinator', 'hod', 'teacher', 'ct_ai_lead', 'exam_officer'];
const LEADERS: Role[] = ['principal', 'academic_head'];

// Single source of truth for the sidebar, the command palette and header titles.
export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
  { href: '/my-day', labelKey: 'nav.myday', icon: 'sun', roles: ['teacher', 'hod'] },
];

export const MODULE_NAV: NavItem[] = [
  { href: '/setu', labelKey: 'nav.setu', subKey: 'nav.setu.sub', icon: 'network', module: 'setu' },
  { href: '/prashna', labelKey: 'nav.prashna', subKey: 'nav.prashna.sub', icon: 'file-question', module: 'prashna' },
  { href: '/saarthi', labelKey: 'nav.saarthi', subKey: 'nav.saarthi.sub', icon: 'sparkles', module: 'saarthi' },
  { href: '/darpan', labelKey: 'nav.darpan', subKey: 'nav.darpan.sub', icon: 'mirror', module: 'darpan' },
  { href: '/uday', labelKey: 'nav.uday', subKey: 'nav.uday.sub', icon: 'sunrise', module: 'uday' },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/approvals', labelKey: 'nav.approvals', icon: 'check-square', roles: STAFF },
  { href: '/exams', labelKey: 'nav.exams', icon: 'calendar', roles: ['principal', 'academic_head', 'board_coordinator', 'hod', 'teacher', 'exam_officer'] },
  { href: '/leadership', labelKey: 'nav.leadership', icon: 'activity', roles: LEADERS },
  { href: '/consent', labelKey: 'nav.consent', icon: 'file-lock', roles: LEADERS },
  { href: '/audit', labelKey: 'nav.audit', icon: 'scroll', roles: ['principal', 'academic_head', 'super_admin'] },
  { href: '/security', labelKey: 'nav.security', icon: 'shield', roles: [...STAFF, 'super_admin'] },
  { href: '/admin', labelKey: 'nav.admin', icon: 'settings', roles: ['super_admin'] },
];

export function titleKeyForPath(pathname: string): DictKey | null {
  const all = [...PRIMARY_NAV, ...MODULE_NAV, ...SECONDARY_NAV];
  const match = all
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.labelKey ?? null;
}
