import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const PASSWORD = 'Demo@2026';

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // '/' redirects by role; wait for the landing route so later navigation doesn't race it.
  await page.waitForURL(/\/(dashboard|parent|student)/, { timeout: 30_000 });
  await page.waitForLoadState('load');
}

/** WCAG 2.1 AA scan; fails the test on any serious/critical violation. */
export async function expectAccessible(page: Page, label: string) {
  // Entrance motion animates opacity; let it finish so axe samples final colours.
  await page.waitForLoadState('load');
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map((a) => a.finished.catch(() => null))),
    new Promise((r) => setTimeout(r, 2500)),
  ]));
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('[data-tour]').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, `${label}: ${serious.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`).toEqual([]);
}
