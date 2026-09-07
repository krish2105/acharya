import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { can, type AuthedUser, type ModuleCode } from '@/lib/rbac';
import { FrameworkSwitcher, type FrameworkOption } from './framework-switcher';
import { SignOutButton } from './sign-out-button';

const MODULES: { code: ModuleCode; label: string; href: string }[] = [
  { code: 'setu', label: 'SETU', href: '/setu' },
  { code: 'prashna', label: 'PRASHNA', href: '/prashna' },
  { code: 'saarthi', label: 'SAARTHI', href: '/saarthi' },
  { code: 'darpan', label: 'DARPAN', href: '/darpan' },
  { code: 'uday', label: 'UDAY', href: '/uday' },
];

export interface SidebarProps {
  user: AuthedUser & { fullName: string; schoolName: string };
  frameworks: FrameworkOption[];
}

export function Sidebar({ user, frameworks }: SidebarProps) {
  const visibleModules = MODULES.filter((m) => can(user, 'view', m.code));

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-4">
        <p className="font-semibold">ACHARYA</p>
        <p className="text-xs text-muted-foreground">{user.schoolName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
          Dashboard
        </Link>
        {visibleModules.map((m) => (
          <Link key={m.code} href={m.href} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            {m.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t p-4">
        <FrameworkSwitcher frameworks={frameworks} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user.fullName}</p>
            <Badge variant="secondary" className="mt-1">
              {user.role}
            </Badge>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
