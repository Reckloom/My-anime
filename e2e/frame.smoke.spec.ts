async function navigatePrimary(page:any,label:string){const primary=page.locator('.frame-nav').getByRole('button',{name:label,exact:true});if(await primary.isVisible().catch(()=>false)){await primary.click();return}await page.getByRole('button',{name:/Open navigation menu/}).click();await page.locator('.frame-mobile-menu').getByRole('button',{name:label,exact:true}).click();}

import { test, expect } from '@playwright/test';

test.describe('FRAME core smoke flow', () => {
  test('loads the app and exposes the main navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    for (const label of ['Home', 'Library', 'Discover']) {
      const primary=page.locator('.frame-nav').getByRole('button',{name:label,exact:true});
      if(await primary.isVisible().catch(()=>false))continue;
      const mobile=page.locator('.mobile-bottom').getByRole('button',{name:label,exact:true});
      if(await mobile.isVisible().catch(()=>false))continue;
      const menu=page.getByRole('button',{name:/Open navigation menu/});
      await expect(menu).toBeVisible();
      if(!(await page.locator('.frame-mobile-menu').getByRole('button',{name:label,exact:true}).isVisible().catch(()=>false)))await menu.click();
      await expect(page.locator('.frame-mobile-menu').getByRole('button',{name:label,exact:true})).toBeVisible();
    }
  });

  test('opens manual entry, adds a title, and shows it in the library', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Find anything for FRAME' })).toBeVisible();
    await page.getByRole('button', { name: /can't find it\? add manually/i }).click();
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
    await navigatePrimary(page,'Library');
    await expect(page.getByText('FRAME Guest Persistence Test', { exact: true })).toBeVisible();
  });

  test('persists guest appearance changes and exposes sign-in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('frame-guest', '1'));
    await page.reload();

    await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await page.getByRole('button', { name: /6 · Modern Media Hub/ }).click();

    await page.reload();
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await expect(page.getByText('6 · Modern Media Hub is active.', { exact: true })).toBeVisible();
  });

  test('makes Discover shortcuts useful', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Find media' }).click();
    await expect(page.getByText('Find anything for FRAME')).toBeVisible();
    await page.keyboard.press('Escape');
    await navigatePrimary(page,'Discover');
    await expect(page.getByRole('heading', { name: 'Explore everything.', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Connections Control the catalogues and services FRAME uses/ }).click();
    await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
  });


  test('logo returns Home and account bubble opens Settings', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Go to FRAME home', exact: true }).click();
    await expect(page.locator('h1').filter({ hasText: /Welcome back/ })).toBeVisible();
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await expect(page.locator('h1').filter({ hasText: /^Settings$/ })).toBeVisible();
  });

  test('opens Settings and switches appearance controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /6 · Modern Media Hub/ }).click();
    await expect(page.getByText('6 · Modern Media Hub is active.', { exact: true })).toBeVisible();

    await page.getByRole('combobox').last().selectOption('compact');
  });

  test('opens every primary page without crashing', async ({ page }) => {
    await page.goto('/');
    const targets: Array<[string, RegExp]> = [
      ['Library', /^Library$/],
      ['Discover', /Explore everything\./],
    ];

    for (const [button, heading] of targets) {
      await navigatePrimary(page,button);
      await expect(page.locator('h1').filter({ hasText: heading })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await expect(page.locator('h1').filter({ hasText: /^Settings$/ })).toBeVisible();
  });
});


test.describe('FRAME movie discovery UI', () => {
  test('movie results resolve artwork in the actual modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await page.getByRole('tab', { name: /Movies/ }).click();
    await page.getByLabel('Search media').fill('Inception');
    const result=page.getByRole('button', { name: /Inception/ }).first();
    await expect(result).toBeVisible();
    const src=await result.locator('img').getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toContain('/frame-logo.svg');
  });
});

test.describe('FRAME global voice', () => {
  test('opens the public global call and exposes the simple controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Global Call', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Global Call', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join global call', exact: true })).toBeVisible();
    await expect(page.getByText(/Public global calls are separate from private one-to-one calls/)).toBeVisible();
  });
});

test.describe('FRAME private voice rooms', () => {
  test('exposes create and join-by-code controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Global Call', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Private Rooms', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Private Rooms', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeVisible();
    await expect(page.getByLabel('Private room code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeVisible();
    await expect(page.getByText(/Among Us room code/)).toBeVisible();
  });
});

test.describe('FRAME discovery integration', () => {
  test('movie and game discovery return real image-backed results', async ({ request }) => {
    const base = 'https://blwnhfhpckqbetwxamqr.supabase.co/functions/v1/media-discovery';
    const movie = await request.post(base, { data: { action: 'search', provider: 'movie', query: 'Inception' } });
    expect(movie.ok()).toBeTruthy();
    const movieJson = await movie.json();
    expect(movieJson.results?.length).toBeGreaterThan(0);
    expect(movieJson.results.some((x:any)=>x.title==='Inception')).toBeTruthy();

    const game = await request.post(base, { data: { action: 'search', provider: 'game', query: 'Portal' } });
    expect(game.ok()).toBeTruthy();
    const gameJson = await game.json();
    expect(gameJson.results?.length).toBeGreaterThan(0);
    expect(gameJson.results[0].poster).toMatch(/^https?:\/\//);
  });
});

test.describe('FRAME quick actions', () => {
  test('keeps Chat and Call in the floating action hub, not primary nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.frame-nav').getByRole('button', { name: 'Chat', exact: true })).toHaveCount(0);
    await expect(page.locator('.frame-nav').getByRole('button', { name: 'Call', exact: true })).toHaveCount(0);
    const signIn=page.getByRole('button',{name:'Sign in',exact:true}).first();
    if(await signIn.isVisible().catch(()=>false)){
      await expect(page.locator('.frame-nav').getByRole('button',{name:'Chat',exact:true})).toHaveCount(0);
      await expect(page.locator('.frame-nav').getByRole('button',{name:'Call',exact:true})).toHaveCount(0);
      return;
    }
    await page.getByTitle('Open quick actions').click();
    await expect(page.getByTitle('Chat')).toBeVisible();
    await expect(page.getByTitle('Call')).toBeVisible();
  });
});
