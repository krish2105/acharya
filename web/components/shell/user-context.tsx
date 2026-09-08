'use client';

import { createContext, useContext } from 'react';
import type { AuthedUser } from '@/lib/rbac';

export interface ShellUser extends AuthedUser {
  fullName: string;
  schoolName: string;
  email: string;
}

export interface FrameworkOption {
  id: string;
  code: string;
  name: string;
}

const UserContext = createContext<{ user: ShellUser; frameworks: FrameworkOption[] } | null>(null);

export function UserProvider({
  user,
  frameworks,
  children,
}: {
  user: ShellUser;
  frameworks: FrameworkOption[];
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={{ user, frameworks }}>{children}</UserContext.Provider>;
}

export function useShellUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useShellUser must be used inside UserProvider');
  return ctx;
}
