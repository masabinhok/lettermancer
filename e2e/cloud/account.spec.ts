/**
 * Sign-in, sync and ranked practice against a local Supabase. Run with: npm run test:e2e:cloud
 * Needs `npx supabase start` and `npx supabase functions serve`, and the app built with apps/web/.env.local.
 */
import { expect, test } from '@playwright/test';

const MAILPIT = 'http://127.0.0.1:54324';

async function magicLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const link = (msg.Text as string).match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link.replace(/[)\]>]+$/, '');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('no sign-in email arrived');
}

test('sign in with a magic link, choose a name, and sync progress', async ({ page }) => {
  const email = `e2e${Date.now()}@keycraft.test`;
  await page.goto('/');
  // Guest progress that should follow the player into their account.
  await page.evaluate(() => {
    const meta = JSON.parse(localStorage.getItem('keycraft.meta.v1') ?? '{}');
    localStorage.setItem('keycraft.meta.v1', JSON.stringify({ ...meta, prologueDone: true, ink: 42 }));
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Email me a sign-in link/ }).click();
  await expect(page.getByText(/Check/)).toBeVisible();

  await page.goto(await magicLink(email));
  await expect(page.locator('[data-screen="profile"]')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const name = `scribe_${Date.now() % 100000}`;
  await page.getByLabel('Name on the leaderboards').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByText(/Synced/)).toBeVisible();

  // A ranked 15-second practice test.
  await page.goto('/practice');
  await page.getByRole('button', { name: '15s' }).click();
  for (let i = 0; i < 3000 && !(await page.locator('.result').count()); i++) {
    const k = await page.locator('.text .caret').textContent();
    if (k) await page.keyboard.press(k);
    await page.waitForTimeout(90);
  }
  await expect(page.getByText(/Verified and ranked/)).toBeVisible({ timeout: 15_000 });
});
