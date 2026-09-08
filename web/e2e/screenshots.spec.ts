import { test } from '@playwright/test';
import { login } from './helpers';

// Screenshot pack (Section 8, Phase 6): 12 desktop 1440x900 + 6 mobile 390x844.
const OUT = '../docs/screenshots';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const shots: { name: string; path: string; user: string | null; viewport: { width: number; height: number } }[] = [
  { name: 'd01-login', path: '/login', user: null, viewport: DESKTOP },
  { name: 'd02-dashboard', path: '/dashboard', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd03-my-day', path: '/my-day', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd04-setu-coverage', path: '/setu/coverage', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd05-prashna-review', path: '/prashna/review', user: 'hod@kalanjali.demo', viewport: DESKTOP },
  { name: 'd06-saarthi-history', path: '/saarthi/history', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd07-darpan-descriptors', path: '/darpan/descriptors', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd08-uday', path: '/uday', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd09-approvals', path: '/approvals', user: 'teacher@kalanjali.demo', viewport: DESKTOP },
  { name: 'd10-exams', path: '/exams', user: 'exam@kalanjali.demo', viewport: DESKTOP },
  { name: 'd11-leadership', path: '/leadership', user: 'principal@kalanjali.demo', viewport: DESKTOP },
  { name: 'd12-audit', path: '/audit', user: 'principal@kalanjali.demo', viewport: DESKTOP },
  { name: 'm01-login', path: '/login', user: null, viewport: MOBILE },
  { name: 'm02-dashboard', path: '/dashboard', user: 'teacher@kalanjali.demo', viewport: MOBILE },
  { name: 'm03-my-day', path: '/my-day', user: 'teacher@kalanjali.demo', viewport: MOBILE },
  { name: 'm04-parent-portal', path: '/parent', user: 'parent@kalanjali.demo', viewport: MOBILE },
  { name: 'm05-student-portal', path: '/student', user: 'student@kalanjali.demo', viewport: MOBILE },
  { name: 'm06-approvals', path: '/approvals', user: 'teacher@kalanjali.demo', viewport: MOBILE },
];

for (const s of shots) {
  test(`screenshot ${s.name}`, async ({ page }) => {
    await page.setViewportSize(s.viewport);
    if (s.user) await login(page, s.user);
    await page.goto(s.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200); // let entrance motion settle
    await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
  });
}
