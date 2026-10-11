'use strict';

(function () {
  const API = 'https://graphql.anilist.co';
  const CLIENT_ID = '53479';
  const AUTH_PIN_URL = 'https://anilist.co/api/v2/oauth/pin';
  const TOKEN_KEY = 'frame-anilist-bridge-token-v1';
  const STATUSES = ['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'];
  const STATUS_NAMES = {
    PLANNING: 'Plan to watch / read',
    CURRENT: 'Watching / reading',
    COMPLETED: 'Completed',
    PAUSED: 'Paused',
    DROPPED: 'Dropped',
    REPEATING: 'Rewatching / rereading'
  };
  const SEARCH_QUERY = 'query ($search:String!,$type:MediaType!){Page(page:1,perPage:12){media(search:$search,type:$type,sort:[SEARCH_MATCH]){id type format title{userPreferred english romaji native} coverImage{large extraLarge} episodes chapters averageScore seasonYear status siteUrl}}}';
  const DETAIL_QUERY = 'query ($id:Int!,$type:MediaType!){Media(id:$id,type:$type){id type format title{userPreferred english romaji native} coverImage{large extraLarge} episodes chapters averageScore seasonYear status siteUrl}}';
  const VIEWER_QUERY = 'query { Viewer { id name avatar { large } } }';
  const LIST_QUERY = 'query ($userId:Int!,$type:MediaType!){MediaListCollection(userId:$userId,type:$type,sort:[UPDATED_TIME_DESC]){lists{name entries{id status progress score scoreRaw updatedAt media{id type format title{userPreferred english romaji native} coverImage{large} episodes chapters averageScore seasonYear siteUrl}}}}}';
  const SAVE_MUTATION = 'mutation ($mediaId:Int!,$status:MediaListStatus!,$progress:Int,$scoreRaw:Int){SaveMediaListEntry(mediaId:$mediaId,status:$status,progress:$progress,scoreRaw:$scoreRaw){id status progress scoreRaw media{id title{userPreferred}}}}';

  const $ = (id) => document.getElementById(id);
  let tokenInfo = null;
  let viewer = null;
  let lists = { ANIME: [], MANGA: [] };
  let selected = null;
  let searchResults = [];
  let bridgeAction = null;

  function appBase() { return window.location.origin + window.location.pathname; }
  function readToken() {
    try {
      const data = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (!data || !data.accessToken) return null;
      if (data.expiresAt && Date.now() > data.expiresAt) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return data;
    } catch (_) { return null; }
  }
  function consumeOAuthFragment() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('error')) {
      const err = params.get('error_description') || params.get('error');
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
      showMessage('search-message', 'AniList authorization did not complete: ' + err + '. Check the registered redirect URL and try again.', 'error');
      return;
    }
    const accessToken = params.get('access_token');
    if (!accessToken) return;
    const expected = sessionStorage.getItem('frameAniListOAuthState');
    const received = params.get('state');
    if (expected && received && expected !== received) {
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
      sessionStorage.removeItem('frameAniListOAuthState');
      showMessage('search-message', 'The AniList sign-in state did not match. Please try connecting again.', 'error');
      return;
    }
    const seconds = Number(params.get('expires_in') || 31536000);
    tokenInfo = { accessToken: accessToken, expiresAt: Date.now() + seconds * 1000 };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenInfo));
    sessionStorage.removeItem('frameAniListOAuthState');
    const pending = sessionStorage.getItem('frameAniListPendingSearch') || window.location.search;
    sessionStorage.removeItem('frameAniListPendingSearch');
    history.replaceState({}, document.title, window.location.pathname + pending);
  }
  async function api(query, variables, allowNoToken) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (tokenInfo && tokenInfo.accessToken) headers.Authorization = 'Bearer ' + tokenInfo.accessToken;
    const response = await fetch(API, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query: query, variables: variables || {} }),
      cache: 'no-store'
    });
    let payload;
    try { payload = await response.json(); } catch (_) { throw new Error('AniList returned an unreadable response.'); }
    if (!response.ok || (payload.errors && payload.errors.length)) {
      const err = payload.errors && payload.errors[0] ? payload.errors[0].message : ('AniList request failed (HTTP ' + response.status + ').');
      if (!allowNoToken && /unauthori[sz]ed|invalid token|token.*expired|jwt/i.test(err)) {
        throw new Error('Your AniList connection may have expired. Disconnect and connect again.');
      }
      throw new Error(err);
    }
    if (!payload.data) throw new Error('AniList returned no data.');
    return payload.data;
  }
  function showMessage(id, text, kind) {
    const element = $(id);
    if (!element) return;
    element.textContent = text || '';
    element.className = 'message' + (text ? ' show' : '') + (kind ? ' ' + kind : '');
  }
  function statusName(status) { return STATUS_NAMES[status] || String(status || 'Unknown'); }
  function titleOf(media) {
    const t = media && media.title ? media.title : {};
    return t.userPreferred || t.english || t.romaji || t.native || 'Untitled';
  }
  function mediaMeta(media) {
    const bits = [];
    if (media.format) bits.push(String(media.format).replace(/_/g, ' '));
    if (media.seasonYear) bits.push(String(media.seasonYear));
    if (media.episodes) bits.push(media.episodes + ' episodes');
    if (media.chapters) bits.push(media.chapters + ' chapters');
    if (media.averageScore) bits.push('AniList ' + (media.averageScore / 10).toFixed(1));
    return bits.join(' · ');
  }
  function artwork(media) {
    if (media && media.coverImage) return media.coverImage.large || media.coverImage.extraLarge || '';
    return '';
  }
  function safeImage(img, media, alt) {
    const src = artwork(media);
    img.alt = alt || '';
    if (src && /^https:\/\//.test(src)) img.src = src;
    else img.removeAttribute('src');
    img.loading = 'lazy';
  }
  function setConnectedUI() {
    const connected = Boolean(tokenInfo && tokenInfo.accessToken && viewer);
    $('connection-dot').className = 'dot' + (connected ? ' good' : '');
    $('connection-label').textContent = connected ? 'Connected' : (tokenInfo ? 'Checking connection…' : 'Not connected');
    $('connect-button').classList.toggle('hidden', connected);
    $('disconnect-button').classList.toggle('hidden', !tokenInfo);
    $('viewer-name').textContent = connected ? viewer.name : 'Not connected';
    $('anime-count').textContent = connected ? String(lists.ANIME.length) : '—';
    $('manga-count').textContent = connected ? String(lists.MANGA.length) : '—';
    $('save-button').disabled = !connected || !selected;
    if (!connected) {
      $('list-entries').innerHTML = '<div class="empty">Connect AniList to load your actual library here.</div>';
    }
  }
  function connect() {
    // AniList's Auth PIN flow avoids fragile localhost/redirect URI callbacks.
    // The registered Redirect URL must be AUTH_PIN_URL; the user pastes the token back here.
    const url = 'https://anilist.co/api/v2/oauth/authorize?client_id=' + encodeURIComponent(CLIENT_ID) + '&response_type=token';
    window.location.assign(url);
  }

  function tokenFromInput(raw) {
    let value = String(raw || '').trim();
    if (!value) return '';
    if (/access_token=/i.test(value)) {
      const fragment = value.includes('#') ? value.slice(value.lastIndexOf('#') + 1) : value;
      const params = new URLSearchParams(fragment);
      const token = params.get('access_token');
      if (token) return token.trim();
    }
    if (/^Bearer\\s+/i.test(value)) value = value.replace(/^Bearer\\s+/i, '').trim();
    return value;
  }

  async function connectWithPastedToken() {
    const raw = $('access-token-input').value;
    const accessToken = tokenFromInput(raw);
    if (!accessToken) {
      showMessage('token-message', 'Paste the access token from AniList’s PIN page first.', 'error');
      return;
    }
    const previousToken = tokenInfo;
    const previousViewer = viewer;
    tokenInfo = { accessToken: accessToken, expiresAt: Date.now() + 31536000 * 1000 };
    const button = $('token-connect-button');
    button.disabled = true;
    button.textContent = 'Checking token…';
    showMessage('token-message', 'Checking the token with AniList…');
    try {
      const data = await api(VIEWER_QUERY, {});
      if (!data.Viewer) throw new Error('AniList did not return a signed-in account.');
      viewer = data.Viewer;
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenInfo));
      $('access-token-input').value = '';
      setConnectedUI();
      showMessage('token-message', 'Connected as ' + viewer.name + '. Your token stays in this browser.', 'success');
      await loadLists();
      showMessage('list-message', 'Loaded ' + lists.ANIME.length + ' anime and ' + lists.MANGA.length + ' manga entries.', 'success');
    } catch (e) {
      tokenInfo = previousToken;
      viewer = previousViewer;
      setConnectedUI();
      showMessage('token-message', 'AniList rejected that token. Return to the PIN page, copy only the access token, and try again. ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Connect with token';
    }
  }
  function disconnect() {
    if (!window.confirm('Disconnect AniList on this browser? The token will be removed from this device.')) return;
    localStorage.removeItem(TOKEN_KEY);
    tokenInfo = null;
    viewer = null;
    lists = { ANIME: [], MANGA: [] };
    selected = null;
    $('editor').classList.remove('show');
    $('bridge-request').classList.remove('show');
    setConnectedUI();
    showMessage('list-message', 'Disconnected. Your AniList account itself was not changed.', 'success');
  }
  function flattenCollection(data, type) {
    const out = [];
    const groups = data && data.MediaListCollection && data.MediaListCollection.lists ? data.MediaListCollection.lists : [];
    groups.forEach(function (group) {
      (group.entries || []).forEach(function (entry) {
        if (entry.media) out.push(Object.assign({}, entry, { listName: group.name, mediaType: type }));
      });
    });
    return out;
  }
  async function loadLists() {
    if (!viewer) return;
    const [anime, manga] = await Promise.all([
      api(LIST_QUERY, { userId: Number(viewer.id), type: 'ANIME' }),
      api(LIST_QUERY, { userId: Number(viewer.id), type: 'MANGA' })
    ]);
    lists.ANIME = flattenCollection(anime, 'ANIME');
    lists.MANGA = flattenCollection(manga, 'MANGA');
    setConnectedUI();
    renderList();
  }
  function renderList() {
    const connected = Boolean(viewer && tokenInfo);
    if (!connected) {
      $('list-entries').innerHTML = '<div class="empty">Connect AniList to load your library.</div>';
      return;
    }
    const type = $('list-type').value;
    const status = $('list-status').value;
    const search = $('list-search').value.trim().toLocaleLowerCase();
    const filtered = lists[type].filter(function (entry) {
      if (status !== 'ALL' && entry.status !== status) return false;
      if (search && !titleOf(entry.media).toLocaleLowerCase().includes(search)) return false;
      return true;
    }).slice(0, 80);
    const container = $('list-entries');
    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = '<div class="empty">No entries match this filter.</div>';
      return;
    }
    filtered.forEach(function (entry) {
      const button = document.createElement('button');
      button.className = 'entry';
      button.type = 'button';
      button.style.textAlign = 'left';
      button.style.cursor = 'pointer';
      const img = document.createElement('img');
      img.className = 'poster';
      safeImage(img, entry.media, titleOf(entry.media));
      const copy = document.createElement('span');
      copy.className = 'entry-main';
      const strong = document.createElement('strong');
      strong.textContent = titleOf(entry.media);
      const small = document.createElement('small');
      small.textContent = statusName(entry.status) + ' · ' + (entry.progress || 0) + '/' + (entry.media.episodes || entry.media.chapters || '—');
      copy.append(strong, small);
      const edit = document.createElement('span');
      edit.className = 'btn small';
      edit.textContent = 'Edit';
      button.append(img, copy, edit);
      button.addEventListener('click', function () { selectMedia(entry.media, { type: type, status: entry.status, progress: entry.progress || 0, scoreRaw: entry.scoreRaw || 0 }); });
      container.appendChild(button);
    });
  }
  function renderResults(rows) {
    const container = $('results');
    container.innerHTML = '';
    if (!rows.length) {
      container.innerHTML = '<div class="empty" style="grid-column:1/-1">No results yet. Search for a title above.</div>';
      return;
    }
    const type = $('search-type').value;
    rows.forEach(function (media) {
      const entry = lists[type].find(function (x) { return Number(x.media.id) === Number(media.id); });
      const button = document.createElement('button');
      button.className = 'result';
      button.type = 'button';
      const img = document.createElement('img');
      img.className = 'poster';
      safeImage(img, media, titleOf(media));
      const copy = document.createElement('span');
      copy.className = 'resultcopy';
      const title = document.createElement('strong');
      title.textContent = titleOf(media);
      const meta = document.createElement('small');
      meta.textContent = mediaMeta(media) || (type === 'ANIME' ? 'Anime entry' : 'Manga entry');
      copy.append(title, meta);
      if (entry) {
        const badge = document.createElement('small');
        badge.className = 'tiny-status';
        badge.textContent = statusName(entry.status);
        copy.appendChild(badge);
      }
      button.append(img, copy);
      button.addEventListener('click', function () { selectMedia(media, { type: type }); });
      container.appendChild(button);
    });
  }
  function selectMedia(media, overrides) {
    const type = (overrides && overrides.type) || media.type || $('search-type').value;
    const existing = lists[type].find(function (x) { return Number(x.media.id) === Number(media.id); });
    selected = Object.assign({}, media, { type: type });
    $('selected-poster').alt = titleOf(media);
    safeImage($('selected-poster'), media, titleOf(media));
    $('selected-name').textContent = titleOf(media);
    $('selected-meta').textContent = mediaMeta(media) || (type === 'ANIME' ? 'Anime' : 'Manga');
    $('selected-existing').textContent = existing ? 'Already in your list · ' + statusName(existing.status) : 'Not in your list yet';
    $('search-type').value = type;
    $('progress-label').textContent = type === 'ANIME' ? 'EPISODES WATCHED' : 'CHAPTERS READ';
    $('status-input').value = overrides && overrides.status ? overrides.status : (existing ? existing.status : 'PLANNING');
    const progress = overrides && Object.prototype.hasOwnProperty.call(overrides, 'progress')
      ? overrides.progress : (existing ? existing.progress || 0 : 0);
    const scoreRaw = overrides && Object.prototype.hasOwnProperty.call(overrides, 'scoreRaw')
      ? overrides.scoreRaw : (existing ? existing.scoreRaw || 0 : 0);
    $('progress-input').value = String(Math.max(0, Number(progress) || 0));
    $('score-input').value = String(Math.min(100, Math.max(0, Number(scoreRaw) || 0)));
    $('editor').classList.add('show');
    $('save-button').disabled = !(tokenInfo && viewer);
    showMessage('save-message', tokenInfo && viewer ? '' : 'Connect AniList before saving. You can still prepare this change now.', tokenInfo ? 'error' : '');
    $('editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function search() {
    const term = $('search-input').value.trim();
    if (term.length < 2) {
      showMessage('search-message', 'Enter at least two characters to search.', 'error');
      return;
    }
    const button = $('search-button');
    button.disabled = true;
    button.textContent = 'Searching…';
    showMessage('search-message', 'Searching AniList…');
    try {
      const data = await api(SEARCH_QUERY, { search: term, type: $('search-type').value }, true);
      searchResults = (data.Page && data.Page.media) || [];
      renderResults(searchResults);
      showMessage('search-message', searchResults.length ? (searchResults.length + ' matches. Pick the exact title.') : 'No matches found. Try another spelling.', searchResults.length ? 'success' : '');
    } catch (e) {
      showMessage('search-message', e instanceof Error ? e.message : String(e), 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Search';
    }
  }
  async function processBridgeRequest() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('mediaId')) return;
    const id = Number(params.get('mediaId'));
    const type = params.get('type') === 'MANGA' ? 'MANGA' : 'ANIME';
    const status = params.get('status') || 'PLANNING';
    if (!Number.isInteger(id) || id < 1 || !STATUSES.includes(status)) {
      showMessage('search-message', 'The ChatGPT hand-off link is invalid. Ask ChatGPT to regenerate it.', 'error');
      return;
    }
    const overrides = { type: type, status: status };
    if (params.has('progress') && Number.isFinite(Number(params.get('progress')))) overrides.progress = Math.max(0, Math.floor(Number(params.get('progress'))));
    if (params.has('scoreRaw') && Number.isFinite(Number(params.get('scoreRaw')))) overrides.scoreRaw = Math.min(100, Math.max(0, Math.floor(Number(params.get('scoreRaw')))));
    bridgeAction = { id: id, type: type, status: status };
    showMessage('search-message', 'Loading the requested AniList title…');
    try {
      const data = await api(DETAIL_QUERY, { id: id, type: type }, true);
      if (!data.Media) throw new Error('AniList could not find that title ID.');
      $('bridge-copy').textContent = titleOf(data.Media) + ' → ' + statusName(status) + '. No changes have been made yet.';
      $('bridge-request').classList.add('show');
      selectMedia(data.Media, overrides);
      if (viewer) showMessage('save-message', 'Review the status and progress, then press Save to apply this update.', '');
      else showMessage('save-message', 'Connect AniList first. This is still only a draft; your list has not been changed.', 'error');
    } catch (e) {
      showMessage('search-message', e instanceof Error ? e.message : String(e), 'error');
    }
  }
  async function save() {
    if (!tokenInfo || !viewer) {
      showMessage('save-message', 'Connect AniList before saving.', 'error');
      return;
    }
    if (!selected) return;
    const status = $('status-input').value;
    const progress = Math.max(0, Math.floor(Number($('progress-input').value) || 0));
    const scoreRaw = Math.min(100, Math.max(0, Math.floor(Number($('score-input').value) || 0)));
    const saveButton = $('save-button');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    showMessage('save-message', 'Sending the update to AniList…');
    try {
      const data = await api(SAVE_MUTATION, { mediaId: Number(selected.id), status: status, progress: progress, scoreRaw: scoreRaw });
      const saved = data.SaveMediaListEntry;
      if (!saved || !saved.id) throw new Error('AniList did not confirm the save.');
      showMessage('save-message', 'Saved: ' + titleOf(selected) + ' · ' + statusName(saved.status) + '. Your AniList list has been updated.', 'success');
      $('selected-existing').textContent = 'Saved to AniList · ' + statusName(saved.status);
      $('bridge-copy').textContent = 'Saved: ' + titleOf(selected) + ' → ' + statusName(saved.status) + '.';
      history.replaceState({}, document.title, window.location.pathname);
      bridgeAction = null;
      await loadLists();
    } catch (e) {
      showMessage('save-message', e instanceof Error ? e.message : String(e), 'error');
    } finally {
      saveButton.disabled = !(tokenInfo && viewer);
      saveButton.textContent = 'Save to AniList';
    }
  }
  function promptText() {
    return 'When I ask you to add or update something on AniList, find the exact AniList media ID and decide whether it is ANIME or MANGA. Then give me a clickable Markdown link to review the change in my AniList Bridge. Base URL: ' + appBase() + '\n' +
      'Link format: ' + appBase() + '?mediaId=ANILIST_ID&type=ANIME_OR_MANGA&status=PLANNING_OR_CURRENT_OR_COMPLETED_OR_PAUSED_OR_DROPPED_OR_REPEATING\n' +
      'Add &progress=NUMBER only when I give a specific episode/chapter progress. Add &scoreRaw=NUMBER only when I give a score from 0 to 100. Example status mappings: plan-to-watch=PLANNING, watching= CURRENT, completed=COMPLETED. Label the link with the title and intended status. Never claim the list was changed unless I opened the link and pressed Save to AniList.';
  }
  async function copyText(text, targetId, success) {
    try {
      await navigator.clipboard.writeText(text);
      showMessage(targetId, success, 'success');
    } catch (_) {
      showMessage(targetId, 'Clipboard permission was blocked. Select and copy the text manually.', 'error');
    }
  }
  async function init() {
    $('redirect-url').value = AUTH_PIN_URL;
    $('copy-redirect').addEventListener('click', function () { copyText(AUTH_PIN_URL, 'copy-message', 'Auth PIN URL copied. Paste it into your AniList API client Redirect URL settings.'); });
    consumeOAuthFragment();
    tokenInfo = readToken();
    $('chatgpt-prompt').textContent = promptText();
    if (tokenInfo) {
      setConnectedUI();
      try {
        const data = await api(VIEWER_QUERY, {});
        viewer = data.Viewer;
        if (!viewer) throw new Error('AniList did not return the connected user.');
        setConnectedUI();
        showMessage('list-message', 'Connected as ' + viewer.name + '. Loading lists…');
        await loadLists();
        showMessage('list-message', 'Loaded ' + lists.ANIME.length + ' anime and ' + lists.MANGA.length + ' manga entries.', 'success');
      } catch (e) {
        viewer = null;
        setConnectedUI();
        showMessage('list-message', e instanceof Error ? e.message : String(e), 'error');
        showMessage('search-message', 'If the connection is expired, disconnect and connect again.', 'error');
      }
    } else {
      setConnectedUI();
      renderResults([]);
    }
    await processBridgeRequest();
    setConnectedUI();
  }
  $('connect-button').addEventListener('click', connect);
  $('token-connect-button').addEventListener('click', connectWithPastedToken);
  $('disconnect-button').addEventListener('click', disconnect);
  $('search-button').addEventListener('click', search);
  $('search-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
  $('search-type').addEventListener('change', function () { if (searchResults.length) renderResults(searchResults); });
  $('save-button').addEventListener('click', save);
  $('cancel-button').addEventListener('click', function () { selected = null; $('editor').classList.remove('show'); });
  $('list-type').addEventListener('change', renderList);
  $('list-status').addEventListener('change', renderList);
  $('list-search').addEventListener('input', renderList);
  $('refresh-list').addEventListener('click', async function () {
    if (!viewer) { showMessage('list-message', 'Connect AniList first.', 'error'); return; }
    $('refresh-list').disabled = true;
    showMessage('list-message', 'Refreshing your lists…');
    try { await loadLists(); showMessage('list-message', 'Lists refreshed.', 'success'); }
    catch (e) { showMessage('list-message', e instanceof Error ? e.message : String(e), 'error'); }
    finally { $('refresh-list').disabled = false; }
  });
  $('copy-prompt').addEventListener('click', function () { copyText(promptText(), 'copy-message', 'Instructions copied. Paste them into ChatGPT when asking for AniList updates.'); });
  $('copy-base').addEventListener('click', function () { copyText(appBase(), 'copy-message', 'App link copied.'); });
  init();
})();