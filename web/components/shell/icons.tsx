import {
  Activity,
  CalendarDays,
  CheckSquare,
  FileLock2,
  FileQuestion,
  Home,
  Network,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  ScanFace,
  type LucideProps,
} from 'lucide-react';
import type { NavItem } from '@/lib/navigation';

const MAP: Record<NavItem['icon'], React.ComponentType<LucideProps>> = {
  home: Home,
  sun: Sun,
  network: Network,
  'file-question': FileQuestion,
  sparkles: Sparkles,
  mirror: ScanFace,
  sunrise: Sunrise,
  'check-square': CheckSquare,
  calendar: CalendarDays,
  scroll: ScrollText,
  shield: ShieldCheck,
  'file-lock': FileLock2,
  settings: Settings,
  activity: Activity,
};

export function NavIcon({ name, ...props }: { name: NavItem['icon'] } & LucideProps) {
  const Icon = MAP[name];
  return <Icon strokeWidth={1.75} {...props} />;
}
