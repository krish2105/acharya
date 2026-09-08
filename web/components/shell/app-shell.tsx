'use client';

import { Suspense, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandPaletteProvider } from './command-palette';
import { Header } from './header';
import { Sidebar, useSidebarCollapsed } from './sidebar';
import { Tour } from './tour';
import { UserProvider, type FrameworkOption, type ShellUser } from './user-context';

export function AppShell({
  user,
  frameworks,
  children,
}: {
  user: ShellUser;
  frameworks: FrameworkOption[];
  children: React.ReactNode;
}) {
  const { collapsed, toggle } = useSidebarCollapsed();
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => null);
  }, []);

  return (
    <UserProvider user={user} frameworks={frameworks}>
      <TooltipProvider>
        <CommandPaletteProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <div className="flex min-h-svh">
            <Sidebar collapsed={collapsed} onToggle={toggle} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
                <div className="mx-auto w-full max-w-7xl">{children}</div>
              </main>
            </div>
          </div>
          <Suspense fallback={null}>
            <Tour />
          </Suspense>
        </CommandPaletteProvider>
      </TooltipProvider>
    </UserProvider>
  );
}
