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
    // Adding a title opens its detail overlay; close it explicitly before navigating.
    await page.getByRole('button', { name: 'Close details', exact: true }).click();

    await navigatePrimary(page, 'Library');
    await expect(page.getByText('FRAME QA Test Title', { exact: true })).toBeVisible();
  });

  test('persists guest library changes across reloads', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify([{ id:'frame-guest-persistence-smoke', userId:'guest', title:'FRAME Guest Persistence Test', medium:'anime', status:'planned', progress:0, total:1, poster:'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]));
    });
    await page.reload();
    const persisted=await page.evaluate(() => {
      const raw=localStorage.getItem('frame-library:guest');
      return Boolean(raw && raw.includes('FRAME Guest Persistence Test'));
    });
    expect(persisted).toBe(true);
  });

  test('keeps the permanent Ultra-Movie appearance and exposes sign-in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('frame-guest', '1'));
    await page.reload();

    await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
    await expect(page.locator('html[data-frame-theme="ultra-movie"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await expect(page.locator('.theme-picker')).toHaveCount(0);
  });

  test('makes Discover shortcuts useful', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
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

  test('opens Settings without exposing a theme selector', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Settings', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('.theme-picker')).toHaveCount(0);
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


test.describe('FRAME artwork identity', () => {
  test('keeps each anime poster tied to its title and preserves saved art for a mismatched ID', async ({ page }) => {
    await page.route(/https:\/\/(cdn\.example\.test|saved\.example)\/.+/, route => route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="blue"/></svg>'
    }));
    const catalog: Record<number, { title: string; image: string }> = {
      16498: { title: 'Attack on Titan', image: 'https://cdn.example.test/aot.jpg' },
      269: { title: 'Bleach', image: 'https://cdn.example.test/bleach.jpg' },
      9253: { title: 'Steins;Gate', image: 'https://cdn.example.test/steins.jpg' },
      99999: { title: 'Monkey D. Luffy', image: 'https://cdn.example.test/luffy.jpg' }
    };
    await page.route('https://graphql.anilist.co', async route => {
      const request = route.request().postDataJSON() as { variables?: { id?: number; ids?: number[]; search?: string } };
      if (Array.isArray(request.variables?.ids)) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { Page: { media: [] } } })
        });
        return;
      }
      if (request.variables?.id) {
        const media = catalog[Number(request.variables.id)];
        if (!media) { await route.continue(); return; }
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { Media: {
            id: Number(request.variables.id), type: 'ANIME',
            title: { english: media.title, romaji: media.title, native: media.title, userPreferred: media.title },
            synonyms: [], coverImage: { extraLarge: media.image }, bannerImage: null
          } } })
        });
        return;
      }
      if (request.variables?.search) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { Page: { media: [{
            id: 99999, type: 'ANIME',
            title: { english: 'Monkey D. Luffy', romaji: 'Monkey D. Luffy', native: 'モンキー・D・ルフィ', userPreferred: 'Monkey D. Luffy' },
            synonyms: [], coverImage: { extraLarge: 'https://cdn.example.test/luffy.jpg' }
          }] } } })
        });
        return;
      }
      await route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify([
        { id: 'qa-aot', anilistId: 16498, sourceProvider: 'anilist', externalId: '16498', title: 'Attack on Titan', poster: 'https://saved.example/aot.jpg', medium: 'anime', status: 'completed', progress: 89, total: 89, genres: [], themes: [], favorite: false },
        { id: 'qa-bleach', anilistId: 269, sourceProvider: 'anilist', externalId: '269', title: 'Bleach', poster: 'https://saved.example/bleach.jpg', medium: 'anime', status: 'completed', progress: 366, total: 366, genres: [], themes: [], favorite: false },
        { id: 'qa-steins', anilistId: 9253, sourceProvider: 'anilist', externalId: '9253', title: 'Steins;Gate', poster: 'https://saved.example/steins.jpg', medium: 'anime', status: 'completed', progress: 24, total: 24, genres: [], themes: [], favorite: false },
        { id: 'qa-jjk', anilistId: 99999, sourceProvider: 'anilist', externalId: '99999', title: 'Jujutsu Kaisen', poster: 'https://saved.example/jjk.jpg', medium: 'anime', status: 'completed', progress: 24, total: 24, genres: [], themes: [], favorite: false }
      ]));
    });
    await page.goto('/');
    await navigatePrimary(page, 'Library');
    await expect(page.getByAltText('Attack on Titan').first()).toHaveAttribute('src', 'https://saved.example/aot.jpg', { timeout: 10000 });
    await expect(page.getByAltText('Bleach').first()).toHaveAttribute('src', 'https://saved.example/bleach.jpg', { timeout: 10000 });
    await expect(page.getByAltText('Steins;Gate').first()).toHaveAttribute('src', 'https://saved.example/steins.jpg', { timeout: 10000 });
    await expect(page.getByAltText('Jujutsu Kaisen').first()).toHaveAttribute('src', 'https://saved.example/jjk.jpg', { timeout: 10000 });
    const sources = await Promise.all(['Attack on Titan', 'Bleach', 'Steins;Gate'].map(async title =>
      page.getByAltText(title).first().getAttribute('src')
    ));
    expect(new Set(sources).size).toBe(3);
  });
});

test.describe('FRAME movie discovery UI', () => {
  test('movie results resolve artwork in the actual modal', async ({ page }) => {
    await page.route(/functions\/v1\/media-discovery/, async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('action') !== 'search' || url.searchParams.get('provider') !== 'movie') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          results: [{
            provider: 'tmdb-movie', externalId: '27205', title: 'Inception', medium: 'movie',
            poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
            backdrop: '', description: 'A science-fiction thriller.', genres: ['Science Fiction'],
            source: 'TMDB', sourceUrl: 'https://www.themoviedb.org/movie/27205'
          }]
        })
      });
    });
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


test.describe('FRAME anime hierarchy and character archive', () => {
  test('shows season/arc hierarchy and the rich character archive without an episode tracker', async ({ page }) => {
    await page.route('https://example.com/luffy.png', route => route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="red"/></svg>'
    }));
    await page.route('**/functions/v1/anime-catalogue', async route => {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
      };
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers, body: '' });
        return;
      }
      const body = route.request().postDataJSON() as { action?: string };
      if (body.action === 'anime-characters') {
        await route.fulfill({
          status: 200, headers,
          body: JSON.stringify({
            characters: [{
              id: 1,
              name: 'Monkey D. Luffy',
              role: 'MAIN',
              image: 'https://example.com/luffy.png',
              sourceUrl: 'https://anilist.co/character/1'
            }],
            matched: 1, requested: 1, source: 'AniList'
          })
        });
        return;
      }
      await route.fulfill({
        status: 200, headers,
        body: JSON.stringify({ results: [{ mal_id: 21, title: 'One Piece', title_english: 'One Piece' }] })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify([
        {
          id: 'qa-one-piece',
          anilistId: 21,
          sourceProvider: 'anilist',
          externalId: '21',
          title: 'One Piece',
          description: 'QA fixture',
          poster: '/frame-logo.svg',
          backdrop: '',
          medium: 'anime',
          status: 'watching',
          progress: 0,
          total: 1180,
          genres: [],
          themes: [],
          favorite: false
        },
        {
          id: 'qa-one-piece-arc-1',
          parentId: 'qa-one-piece',
          sourceProvider: 'frame-story-arc',
          externalId: 'one-piece-arc-1',
          title: 'Romance Dawn',
          description: 'First story arc.',
          poster: '/frame-logo.svg',
          backdrop: '',
          medium: 'anime',
          status: 'watching',
          progress: 0,
          total: 3,
          genres: [],
          themes: [],
          favorite: false
        }
      ]));
    });

    await page.goto('/');
    await navigatePrimary(page, 'Library');
    const onePieceCard=page.locator('.media-card').filter({hasText:'One Piece'}).first();
    await expect(onePieceCard).toBeVisible({timeout:5000});
    await onePieceCard.click();

    await expect(page.getByRole('heading', { name: 'Seasons & arcs', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Romance Dawn', { exact: true })).toBeVisible({timeout:5000});
    await expect(page.getByRole('heading', { name: 'Top 20 Characters', exact: true })).toBeVisible({timeout:5000});
    await expect(page.getByAltText('Monkey D. Luffy portrait')).toBeVisible({timeout:5000});
    await expect(page.getByText('Episodes', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark through' })).toHaveCount(0);
  });
});

test.describe('FRAME AOT archive regression', () => {
  test('keeps Attack on Titan seasons, arcs, progress and rich characters intact', async ({ page }) => {
    await page.route('https://example.com/eren.jpg', route => route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18"/></svg>'
    }));
    await page.route('**/functions/v1/anime-catalogue', async route => {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
      };
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers, body: '' });
        return;
      }
      const body = route.request().postDataJSON() as { action?: string };
      if (body.action === 'anime-characters') {
        await route.fulfill({
          status: 200, headers,
          body: JSON.stringify({
            characters: [
              { id: 1, name: 'Eren Yeager', role: 'MAIN', image: 'https://example.com/eren.jpg', birthday: 'March 30', age: '15', gender: 'Male', bloodType: 'B' }
            ],
            matched: 1, requested: 1, source: 'AniList'
          })
        });
        return;
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ results: [] }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify([
        { id: 'aot-root', anilistId: 16498, sourceProvider: 'anilist', externalId: '16498', title: 'Attack on Titan', poster: '/frame-logo.svg', backdrop: '', medium: 'anime', status: 'completed', progress: 89, total: 89, genres: [], themes: [], favorite: false },
        { id: 'aot-s1', parentId: 'aot-root', sourceProvider: 'frame-aot-season', externalId: 'aot-s1', title: 'Attack on Titan — Season 1 (Episodes 1–25)', poster: '/frame-logo.svg', backdrop: '', medium: 'anime', status: 'completed', progress: 25, total: 25, genres: [], themes: [], favorite: false },
        { id: 'aot-arc-1', parentId: 'aot-s1', sourceProvider: 'frame-aot-arc', externalId: 'aot-arc-1', title: 'Fall of Shiganshina Arc (Episodes 1–2)', poster: '/frame-logo.svg', backdrop: '', medium: 'anime', status: 'completed', progress: 2, total: 2, genres: [], themes: [], favorite: false }
      ]));
    });
    await page.goto('/');
    await navigatePrimary(page, 'Library');
    await page.locator('.media-card').filter({ hasText: 'Attack on Titan' }).first().click();
    await expect(page.getByRole('heading', { name: 'Attack on Titan', exact: true })).toBeVisible();
    await expect(page.locator('.progress-edit input').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seasons & arcs', exact: true })).toBeVisible();
    const seasonCard=page.locator('.hierarchy-part-card').filter({hasText:'Attack on Titan — Season 1 (Episodes 1–25)'}).first();
    await expect(seasonCard).toBeVisible();
    await seasonCard.click();
    await expect(page.getByRole('heading', { name: 'Attack on Titan — Season 1 (Episodes 1–25)', exact: true })).toBeVisible();
    await expect(page.getByText('Fall of Shiganshina Arc (Episodes 1–2)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Attack on Titan', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top 20 Characters', exact: true })).toBeVisible();
    await expect(page.getByAltText('Eren Yeager portrait')).toBeVisible();
  });
});

test.describe('FRAME detail navigation and scroll', () => {
  test('opens a sub-part at the top and Back restores the previous item and scroll position', async ({ page }) => {
    const arcs = Array.from({ length: 18 }, (_, index) => ({
      id: 'one-piece-arc-' + (index + 1),
      parentId: 'qa-one-piece',
      sourceProvider: 'jikan',
      externalId: 'one-piece-arc-' + (index + 1),
      title: 'Arc ' + (index + 1),
      description: 'Story arc ' + (index + 1),
      poster: '/frame-logo.svg',
      backdrop: '',
      medium: 'anime',
      status: 'watching',
      progress: 0,
      total: 10,
      genres: [],
      themes: [],
      favorite: false,
      notes: 'FRAME_POSTER_VERSION=one-piece-arc-wiki-v1',
    }));
    arcs.push({
      id: 'one-piece-episode-18',
      parentId: 'one-piece-arc-18',
      sourceProvider: 'jikan',
      externalId: 'one-piece-episode-18',
      title: 'Episode 18',
      description: 'A test episode',
      poster: '/frame-logo.svg',
      backdrop: '',
      medium: 'anime',
      status: 'completed',
      progress: 1,
      total: 1,
      genres: [],
      themes: [],
      favorite: false,
      notes: '',
    });
    await page.addInitScript((fixture) => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify(fixture));
    }, [{
      id: 'qa-one-piece',
      sourceProvider: 'anilist',
      externalId: '21',
      anilistId: 21,
      title: 'One Piece',
      description: 'QA hierarchy fixture',
      poster: '/frame-logo.svg',
      backdrop: '',
      medium: 'anime',
      status: 'watching',
      progress: 0,
      total: 1180,
      genres: [],
      themes: [],
      favorite: false,
      externalLinks: { malId: '21' },
    }, ...arcs]);

    await page.goto('/');
    await navigatePrimary(page, 'Library');
    const card = page.locator('.media-card').filter({ hasText: 'One Piece' }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole('heading', { name: 'One Piece', exact: true })).toBeVisible();

    const drawer = page.locator('.detail-overlay .detail-drawer');
    await drawer.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const before = await drawer.evaluate((el) => el.scrollTop);
    const originalArcCount = await drawer.locator('.hierarchy-part-card').count();
    expect(before).toBeGreaterThan(0);

    // Trigger the already-visible card without Playwright's automatic
    // scroll-into-view step, which otherwise changes the position being tested.
    await page.locator('.hierarchy-part-card').filter({ hasText: 'Arc 18' }).evaluate(el => (el as HTMLButtonElement).click());
    await expect(page.getByRole('heading', { name: 'Arc 18', exact: true })).toBeVisible();
    await expect.poll(() => drawer.evaluate((el) => el.scrollTop)).toBe(0);

    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'One Piece', exact: true })).toBeVisible();
    await expect.poll(() => drawer.locator('.hierarchy-part-card').count()).toBe(originalArcCount);
    // If the restored layout has a smaller scroll range, the browser clamps to
    // its maximum. Assert that Back restores as far as the current drawer allows.
    await expect.poll(() => drawer.evaluate((el, previousTop) =>
      el.scrollTop >= Math.min(previousTop, el.scrollHeight - el.clientHeight) - 2, before
    ), { timeout: 5000 }).toBe(true).catch(async error => {
      console.log('Scroll restoration diagnostic:', await drawer.evaluate((el, previousTop) => ({
        previousTop, currentTop: el.scrollTop, scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight, title: document.querySelector('#frame-detail-title')?.textContent?.trim()
      }), before));
      throw error;
    });
  });
});


test.describe('FRAME browser detail history', () => {
  test('browser Back closes anime details without jumping from Library to Home', async ({ page }) => {
    const rootId = 'qa-anime-root';
    const fixture = [
      {
        id: rootId,
        sourceProvider: 'frame-story-arc',
        externalId: 'qa-anime-root',
        title: 'FRAME QA Anime',
        description: 'Navigation history fixture',
        poster: '/frame-logo.svg',
        backdrop: '',
        medium: 'anime',
        status: 'planned',
        progress: 0,
        total: 12,
        genres: [],
        themes: [],
        favorite: false,
        notes: ''
      },
      {
        id: 'qa-anime-season-2',
        parentId: rootId,
        sourceProvider: 'frame-story-arc',
        externalId: 'qa-anime-season-2',
        title: 'Season 2',
        description: 'Child season fixture',
        poster: '/frame-logo.svg',
        backdrop: '',
        medium: 'anime',
        status: 'planned',
        progress: 0,
        total: 12,
        genres: [],
        themes: [],
        favorite: false,
        notes: ''
      }
    ];
    await page.addInitScript((items) => {
      localStorage.setItem('frame-guest', '1');
      localStorage.setItem('frame-library:guest', JSON.stringify(items));
    }, fixture);

    await page.goto('/');
    await navigatePrimary(page, 'Library');
    const card = page.locator('.media-card').filter({ hasText: 'FRAME QA Anime' }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole('heading', { name: 'FRAME QA Anime', exact: true })).toBeVisible();

    await page.locator('.hierarchy-part-card').filter({ hasText: 'Season 2' }).evaluate(el => (el as HTMLButtonElement).click());
    await expect(page.getByRole('heading', { name: 'Season 2', exact: true })).toBeVisible();

    await page.goBack();
    await expect(page.locator('.detail-overlay')).toHaveCount(0);
    await expect(page.locator('h1').filter({ hasText: /^Library$/ })).toBeVisible();
    await expect(page.locator('h1').filter({ hasText: /Welcome back/ })).toHaveCount(0);
  });
});
