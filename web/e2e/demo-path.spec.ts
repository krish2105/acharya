import { expect, test } from '@playwright/test';
import { expectAccessible, login } from './helpers';

test.describe('demo path — teacher', () => {
  test.beforeEach(async ({ page }) => login(page, 'teacher@kalanjali.demo'));

  test('dashboard, My Day and the approval queue', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/good (morning|afternoon|evening)/i);
    await expect(page.getByText(/PII spans redacted/)).toBeVisible();
    await expectAccessible(page, 'dashboard');

    await page.goto('/my-day');
    await expect(page.getByRole('heading', { level: 2, name: /my day|आज का दिन/i })).toBeVisible();
    await expect(page.getByText(/Periods today|आज के पीरियड/)).toBeVisible();
    await expectAccessible(page, 'my-day');

    await page.goto('/approvals');
    await expect(page.getByRole('heading', { level: 2, name: /approval queue/i })).toBeVisible();
    await expectAccessible(page, 'approvals');
  });

  test('SETU coverage, PRASHNA bank, SAARTHI history, DARPAN, UDAY render with data', async ({ page }) => {
    for (const [path, text] of [
      ['/setu/coverage', /coverage/i],
      ['/prashna/bank', /bank/i],
      ['/saarthi/history', /history|artifacts/i],
      ['/darpan/observations', /observation/i],
      ['/uday', /hours|UDAY/i],
      ['/exams', /exam calendar/i],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('main')).toContainText(text);
    }
  });

  test('⌘K palette navigates and offers actions', async ({ page }) => {
    await page.waitForLoadState('load');
    // Open via the header control first (proves the palette itself), then via the shortcut.
    await page.getByRole('button', { name: /search or jump|खोजें/i }).first().click();
    const input = page.getByPlaceholder(/type a command|कमांड/i);
    await expect(input).toBeVisible();
    await expect(page.getByText(/Go to approval queue/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+K');
    await expect(input).toBeVisible();
    await input.fill('approval queue');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/approvals/);
  });

  test('Hindi toggle switches the shell', async ({ page }) => {
    await page.getByRole('button', { name: /language|भाषा/i }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/डैशबोर्ड/);
    await page.getByRole('button', { name: /language|भाषा/i }).click();
  });
});

test.describe('demo path — leadership & security', () => {
  test('principal sees leadership, consent, audit chain verified, security', async ({ page }) => {
    await login(page, 'principal@kalanjali.demo');
    await page.goto('/leadership');
    await expect(page.getByText(/AI drafts generated/)).toBeVisible();
    await expectAccessible(page, 'leadership');
    await page.goto('/consent');
    await expect(page.getByText(/Consent ledger/)).toBeVisible();
    await page.goto('/audit');
    await expect(page.getByText(/Chain verified/)).toBeVisible();
    await page.goto('/security');
    await expect(page.getByRole('heading', { name: /Two-factor authentication/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Signed-in devices/ })).toBeVisible();
  });

  test('security headers are present', async ({ page }) => {
    const res = await page.goto('/login');
    const h = res!.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('portal', () => {
  test('parent portal shows released reports and DPDP rights', async ({ page }) => {
    await login(page, 'parent@kalanjali.demo');
    await expect(page).toHaveURL(/\/parent/);
    await expect(page.getByText(/Parent portal/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Download all data held/ })).toBeVisible();
    await expectAccessible(page, 'parent portal');
  });

  test('student portal offers self and peer input', async ({ page }) => {
    await login(page, 'student@kalanjali.demo');
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText(/self-assessment/i)).toBeVisible();
    await expect(page.getByText(/kind and true/i)).toBeVisible();
  });

  test('cross-tenant isolation: teacher never sees another tenant', async ({ page }) => {
    await login(page, 'teacher@rivermist-test.demo');
    await page.goto('/darpan/observations');
    await expect(page.locator('main')).not.toContainText(/Kalanjali/);
  });
});
