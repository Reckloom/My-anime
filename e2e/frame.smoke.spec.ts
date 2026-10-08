import { test, expect } from '@playwright/test';

test.describe('FRAME core smoke flow', () => {
  test('loads the app and exposes the main navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    for (const label of ['Home', 'Library', 'Discover', 'Web', 'Radar', 'Friends', 'Chat', 'Calls', 'Settings']) {
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

  test('persists guest library changes across reloads', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('frame-guest', '1'));
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await page.getByRole('button', { name: /manual/i }).click();
    await page.getByLabel('Title').fill('FRAME Guest Persistence Test');
    await page.getByRole('button', { name: 'Add to my library' }).click();
    await expect(page.getByRole('heading', { name: 'FRAME Guest Persistence Test', exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Library', exact: true }).first().click();
    await expect(page.getByText('FRAME Guest Persistence Test', { exact: true })).toBeVisible();
  });

  test('persists guest appearance changes and exposes sign-in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('frame-guest', '1'));
    await page.reload();

    await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.getByRole('button', { name: /Nothing Dot-matrix industrial/ }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();

    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(page.getByText('Nothing is active.', { exact: true })).toBeVisible();
  });

  test('makes Discover shortcuts useful', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Discover', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Where to find it', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Web Search', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Discover', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Connections', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
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
      ['Web', /Web Search/],
      ['Radar', /Release Radar/],
      ['Friends', /^Friends$/],
      ['Chat', /Global Chat/],
      ['Calls', /^Calls$/],
      ['Settings', /^Settings$/],
    ];

    for (const [button, heading] of targets) {
      await page.getByRole('button', { name: button, exact: true }).first().click();
      if (button === 'Calls') {
        await expect(page.getByText(/Calls need your FRAME account|^Calls$/, { exact: false }).first()).toBeVisible();
      } else {
        await expect(page.locator('h1').filter({ hasText: heading })).toBeVisible();
      }
    }
  });
});
