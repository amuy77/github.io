// 通知メールの分類エンジン。ブラウザ・Node 両方から使える純粋関数のみ。
// 入力: { id, from, subject, body, date(ISO文字列), link? }
// 出力: item(下記 normalizeItem 参照)

export const KINDS = {
  review_posted: 'レビュー公開',
  review_received: 'レビュー到着(未公開)',
  review_reminder: 'レビュー期限リマインド',
  review_request: 'レビュー投稿依頼',
  guest_message: 'ゲストメッセージ',
  inquiry: '問い合わせ',
  booking_confirmed: '予約確定',
  cancellation: 'キャンセル',
  payout: '入金',
  finance: '請求・明細',
  promo: 'お知らせ・宣伝',
  other: 'その他',
};

export const REVIEW_KINDS = new Set(['review_posted', 'review_received', 'review_reminder', 'review_request']);

export const PLATFORMS = { airbnb: 'Airbnb', booking: 'Booking.com', other: 'その他' };

const DATE_RANGE_RE = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日\s*[～~〜\-–]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日/;
const URL_RE = /https?:\/\/\S+/g;

export function detectPlatform(msg) {
  const from = (msg.from || '').toLowerCase();
  if (from.includes('airbnb')) return 'airbnb';
  if (from.includes('booking.com')) return 'booking';
  const text = `${msg.subject || ''}\n${(msg.body || '').slice(0, 2000)}`;
  if (/airbnb/i.test(text)) return 'airbnb';
  if (/booking\.com/i.test(text)) return 'booking';
  return 'other';
}

function cleanBody(body) {
  if (!body) return '';
  return body
    .replace(/[͏­​‌‍﻿⁠-⁤]/g, '') // 見えない詰め物文字
    .replace(/%opentrack%/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n');
}

function lines(body) {
  return cleanBody(body).split('\n').map((l) => l.trim());
}

function isNoise(line) {
  return !line || /^\[?https?:\/\//.test(line) || /詳細を確認|残りあと|総合評価|レビューを投稿|詳細を読む|Airbnb Ireland|Hanover Quay|Dublin/.test(line);
}

// 「2026年8月27日～9月3日」→ { text, checkout: 'YYYY-MM-DD' }
export function parseStayDates(text, refDate) {
  const m = DATE_RANGE_RE.exec(text || '');
  if (!m) return null;
  const ref = refDate ? new Date(refDate) : new Date();
  let year = m[4] ? Number(m[4]) : m[1] ? Number(m[1]) : ref.getFullYear();
  const endMonth = m[5] ? Number(m[5]) : Number(m[2]);
  const endDay = Number(m[6]);
  const startYear = m[1] ? Number(m[1]) : year;
  // 12月27日～1月3日 のように年をまたぐ場合
  if (!m[4] && m[5] && Number(m[5]) < Number(m[2])) year = startYear + 1;
  if (!m[1] && !m[4]) {
    // 年の記載なし: 受信日から見て遠すぎる未来なら前年扱い
    const guess = new Date(year, endMonth - 1, endDay);
    if (guess.getTime() - ref.getTime() > 200 * 86400000) year -= 1;
  }
  const checkout = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { text: m[0].replace(/\s+/g, ''), checkout };
}

function findListingNear(ls, idx, exclude) {
  const ex = (exclude || []).map((s) => (s || '').toLowerCase());
  const candidates = [];
  for (let i = idx + 1; i <= idx + 4 && i < ls.length; i++) candidates.push(ls[i]);
  for (let i = idx - 1; i >= idx - 4 && i >= 0; i--) candidates.push(ls[i]);
  for (const c of candidates) {
    if (isNoise(c)) continue;
    if (ex.includes(c.toLowerCase())) continue;
    if (/^[A-Z][A-Za-z]+$/.test(c)) continue; // 大文字始まりの名前のみの行
    if (c.length < 4) continue;
    return c;
  }
  return '';
}

function extractAirbnbCommon(ls, item, body) {
  const dateIdx = ls.findIndex((l) => DATE_RANGE_RE.test(l));
  if (dateIdx >= 0) {
    const d = parseStayDates(ls[dateIdx], item.date);
    if (d) {
      item.stayDates = d.text;
      item.checkout = d.checkout;
    }
    item.listing = findListingNear(ls, dateIdx, [item.guest, (item.guest || '').toUpperCase()]);
  }
  const hours = /残りあと\s*(\d+)\s*時間/.exec(body);
  const days = /残りあと\s*(\d+)\s*日/.exec(body);
  if (hours) item.hoursLeft = Number(hours[1]);
  else if (days) item.hoursLeft = Number(days[1]) * 24;
  const urls = body.match(URL_RE) || [];
  item.links = {};
  for (const u of urls) {
    const clean = u.replace(/[\])>]+$/, '');
    if (/hosting\/reviews\/\d+\/edit/.test(clean) && !item.links.write) item.links.write = clean;
    if (/users\/reviews\?id=\d+&respond_to=/.test(clean) && !item.links.reply) item.links.reply = clean;
    if (/progress\/reviews\/details\/\d+/.test(clean) && !item.links.details) item.links.details = clean;
  }
}

function classifyAirbnb(msg, item) {
  const s = (msg.subject || '').trim();
  const body = cleanBody(msg.body);
  const ls = lines(body);
  let m;
  if ((m = /^(.+?)さんが(\d)つ星のレビューを投稿しました/.exec(s)) || (m = /^(.+?) (?:left|wrote|gave) you a (\d)-star review/i.exec(s))) {
    item.kind = 'review_posted';
    item.guest = m[1];
    item.rating = Number(m[2]);
  } else if ((m = /^(.+?)さんからレビューが届きました/.exec(s)) || (m = /^(.+?) (?:left|wrote) you a review/i.exec(s))) {
    item.kind = 'review_received';
    item.guest = m[1];
  } else if ((m = /^(.+?)さんがレビューを待っています/.exec(s)) || (m = /^(.+?) is waiting for your review/i.exec(s))) {
    item.kind = 'review_reminder';
    item.guest = m[1];
  } else if ((m = /^(\d+)人のゲストがレビューを待っています/.exec(s)) || /guests? (?:are|is) waiting for (?:your )?reviews?/i.test(s)) {
    item.kind = 'review_reminder';
    item.multi = true;
  } else if ((m = /^(.+?)さんの(?:グループの)?レビューを投稿しよう/.exec(s)) || (m = /^(?:Write|Leave) a review for (.+)$/i.exec(s))) {
    item.kind = 'review_request';
    item.guest = m[1];
  } else if (/^予約確定|予約が確定|^Reservation confirmed|^New booking/i.test(s)) {
    item.kind = 'booking_confirmed';
    const g = /(?:確定しました！|confirmed!\s*)(.+?)さんが(.+?)に到着予定/.exec(body) || /(\S+)さんが(.+?)に到着予定/.exec(s.replace(/^予約確定\s*-\s*/, ''));
    if (g) { item.guest = g[1]; item.arrival = g[2]; }
  } else if (/受取金を送金しました|payout|Payout/i.test(s)) {
    item.kind = 'payout';
    const a = /[¥￥]\s*([\d,]+)/.exec(s) || /([\d,]+)\s*JPY/.exec(s);
    if (a) item.amount = a[1];
  } else if (/キャンセル|cancel/i.test(s)) {
    item.kind = 'cancellation';
  } else if ((m = /^(?:RE:|Re:)?\s*「(.+?)」での(.+?)のご予約(に関する(お問い合わせ|事前承認))?/.exec(s))) {
    item.kind = m[3] ? 'inquiry' : 'guest_message';
    item.listing = m[1];
    const d = parseStayDates(m[2], item.date);
    if (d) { item.stayDates = d.text; item.checkout = d.checkout; }
    // 本文の最初の発言者 「名前 ゲスト/予約者/補助ホスト」 を拾う
    const sp = /\n\s*(\S+)\s+(ゲスト|予約者|補助ホスト|ホスト)\s*\n/.exec('\n' + body);
    if (sp) { item.speaker = sp[1]; item.speakerRole = sp[2]; if (sp[2] !== '補助ホスト' && sp[2] !== 'ホスト') item.guest = sp[1]; }
  } else if (/お問い合わせが来ています|inquiry/i.test(s)) {
    item.kind = 'inquiry';
    const g = /(\S+?)さんからのお問い合わせ/.exec(body);
    if (g) item.guest = g[1];
    const l = /^(.+?)の(\d{4}年.+?)での日程/.exec(s);
    if (l) { item.listing = l[1]; const d = parseStayDates(l[2], item.date); if (d) { item.stayDates = d.text; item.checkout = d.checkout; } }
  } else if (/ニュースレター|交流会|調査|謝礼|newsletter|survey|meetup/i.test(s) || /research\.|events\.|japan\.host/.test((msg.from || '').toLowerCase())) {
    item.kind = 'promo';
  } else {
    item.kind = 'other';
  }

  if (REVIEW_KINDS.has(item.kind)) {
    extractAirbnbCommon(ls, item, body);
    if (item.kind === 'review_posted') {
      const r = /総合評価\s*(\d)/.exec(body);
      if (r) item.rating = Number(r[1]);
      const idx = ls.findIndex((l) => /^総合評価/.test(l));
      if (idx >= 0) {
        const buf = [];
        for (let i = idx + 1; i < ls.length; i++) {
          const l = ls[i];
          if (/^\[?https?:\/\//.test(l) || /^特に感謝|^レビュー全文|^返信を書く/.test(l)) break;
          buf.push(l.replace(/\s*詳細を読む\s*$/, ''));
        }
        item.reviewText = buf.join('\n').replace(/\n{2,}/g, '\n').trim();
      }
      const hi = ls.findIndex((l) => /^特に感謝していること|^What guests loved/.test(l));
      if (hi >= 0) {
        item.highlights = [];
        for (let i = hi + 1; i < ls.length; i++) {
          const l = ls[i];
          if (!l) continue;
          if (/^ほか|^\[?https?:\/\//.test(l) || item.highlights.length >= 8) break;
          item.highlights.push(l);
        }
      }
    }
    if (item.kind === 'review_reminder' && item.multi) {
      // 「N人のゲストがレビューを待っています」: 本文中の各ゲストブロックを展開
      item.guests = [];
      for (let i = 0; i < ls.length; i++) {
        const gm = /^(\S+)\s+詳細を確認/.exec(ls[i]);
        if (!gm) continue;
        const block = ls.slice(i, i + 12).join('\n');
        const d = parseStayDates(block, item.date);
        const h = /残りあと\s*(\d+)\s*時間/.exec(block) || /残りあと\s*(\d+)\s*日/.exec(block);
        const dateLineIdx = ls.slice(i, i + 12).findIndex((l) => DATE_RANGE_RE.test(l));
        item.guests.push({
          guest: gm[1],
          stayDates: d ? d.text : '',
          checkout: d ? d.checkout : '',
          hoursLeft: h ? Number(h[1]) * (/日/.test(h[0]) ? 24 : 1) : undefined,
          listing: dateLineIdx >= 0 ? findListingNear(ls, i + dateLineIdx, [gm[1]]) : '',
        });
      }
      if (item.guests.length === 1) {
        Object.assign(item, item.guests[0]);
        delete item.guests;
        delete item.multi;
      }
    }
  }
}

function classifyBooking(msg, item) {
  const s = (msg.subject || '').trim();
  const from = (msg.from || '').toLowerCase();
  const body = cleanBody(msg.body);
  let m;
  const resNo = /予約番号[：:]\s*(\d{6,})/.exec(body) || /(?:Booking|Reservation) (?:number|ID)[：:]?\s*(\d{6,})/i.exec(body);
  if (resNo) item.reservation = resNo[1];
  if ((m = /^(.+?)様からメッセージが届きました/.exec(s)) || (m = /^(?:New message from|You have a new message from) (.+)$/i.exec(s)) || from.includes('@guest.booking.com')) {
    item.kind = 'guest_message';
    if (m) item.guest = m[1];
    const t = /様のメッセージ[：:]\s*([\s\S]*?)\n\s*返信/.exec(body) || /message[：:]\s*([\s\S]*?)\n\s*Reply/i.exec(body);
    if (t) item.messageText = t[1].trim();
  } else if (/クチコミ|口コミ|レビュー|review|評価/i.test(s) && !/セール|割引|Genius|キャンペーン/.test(s)) {
    item.kind = 'review_posted';
    const g = /^(.+?)(?:様|さん)(?:が|から)/.exec(s)
      || /(?:from|by) (.+?)(?: for|$)/i.exec(s)
      || /(?:^|\n)\s*(.+?)(?:様|さん)が.{0,20}?(?:クチコミ|口コミ|レビュー)/.exec(body)
      || /(?:^|\n)\s*(.+?) (?:left|wrote|posted) a review/i.exec(body);
    if (g) item.guest = g[1].trim();
    const sc = /(\d{1,2}(?:[.,]\d)?)\s*(?:点|\/\s*10|out of 10)/.exec(s + '\n' + body);
    if (sc) item.rating = Number(sc[1].replace(',', '.'));
    const t = /(?:コメント|クチコミ内容|Review)[：:]\s*([\s\S]{0,600}?)\n\n/.exec(body);
    if (t) item.reviewText = t[1].trim();
  } else if (/Booking\.comから新規メッセージ|new message/i.test(s)) {
    item.kind = 'guest_message';
  } else if (/新規予約|新しい予約|予約確認|New (?:booking|reservation)/i.test(s)) {
    item.kind = 'booking_confirmed';
    const g = /(?:ゲスト名|Guest name)[：:]\s*(.+)/.exec(body);
    if (g) item.guest = g[1].trim();
  } else if (/キャンセル|cancell?ation|cancelled/i.test(s)) {
    item.kind = 'cancellation';
  } else if (/Invoice|請求|支払い|Payout|振込/i.test(s)) {
    item.kind = 'finance';
  } else if (from.includes('email.campaign') || from.includes('properties.booking.com') || /セール|割引|Genius|アンケート|Partner Hub|パフォーマンス/i.test(s)) {
    item.kind = 'promo';
  } else {
    item.kind = 'other';
  }
  const urls = body.match(URL_RE) || [];
  item.links = {};
  for (const u of urls) {
    const clean = u.replace(/[\])>]+$/, '');
    if (/admin\.booking\.com/.test(clean) && !item.links.reply) item.links.reply = clean;
  }
}

export function classify(msg) {
  const item = {
    id: msg.id || hashId(`${msg.from}|${msg.subject}|${msg.date}|${(msg.body || '').slice(0, 200)}`),
    from: msg.from || '',
    subject: msg.subject || '',
    date: msg.date || new Date().toISOString(),
    platform: detectPlatform(msg),
    kind: 'other',
    guest: '',
    listing: '',
    stayDates: '',
    checkout: '',
    rating: undefined,
    reviewText: '',
    links: {},
    snippet: cleanBody(msg.body).replace(/\s+/g, ' ').slice(0, 160),
    source: msg.source || 'gmail',
  };
  if (item.platform === 'airbnb') classifyAirbnb(msg, item);
  else if (item.platform === 'booking') classifyBooking(msg, item);
  else item.kind = 'other';
  if (item.guest) item.guest = item.guest.replace(/\s+/g, ' ').trim();
  return item;
}

export function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'm' + h.toString(36);
}

// ---------- レビュー案件(ゲスト×滞在)への集約 ----------

export const AIRBNB_REVIEW_WINDOW_DAYS = 14;

function normGuest(name) {
  return (name || '').toLowerCase().replace(/さん$|様$/, '').split(/\s+/)[0] || '';
}

export function caseKey(platform, guest, checkout) {
  return `${platform}|${normGuest(guest)}|${checkout || ''}`;
}

// items: 分類済みアイテム配列 → 案件配列。同じゲストで checkout が不明なものは近い案件へ吸収。
export function buildCases(items) {
  const reviewItems = [];
  for (const it of items) {
    if (!REVIEW_KINDS.has(it.kind)) continue;
    if (it.guests) {
      for (const g of it.guests) reviewItems.push({ ...it, ...g, guests: undefined, multi: undefined, id: `${it.id}#${normGuest(g.guest)}` });
    } else reviewItems.push(it);
  }
  const byGuest = new Map();
  for (const it of reviewItems) {
    const k = `${it.platform}|${normGuest(it.guest)}`;
    if (!byGuest.has(k)) byGuest.set(k, []);
    byGuest.get(k).push(it);
  }
  const cases = [];
  for (const [, list] of byGuest) {
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    const groups = [];
    for (const it of list) {
      let g = groups.find((gr) => (it.checkout && gr.checkout && it.checkout === gr.checkout) || (!it.checkout || !gr.checkout) && Math.abs(new Date(it.date) - new Date(gr.lastDate)) < 30 * 86400000);
      if (!g) {
        g = { items: [], checkout: it.checkout, lastDate: it.date };
        groups.push(g);
      }
      g.items.push(it);
      if (!g.checkout && it.checkout) g.checkout = it.checkout;
      g.lastDate = it.date;
    }
    for (const g of groups) cases.push(makeCase(g.items));
  }
  cases.sort((a, b) => {
    const pa = stagePriority(a.stage), pb = stagePriority(b.stage);
    if (pa !== pb) return pa - pb;
    return (a.deadline || '9999').localeCompare(b.deadline || '9999') || new Date(b.lastDate) - new Date(a.lastDate);
  });
  return cases;
}

function stagePriority(stage) {
  return { write: 0, reply: 1, done: 2 }[stage] ?? 3;
}

function makeCase(items) {
  const first = items[0];
  const c = {
    key: caseKey(first.platform, first.guest, items.find((i) => i.checkout)?.checkout || ''),
    platform: first.platform,
    guest: items.map((i) => i.guest).find(Boolean) || '',
    listing: items.map((i) => i.listing).find(Boolean) || '',
    stayDates: items.map((i) => i.stayDates).find(Boolean) || '',
    checkout: items.map((i) => i.checkout).find(Boolean) || '',
    rating: items.map((i) => i.rating).find((r) => r !== undefined),
    reviewText: items.map((i) => i.reviewText).find(Boolean) || '',
    highlights: items.map((i) => i.highlights).find(Boolean) || [],
    links: Object.assign({}, ...items.map((i) => i.links || {})),
    itemIds: items.map((i) => i.id),
    kinds: [...new Set(items.map((i) => i.kind))],
    lastDate: items[items.length - 1].date,
    posted: items.some((i) => i.kind === 'review_posted'),
    deadline: '',
  };
  // 期限: リマインドの残り時間が最も正確。なければ checkout + 14日。
  const reminders = items.filter((i) => i.hoursLeft !== undefined);
  if (reminders.length) {
    const r = reminders[reminders.length - 1];
    c.deadline = new Date(new Date(r.date).getTime() + r.hoursLeft * 3600000).toISOString();
  } else if (c.checkout && c.platform === 'airbnb') {
    const d = new Date(c.checkout + 'T00:00:00');
    d.setDate(d.getDate() + AIRBNB_REVIEW_WINDOW_DAYS);
    c.deadline = d.toISOString();
  }
  c.stage = c.posted ? 'reply' : 'write';
  return c;
}

// ユーザー操作の状態を反映して最終ステージを決める
export function applyState(c, state) {
  const st = state || {};
  const out = { ...c, state: st };
  if (st.archived) out.stage = 'done';
  else if (c.posted) out.stage = st.replied ? 'done' : 'reply';
  else out.stage = st.hostReviewDone ? 'done' : 'write';
  if (out.stage === 'write' && out.deadline && new Date(out.deadline) < new Date()) out.expired = true;
  return out;
}

export const STAGES = { write: '要投稿', reply: '返信推奨', done: '完了' };
