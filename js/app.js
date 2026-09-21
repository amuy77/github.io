import { classify, buildCases, applyState, KINDS, PLATFORMS, STAGES, REVIEW_KINDS } from './classifier.js';
import * as store from './store.js';
import * as gmail from './gmail.js';
import { hostReviewTemplate, replyTemplate } from './templates.js';

const state = store.load();
let tab = 'reviews';
let reviewFilter = 'open'; // open | write | reply | done | all
let inboxPlatform = 'all';
let inboxKind = 'all';
let openTemplates = new Set();

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

// ---------- ユーティリティ ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}
function banner(msg, isError = false) {
  const b = $('#banner');
  if (!msg) { b.hidden = true; return; }
  b.textContent = msg;
  b.className = 'banner' + (isError ? ' error' : '');
  b.hidden = false;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function deadlineLabel(c) {
  if (!c.deadline) return { text: '期限不明', cls: '' };
  const diff = new Date(c.deadline) - Date.now();
  if (diff < 0) return { text: '期限切れ', cls: 'expired' };
  const h = Math.floor(diff / 3600000);
  if (h < 48) return { text: `あと${h}時間`, cls: 'soon' };
  return { text: `あと${Math.floor(h / 24)}日`, cls: h < 24 * 5 ? 'later' : '' };
}
function stars(n) {
  if (n === undefined || n === null) return '';
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}
function persist() {
  if (!store.save(state)) toast('保存できませんでした(容量不足?)');
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch {
    toast('コピーできませんでした。長押しで選択してください');
  }
}

// ---------- データ ----------
function allItems() {
  return Object.values(state.items).sort((a, b) => new Date(b.date) - new Date(a.date));
}
function cases() {
  return buildCases(Object.values(state.items)).map((c) => applyState(c, state.caseState[c.key]));
}
function addClassified(input) {
  const item = classify(input);
  const existed = Boolean(state.items[item.id]);
  state.items[item.id] = {
    ...item,
    read: state.items[item.id]?.read ?? false,
    rawBody: (input.body || '').slice(0, 6000), // 再分類用に本文の先頭だけ保持
    threadId: input.threadId,
  };
  return { item, existed };
}
function updateBadges() {
  const cs = cases();
  const open = cs.filter((c) => c.stage !== 'done').length;
  const unread = allItems().filter((i) => !i.read && ['guest_message', 'inquiry'].includes(i.kind)).length;
  const b1 = $('#badge-reviews'); b1.textContent = open; b1.hidden = open === 0;
  const b2 = $('#badge-inbox'); b2.textContent = unread; b2.hidden = unread === 0;
  if (navigator.setAppBadge) {
    const total = open + unread;
    (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
  }
}

// ---------- 描画 ----------
function render() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  if (tab === 'reviews') renderReviews();
  else if (tab === 'inbox') renderInbox();
  else if (tab === 'add') renderAdd();
  else renderSettings();
  updateBadges();
}

function renderReviews() {
  const cs = cases();
  const write = cs.filter((c) => c.stage === 'write');
  const reply = cs.filter((c) => c.stage === 'reply');
  const soon = write.filter((c) => c.deadline && new Date(c.deadline) - Date.now() < 48 * 3600000 && !c.expired);
  const list = cs.filter((c) => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'open') return c.stage !== 'done';
    return c.stage === reviewFilter;
  });
  view.innerHTML = `
    <div class="summary">
      <button class="stat ${soon.length ? 'warn' : ''} ${reviewFilter === 'write' ? 'is-active' : ''}" data-filter="write"><div class="n">${write.length}</div><div class="l">要投稿${soon.length ? `(${soon.length}件が48h以内)` : ''}</div></button>
      <button class="stat ${reviewFilter === 'reply' ? 'is-active' : ''}" data-filter="reply"><div class="n">${reply.length}</div><div class="l">返信推奨</div></button>
      <button class="stat ${reviewFilter === 'done' ? 'is-active' : ''}" data-filter="done"><div class="n">${cs.length - write.length - reply.length}</div><div class="l">完了</div></button>
    </div>
    <div class="filters">
      <button class="chip ${reviewFilter === 'open' ? 'is-active' : ''}" data-filter="open">未対応</button>
      <button class="chip ${reviewFilter === 'all' ? 'is-active' : ''}" data-filter="all">すべて</button>
    </div>
    ${list.length ? list.map(caseCard).join('') : emptyState(cs.length ? '該当する案件はありません' : 'まだレビュー案件がありません', cs.length ? '' : '右上の「同期」で Gmail から取り込むか、「追加」タブに通知メールを貼り付けてください。')}
  `;
  view.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { reviewFilter = b.dataset.filter; render(); }));
  view.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', onCaseAction));
  view.querySelectorAll('textarea[data-note]').forEach((t) => t.addEventListener('change', () => {
    const st = (state.caseState[t.dataset.note] ||= {});
    st.note = t.value;
    persist();
  }));
  view.querySelectorAll('textarea[data-draft]').forEach((t) => t.addEventListener('input', () => {
    const st = (state.caseState[t.dataset.draft] ||= {});
    st.draft = t.value;
    persist();
  }));
}

function caseCard(c) {
  const dl = c.stage === 'write' ? deadlineLabel(c) : null;
  const st = c.state || {};
  const link = c.stage === 'reply' ? c.links.reply || c.links.details : c.links.write || c.links.details;
  const fallback = c.platform === 'airbnb' ? 'https://www.airbnb.jp/hosting/reviews' : 'https://admin.booking.com/';
  const showTpl = openTemplates.has(c.key);
  const tplText = st.draft || (c.stage === 'reply' ? replyTemplate(c, state.settings.hostName) : hostReviewTemplate(c, state.settings.hostName));
  return `
  <article class="card" data-key="${esc(c.key)}">
    <div class="card-head">
      <div>
        <h3 class="card-title">${esc(c.guest || '(ゲスト不明)')} ${c.rating !== undefined ? (c.platform === 'booking' ? `<span class="score">${esc(c.rating)}/10</span>` : `<span class="stars">${stars(c.rating)}</span>`) : ''}</h3>
        <div class="card-sub">${esc(c.stayDates || '滞在日不明')}${c.listing ? ' · ' + esc(c.listing) : ''}</div>
      </div>
      ${dl ? `<div class="deadline ${dl.cls}">${dl.text}</div>` : ''}
    </div>
    <div class="badges">
      <span class="badge ${c.platform}">${PLATFORMS[c.platform]}</span>
      <span class="badge stage-${c.stage}">${STAGES[c.stage]}</span>
      ${c.kinds.map((k) => `<span class="badge kind">${KINDS[k]}</span>`).join('')}
    </div>
    ${c.reviewText ? `<div class="review-text">${esc(c.reviewText)}</div>` : c.posted ? '' : `<div class="help" style="margin-top:8px">${c.kinds.includes('review_received') ? 'ゲストのレビューは、こちらが投稿すると公開されます。' : 'チェックアウト後 14 日以内にゲストへのレビューを投稿できます。'}</div>`}
    ${c.highlights?.length ? `<div class="highlights">${c.highlights.map((h) => `<span>${esc(h)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <a class="btn btn-primary btn-sm" href="${esc(link || fallback)}" target="_blank" rel="noopener">${c.platform === 'airbnb' ? 'Airbnb' : 'Booking'}で${c.stage === 'reply' ? '返信' : '投稿'}</a>
      <button class="btn btn-sm" data-action="template">${showTpl ? '文例を閉じる' : (c.stage === 'reply' ? '返信文例' : 'レビュー文例')}</button>
      ${c.stage === 'write' ? `<button class="btn btn-sm" data-action="hostReviewDone">投稿済みにする</button>` : ''}
      ${c.stage === 'reply' ? `<button class="btn btn-sm" data-action="replied">返信済みにする</button>` : ''}
      ${c.stage === 'done' ? `<button class="btn btn-sm btn-ghost" data-action="reopen">未対応に戻す</button>` : `<button class="btn btn-sm btn-ghost" data-action="archive">対応不要</button>`}
    </div>
    ${showTpl ? `<div class="template-box"><textarea data-draft="${esc(c.key)}">${esc(tplText)}</textarea><div class="actions"><button class="btn btn-sm" data-action="copy">コピー</button><button class="btn btn-sm btn-ghost" data-action="resetDraft">文例をリセット</button></div></div>` : ''}
    <textarea class="note" data-note="${esc(c.key)}" placeholder="メモ(次回のための覚え書き)" rows="1">${esc(st.note || '')}</textarea>
    <details class="sub"><summary>元の通知 ${c.itemIds.length} 件</summary>
      <ul class="timeline">${c.itemIds.map((id) => state.items[id.split('#')[0]]).filter(Boolean).map((i) => `<li><span class="t">${fmtDate(i.date)}</span><span>${esc(KINDS[i.kind])} — ${esc(i.subject)}</span></li>`).join('')}</ul>
    </details>
  </article>`;
}

function onCaseAction(e) {
  const btn = e.currentTarget;
  const card = btn.closest('[data-key]');
  const key = card.dataset.key;
  const st = (state.caseState[key] ||= {});
  const action = btn.dataset.action;
  if (action === 'hostReviewDone') { st.hostReviewDone = true; toast('投稿済みにしました'); }
  else if (action === 'replied') { st.replied = true; toast('返信済みにしました'); }
  else if (action === 'archive') { st.archived = true; toast('対応不要にしました'); }
  else if (action === 'reopen') { st.archived = false; st.replied = false; st.hostReviewDone = false; }
  else if (action === 'template') { openTemplates.has(key) ? openTemplates.delete(key) : openTemplates.add(key); }
  else if (action === 'copy') { copy(card.querySelector('textarea[data-draft]').value); return; }
  else if (action === 'resetDraft') { delete st.draft; }
  persist();
  render();
}

function emptyState(title, sub) {
  return `<div class="empty"><p><strong>${esc(title)}</strong></p>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
}

function renderInbox() {
  const items = allItems().filter((i) => (inboxPlatform === 'all' || i.platform === inboxPlatform) && (inboxKind === 'all' || i.kind === inboxKind || (inboxKind === 'review' && REVIEW_KINDS.has(i.kind))));
  const kindOptions = [['all', 'すべての種類'], ['review', 'レビュー関連'], ...Object.entries(KINDS)];
  view.innerHTML = `
    <div class="filters">
      ${[['all', 'すべて'], ['airbnb', 'Airbnb'], ['booking', 'Booking.com']].map(([v, l]) => `<button class="chip ${inboxPlatform === v ? 'is-active' : ''}" data-platform="${v}">${l}</button>`).join('')}
      <select id="kind-filter">${kindOptions.map(([v, l]) => `<option value="${v}" ${inboxKind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    ${items.length ? items.map(itemCard).join('') : emptyState('通知はまだありません', '「同期」で Gmail から取り込むか、「追加」タブから貼り付けてください。')}
  `;
  view.querySelectorAll('[data-platform]').forEach((b) => b.addEventListener('click', () => { inboxPlatform = b.dataset.platform; render(); }));
  $('#kind-filter').addEventListener('change', (e) => { inboxKind = e.target.value; render(); });
  view.querySelectorAll('[data-item-action="delete"]').forEach((b) => b.addEventListener('click', onItemAction));
  view.querySelectorAll('[data-item-action="rekind"]').forEach((b) => b.addEventListener('change', onItemAction));
  view.querySelectorAll('details[data-item]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) { const it = state.items[d.dataset.item]; if (it && !it.read) { it.read = true; persist(); updateBadges(); d.querySelector('.badge.unread')?.remove(); } }
  }));
}

function itemCard(i) {
  const unread = !i.read && ['guest_message', 'inquiry'].includes(i.kind);
  const link = i.links?.reply || i.links?.write || i.links?.details;
  const body = i.messageText || i.reviewText || i.snippet;
  return `
  <details class="card" data-item="${esc(i.id)}">
    <summary style="cursor:pointer;list-style:none">
      <div class="card-head">
        <div>
          <div class="card-title" style="font-size:15px">${esc(i.subject || '(件名なし)')}</div>
          <div class="card-sub">${fmtDate(i.date)}${i.guest ? ' · ' + esc(i.guest) : ''}${i.amount ? ' · ¥' + esc(i.amount) : ''}${i.rating !== undefined ? ' · ' + (i.platform === 'booking' ? esc(i.rating) + '/10' : stars(i.rating)) : ''}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${i.platform}">${PLATFORMS[i.platform]}</span>
        <span class="badge kind">${KINDS[i.kind]}</span>
        ${unread ? '<span class="badge unread">未読</span>' : ''}
        ${i.source !== 'gmail' ? '<span class="badge">手動</span>' : ''}
      </div>
    </summary>
    ${body ? `<div class="review-text">${esc(body)}</div>` : ''}
    ${i.listing ? `<div class="help" style="margin-top:6px">${esc(i.listing)}${i.stayDates ? ' · ' + esc(i.stayDates) : ''}</div>` : ''}
    ${i.reservation ? `<div class="help">予約番号 ${esc(i.reservation)}</div>` : ''}
    <div class="actions">
      ${link ? `<a class="btn btn-sm btn-primary" href="${esc(link)}" target="_blank" rel="noopener">開く</a>` : ''}
      ${i.threadId ? `<a class="btn btn-sm" href="https://mail.google.com/mail/u/0/#all/${esc(i.threadId)}" target="_blank" rel="noopener">Gmailで見る</a>` : ''}
      <select class="btn btn-sm" data-item-action="rekind" title="種類を修正">${Object.entries(KINDS).map(([v, l]) => `<option value="${v}" ${i.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn btn-sm btn-ghost btn-danger" data-item-action="delete">削除</button>
    </div>
  </details>`;
}

function onItemAction(e) {
  const el = e.currentTarget;
  const id = el.closest('[data-item]').dataset.item;
  if (el.dataset.itemAction === 'delete') {
    delete state.items[id];
    persist();
    render();
  } else if (el.dataset.itemAction === 'rekind') {
    state.items[id].kind = el.value;
    persist();
    render();
  }
}

function renderAdd(prefill = {}) {
  view.innerHTML = `
    <form class="form" id="add-form">
      <p class="help">通知メールの本文をそのまま貼り付けると自動で分類します。Android なら、メールやアプリの「共有」からこのアプリを選ぶだけでここに入ります。</p>
      <label>件名 <input name="subject" value="${esc(prefill.subject || '')}" placeholder="例: Jennyさんが5つ星のレビューを投稿しました！"></label>
      <label>差出人(任意) <input name="from" value="${esc(prefill.from || '')}" placeholder="automated@airbnb.com など。空欄なら本文から判定"></label>
      <label>本文 <textarea name="body" placeholder="メール本文を貼り付け">${esc(prefill.body || '')}</textarea></label>
      <div class="row"><button class="btn btn-primary" type="submit">分類して追加</button><button class="btn btn-ghost" type="button" id="btn-preview">分類だけ確認</button></div>
      <div id="add-preview" class="preview"></div>
    </form>`;
  const form = $('#add-form');
  const readForm = () => {
    const fd = new FormData(form);
    let subject = fd.get('subject').trim();
    let body = fd.get('body');
    if (!subject) { // 本文の先頭行を件名扱い
      const first = body.split('\n').map((s) => s.trim()).find(Boolean) || '';
      subject = first.replace(/^件名[：:]\s*/, '');
    }
    return { from: fd.get('from').trim(), subject, body, date: new Date().toISOString(), source: 'manual' };
  };
  $('#btn-preview').addEventListener('click', () => {
    const it = classify(readForm());
    $('#add-preview').innerHTML = `<pre>${esc(JSON.stringify({ platform: PLATFORMS[it.platform], kind: KINDS[it.kind], guest: it.guest, listing: it.listing, stayDates: it.stayDates, rating: it.rating, hoursLeft: it.hoursLeft, reviewText: it.reviewText, messageText: it.messageText }, null, 2))}</pre>`;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = readForm();
    if (!input.subject && !input.body.trim()) { toast('件名か本文を入力してください'); return; }
    const { item, existed } = addClassified(input);
    persist();
    toast(existed ? '同じ通知を更新しました' : `${PLATFORMS[item.platform]} / ${KINDS[item.kind]} として追加しました`);
    tab = REVIEW_KINDS.has(item.kind) ? 'reviews' : 'inbox';
    render();
  });
}

function renderSettings() {
  const s = state.settings;
  const connected = gmail.hasToken();
  const origin = location.origin;
  view.innerHTML = `
    <form class="form" id="settings-form">
      <h2 class="section">Gmail 連携</h2>
      <label>OAuth クライアント ID <input name="clientId" value="${esc(s.clientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off"></label>
      <label>取り込む期間(日) <input name="days" type="number" min="1" max="365" value="${esc(s.days)}"></label>
      <label>Gmail 検索クエリ <input name="query" value="${esc(s.query)}"></label>
      <div class="row">
        <button class="btn btn-primary" type="button" id="btn-connect">${connected ? '再接続' : 'Gmailと接続'}</button>
        ${connected ? '<button class="btn" type="button" id="btn-disconnect">切断</button>' : ''}
        <span class="help">${s.lastSync ? '最終同期: ' + fmtDate(s.lastSync) : '未同期'}</span>
      </div>
      <details class="help"><summary>クライアント ID の作り方(初回のみ・5分)</summary>
        <ol>
          <li><a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a> でプロジェクトを作り、Gmail API を「有効にする」。</li>
          <li>「OAuth 同意画面」→ 外部 → アプリ名を入力 → テストユーザーに自分の Gmail を追加。</li>
          <li>「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ 種類「ウェブ アプリケーション」。</li>
          <li>「承認済みの JavaScript 生成元」に <code>${esc(origin)}</code> を追加(リダイレクト URI は不要)。</li>
          <li>発行されたクライアント ID を上に貼って保存 →「Gmailと接続」。</li>
        </ol>
        <p>権限は読み取り専用です。メールは端末内でだけ処理され、外部サーバーには送られません。</p>
      </details>

      <h2 class="section">文例</h2>
      <label>ホスト名(文例の署名に使用) <input name="hostName" value="${esc(s.hostName)}" placeholder="例: Masa"></label>

      <div class="row"><button class="btn btn-primary" type="submit">保存</button></div>

      <h2 class="section">データ</h2>
      <p class="help">通知 ${Object.keys(state.items).length} 件 / 案件メモ ${Object.keys(state.caseState).length} 件。すべてこの端末のブラウザ内に保存されています。</p>
      <div class="row">
        <button class="btn" type="button" id="btn-export">書き出し(JSON)</button>
        <label class="btn" style="display:inline-block">読み込み <input type="file" id="file-import" accept="application/json" hidden></label>
        <button class="btn" type="button" id="btn-reclassify">再分類</button>
        <button class="btn btn-danger" type="button" id="btn-clear">全削除</button>
      </div>

      <h2 class="section">スマホで使う</h2>
      <div class="help">
        <ul>
          <li><strong>Android(Chrome)</strong>: メニュー →「ホーム画面に追加」。以後、Gmail などの「共有」からこのアプリを選ぶと通知を取り込めます。</li>
          <li><strong>iPhone(Safari)</strong>: 共有ボタン →「ホーム画面に追加」。共有ターゲットは非対応なので、本文をコピーして「追加」タブに貼り付けてください。</li>
          <li>アプリの通知そのものは Web からは読めないため、Gmail 同期が基本になります。</li>
        </ul>
      </div>
    </form>`;
  const form = $('#settings-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    s.clientId = fd.get('clientId').trim();
    s.days = Math.max(1, Math.min(365, Number(fd.get('days')) || 60));
    s.query = fd.get('query').trim() || 'from:(airbnb.com OR booking.com)';
    s.hostName = fd.get('hostName').trim();
    persist();
    toast('保存しました');
  });
  $('#btn-connect').addEventListener('click', async () => {
    form.requestSubmit();
    try {
      await gmail.signIn(s.clientId);
      toast('接続しました。「同期」を押してください');
      render();
    } catch (err) { banner(err.message, true); }
  });
  $('#btn-disconnect')?.addEventListener('click', () => { gmail.signOut(); render(); });
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([store.exportJson(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `review-inbox-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#file-import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = store.importJson(await f.text());
      Object.assign(state, data);
      persist();
      toast('読み込みました');
      render();
    } catch (err) { banner('読み込み失敗: ' + err.message, true); }
  });
  $('#btn-reclassify').addEventListener('click', () => {
    // 保存済みの抽出結果を元に分類ロジックだけやり直す(本文は保存していないため件名ベース)
    let n = 0;
    for (const it of Object.values(state.items)) {
      const re = classify({ id: it.id, from: it.from, subject: it.subject, body: it.rawBody || '', date: it.date, source: it.source });
      if (re.kind !== it.kind) n++;
      state.items[it.id] = { ...it, ...re, listing: re.listing || it.listing, guest: re.guest || it.guest, reviewText: re.reviewText || it.reviewText, links: Object.keys(re.links).length ? re.links : it.links };
    }
    persist();
    toast(`再分類しました(${n} 件変更)`);
    render();
  });
  $('#btn-clear').addEventListener('click', () => {
    if (!confirm('すべての通知・メモ・設定を削除します。よろしいですか?')) return;
    store.clearAll();
    location.reload();
  });
}

// ---------- 同期 ----------
async function doSync() {
  const s = state.settings;
  const btn = $('#btn-sync');
  if (!s.clientId) { tab = 'settings'; render(); banner('まず設定タブで OAuth クライアント ID を登録し、Gmail と接続してください'); return; }
  btn.disabled = true;
  banner('');
  try {
    if (!gmail.hasToken()) {
      try { await gmail.signIn(s.clientId, { silent: true }); }
      catch { await gmail.signIn(s.clientId); }
    }
    const query = `${s.query} newer_than:${s.days}d`;
    banner('メール一覧を取得中…');
    const known = new Set(Object.keys(state.items));
    const { results, fetched } = await gmail.sync({
      query,
      knownIds: known,
      onProgress: (d, t) => banner(`取り込み中 ${d}/${t}`),
    });
    let added = 0;
    for (const msg of results) {
      const { existed } = addClassified(msg);
      if (!existed) added++;
    }
    s.lastSync = new Date().toISOString();
    persist();
    banner('');
    toast(fetched ? `${added} 件を取り込みました` : '新着はありません');
    render();
  } catch (err) {
    banner(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------- 共有ターゲット / 起動 ----------
function handleShareTarget() {
  const p = new URLSearchParams(location.search);
  if (!p.has('share') && !p.has('title') && !p.has('text') && !p.has('url')) return false;
  const title = p.get('title') || '';
  const text = p.get('text') || '';
  const url = p.get('url') || '';
  history.replaceState(null, '', location.pathname);
  tab = 'add';
  renderAdd({ subject: title, body: [text, url].filter(Boolean).join('\n') });
  return true;
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; banner(''); render(); }));
$('#btn-sync').addEventListener('click', doSync);

if (!handleShareTarget()) render();
else updateBadges();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 登録失敗', e));
}
