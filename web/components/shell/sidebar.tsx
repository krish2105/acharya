'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/provider';
import { MODULE_NAV, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/lib/navigation';
import { can } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { NavIcon } from './icons';
import { useShellUser } from './user-context';

const STORAGE_KEY = 'acharya.sidebar.collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? '0' : '1');
      } catch {}
      return !c;
    });
  };
  return { collapsed, toggle };
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active ? 'text-primary' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-primary-soft"
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      <NavIcon name={item.icon} className={cn('relative size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      {!collapsed && (
        <span className="relative flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{t(item.labelKey)}</span>
          {item.subKey && <span className="truncate text-[11px] text-muted-foreground">{t(item.subKey)}</span>}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user } = useShellUser();
  const visible = (items: NavItem[]) =>
    items.filter((n) => (!n.module || can(user, 'view', n.module)) && (!n.roles || n.roles.includes(user.role)));
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const Section = ({ items, label }: { items: NavItem[]; label?: string }) =>
    items.length ? (
      <div className="flex flex-col gap-0.5">
        {label && !collapsed && <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>}
        {items.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ))}
      </div>
    ) : null;

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-2 p-3">
      <Section items={visible(PRIMARY_NAV)} />
      <Section items={visible(MODULE_NAV)} label="Modules" />
      <Section items={visible(SECONDARY_NAV)} label="Workspace" />
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useT();
  const { user } = useShellUser();

  return (
    <motion.aside
      aria-label="Sidebar"
      className="sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      animate={{ width: collapsed ? 72 : 264 }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
    >
      <div className={cn('flex h-16 items-center gap-3 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="ACHARYA home">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
            <span className="font-display text-[15px] font-semibold leading-none">A</span>
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-lg font-medium tracking-tight">{t('app.name')}</span>
              <span className="truncate text-[11px] text-muted-foreground">{user.schoolName}</span>
            </span>
          )}
        </Link>
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && <span>{t('shell.collapse')}</span>}
        </button>
      </div>
    </motion.aside>
  );
}
