'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useTheme } from 'next-themes';
import { useT } from '@/lib/i18n/provider';
import { createClient } from '@/lib/supabase/client';
import { MODULE_NAV, PRIMARY_NAV, SECONDARY_NAV } from '@/lib/navigation';
import { can } from '@/lib/rbac';
import { NavIcon } from './icons';
import { useShellUser } from './user-context';

export interface CommandEntry {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

interface Registry {
  register: (items: CommandEntry[]) => () => void;
  open: () => void;
}

const RegistryContext = createContext<Registry | null>(null);

export function useCommandPalette() {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return ctx;
}

/** Pages call this to contribute contextual commands while mounted. */
export function useRegisterCommands(items: CommandEntry[]) {
  const { register } = useCommandPalette();
  const key = items.map((i) => i.id).join('|');
  useEffect(() => register(items), [register, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<CommandEntry[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale } = useT();
  const { user } = useShellUser();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const register = useCallback((items: CommandEntry[]) => {
    setExtra((prev) => [...prev, ...items]);
    return () => setExtra((prev) => prev.filter((p) => !items.some((i) => i.id === p.id)));
  }, []);

  const navItems = useMemo(
    () =>
      [...PRIMARY_NAV, ...MODULE_NAV, ...SECONDARY_NAV].filter(
        (n) => (!n.module || can(user, 'view', n.module)) && (!n.roles || n.roles.includes(user.role)),
      ),
    [user],
  );

  const globalActions = useMemo<CommandEntry[]>(() => {
    const staff = !['parent', 'student'].includes(user.role);
    return [
      ...(staff ? [
        { id: 'g-approvals', label: 'Go to approval queue', group: t('cmd.actions'), shortcut: 'A', keywords: ['approve', 'queue'], onSelect: () => router.push('/approvals') },
        { id: 'g-worksheet', label: 'New worksheet', group: t('cmd.actions'), keywords: ['saarthi', 'generate'], onSelect: () => router.push('/saarthi/generate?kind=worksheet') },
        { id: 'g-lesson', label: 'New lesson plan', group: t('cmd.actions'), keywords: ['saarthi', 'generate'], onSelect: () => router.push('/saarthi/generate?kind=lesson_plan') },
        { id: 'g-observe', label: 'Add an observation', group: t('cmd.actions'), keywords: ['darpan'], onSelect: () => router.push('/darpan/observations') },
        { id: 'g-items', label: 'Generate items', group: t('cmd.actions'), keywords: ['prashna'], onSelect: () => router.push('/prashna/generate') },
        { id: 'g-tour', label: 'Start the guided tour', group: t('cmd.actions'), keywords: ['demo', 'help'], onSelect: () => router.push('/dashboard?tour=1') },
      ] : []),
      { id: 'g-lang', label: locale === 'en' ? 'हिन्दी में बदलें' : 'Switch to English', group: t('cmd.actions'), keywords: ['language', 'hindi', 'भाषा'], onSelect: () => setLocale(locale === 'en' ? 'hi' : 'en') },
      { id: 'g-theme', label: theme === 'dark' ? 'Light mode' : 'Dark mode', group: t('cmd.actions'), keywords: ['theme'], onSelect: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'g-security', label: 'Security & devices', group: t('cmd.actions'), keywords: ['mfa', 'sessions'], onSelect: () => router.push('/security') },
      { id: 'g-signout', label: t('shell.signout'), group: t('cmd.actions'), onSelect: async () => { await createClient().auth.signOut(); router.push('/login'); router.refresh(); } },
    ];
  }, [user.role, locale, theme, t, router, setLocale, setTheme]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandEntry[]>();
    for (const item of [...extra, ...globalActions]) {
      groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    }
    return groups;
  }, [extra, globalActions]);

  const value = useMemo<Registry>(() => ({ register, open: () => setOpen(true) }), [register]);

  return (
    <RegistryContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title={t('shell.search')} description={t('cmd.placeholder')}>
        {/* cmdk sub-components need the Command root for their store; the dialog wrapper does not supply one. */}
        <Command loop>
        <CommandInput placeholder={t('cmd.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('cmd.noresults')}</CommandEmpty>
          {[...grouped.entries()].map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandGroup heading={t('cmd.navigate')}>
            {navItems.map((n) => (
              <CommandItem key={n.href} value={`${t(n.labelKey)} ${n.subKey ? t(n.subKey) : ''} ${n.href}`} onSelect={() => router.push(n.href)}>
                <NavIcon name={n.icon} className="size-4 text-muted-foreground" />
                <span>{t(n.labelKey)}</span>
                {n.subKey && <span className="ml-2 text-xs text-muted-foreground">{t(n.subKey)}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </RegistryContext.Provider>
  );
}
