'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Languages, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/provider';
import { titleKeyForPath } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCommandPalette } from './command-palette';
import { SidebarNav } from './sidebar';
import { useShellUser } from './user-context';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Header() {
  const { t, locale, setLocale } = useT();
  const { user, frameworks } = useShellUser();
  const { open } = useCommandPalette();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [framework, setFramework] = useState(frameworks[0]?.id ?? '');

  const titleKey = titleKeyForPath(pathname);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="glass sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
        <Menu className="size-5" />
      </Button>

      <h1 className="min-w-0 truncate font-display text-lg font-medium tracking-tight">{titleKey ? t(titleKey) : t('app.name')}</h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={open}
          className="hidden h-9 w-64 items-center gap-2 rounded-lg border bg-background/60 px-3 text-sm text-muted-foreground hover:bg-background md:flex"
          aria-label={t('shell.search')}
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">{t('shell.search')}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={open} aria-label={t('shell.search')}>
          <Search className="size-5" />
        </Button>

        {frameworks.length > 1 && (
          <label className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
            <span>{t('shell.framework')}</span>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="h-9 rounded-lg border bg-background/60 px-2 text-sm text-foreground"
            >
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={t('shell.language')}
          onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
          title={locale === 'en' ? 'हिन्दी' : 'English'}
        >
          <Languages className="size-5" />
        </Button>

        <Button variant="ghost" size="icon" aria-label={t('shell.theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className="size-5 dark:hidden" />
          <Moon className="hidden size-5 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className="flex items-center gap-2 rounded-full pl-1 pr-2 hover:bg-background/60" aria-label="Account menu" />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-navy text-[11px] font-medium text-navy-foreground">{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <Badge variant="secondary" className="hidden capitalize sm:inline-flex">
              {user.role.replace('_', ' ')}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="font-medium">{user.fullName}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.schoolName}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} variant="destructive">
              <LogOut className="size-4" />
              {t('shell.signout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b px-4 font-display text-lg">{t('app.name')}</div>
          <SidebarNav collapsed={false} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
