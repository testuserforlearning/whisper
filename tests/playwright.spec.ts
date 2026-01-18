import { test, expect } from '@playwright/test';

test('demo loads and proxies example.com', async ({ page }: { page: any }) => {
  await page.goto('http://localhost:3000/');
  await expect(page.locator('h1')).toHaveText('Whisper Proxy Demo');

  const input = page.locator('#urlInput');
  const btn = page.locator('#goBtn');

  await input.fill('https://example.com');
  await btn.click();

  await page.waitForURL(/\/proxy\?url=/);
  await expect(page).toHaveTitle(/Example Domain|example/i, { timeout: 5000 });
});
