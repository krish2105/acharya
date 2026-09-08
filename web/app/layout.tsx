import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist_Mono, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/lib/i18n/provider';
import { isLocale, type Locale } from '@/lib/i18n/dictionaries';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ACHARYA', template: '%s · ACHARYA' },
  description: 'Aligned drafts, never decisions. The AI teaching layer for multi-board schools.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('locale')?.value;
  const locale: Locale = isLocale(raw) ? raw : 'en';

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} ${geistMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <I18nProvider locale={locale}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
