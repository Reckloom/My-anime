import { test, expect } from '@playwright/test';

test.describe('FRAME core smoke flow', () => {
  test('loads the app and exposes the main navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    for (const label of ['Home', 'Library', 'Discover', 'Web', 'Radar', 'AI', 'Friends', 'Chat', 'Calls', 'Settings']) {
      await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
    }
  });

  test('opens manual entry, adds a title, and shows it in the library', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await expect(page.getByText('Find media')).toBeVisible();
    await page.getByRole('button', { name: /manual/i }).click();
    await expect(page.getByText('Add anything to FRAME.')).toBeVisible();

    await page.getByLabel('Title').fill('FRAME QA Test Title');
    await page.getByRole('button', { name: 'Add to my library' }).click();

    await expect(page.getByRole('heading', { name: 'FRAME QA Test Title', exact: true })).toBeVisible();
  });

  test('opens Settings and switches appearance controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Nothing Dot-matrix industrial/ }).click();
    await expect(page.getByText('Nothing is active.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('combobox').last().selectOption('compact');
  });

  test('opens every primary page without crashing', async ({ page }) => {
    await page.goto('/');
    const targets: Array<[string, RegExp]> = [
      ['Library', /^Library$/],
      ['Discover', /Explore everything\./],
      ['Web', /Google Search/],
      ['Radar', /Release Radar/],
      ['AI', /AI Search/],
      ['Friends', /^Friends$/],
      ['Chat', /Global Chat/],
      ['Calls', /^Calls$/],
      ['Settings', /^Settings$/],
    ];

    for (const [button, heading] of targets) {
      await page.getByRole('button', { name: button, exact: true }).first().click();
      await expect(page.getByRole('heading').filter({ hasText: heading })).toBeVisible();
    }
  });
});
