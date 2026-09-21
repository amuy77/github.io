// Gmail API (ブラウザ内 OAuth / Google Identity Services)。
// 読み取り専用スコープのみ。トークンはメモリ内にだけ保持する。

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

let tokenClient = null;
let accessToken = '';
let tokenExpiresAt = 0;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google のスクリプトを読み込めませんでした(オフライン?)'));
    document.head.appendChild(s);
  });
}

export function hasToken() {
  return Boolean(accessToken) && Date.now() < tokenExpiresAt - 30000;
}

export async function signIn(clientId, { silent = false } = {}) {
  if (!clientId) throw new Error('OAuth クライアント ID が未設定です(設定タブ)');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + Number(resp.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
      error_callback: (err) => reject(new Error(err?.message || err?.type || 'サインインに失敗しました')),
    });
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(accessToken, () => {}); } catch { /* noop */ }
  }
  accessToken = '';
  tokenExpiresAt = 0;
}

async function api(path, params = {}) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new Error('認証が切れました。もう一度「Gmailと接続」を押してください');
  if (!res.ok) throw new Error(`Gmail API エラー ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function listMessageIds(query, maxTotal = 300) {
  const ids = [];
  let pageToken;
  do {
    const data = await api('messages', { q: query, maxResults: 100, pageToken });
    for (const m of data.messages || []) ids.push(m.id);
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < maxTotal);
  return ids;
}

function b64urlToText(data) {
  if (!data) return '';
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

export function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|td)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, ' [$1] ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
}

function collectParts(payload, out) {
  if (!payload) return;
  if (payload.body?.data) out.push({ mime: payload.mimeType || '', data: payload.body.data });
  for (const p of payload.parts || []) collectParts(p, out);
}

export function messageToInput(msg) {
  const headers = Object.fromEntries((msg.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
  const parts = [];
  collectParts(msg.payload, parts);
  const plain = parts.find((p) => p.mime.startsWith('text/plain'));
  const html = parts.find((p) => p.mime.startsWith('text/html'));
  let body = '';
  if (plain) body = b64urlToText(plain.data);
  else if (html) body = htmlToText(b64urlToText(html.data));
  else body = msg.snippet || '';
  return {
    id: msg.id,
    from: headers.from || '',
    subject: headers.subject || '',
    date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : headers.date ? new Date(headers.date).toISOString() : new Date().toISOString(),
    body,
    source: 'gmail',
    threadId: msg.threadId,
  };
}

export async function fetchMessage(id) {
  const msg = await api(`messages/${id}`, { format: 'full' });
  return messageToInput(msg);
}

// 既存 ID を除いて新着だけ取得。onProgress(done, total)
export async function sync({ query, knownIds, onProgress, maxTotal = 300 }) {
  const ids = await listMessageIds(query, maxTotal);
  const fresh = ids.filter((id) => !knownIds.has(id));
  const results = [];
  let done = 0;
  const CONCURRENCY = 5;
  const queue = [...fresh];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try {
        results.push(await fetchMessage(id));
      } catch (e) {
        console.warn('取得失敗', id, e);
      }
      done++;
      onProgress?.(done, fresh.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return { results, total: ids.length, fetched: fresh.length };
}
