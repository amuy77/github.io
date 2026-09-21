import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, buildCases, applyState, parseStayDates } from '../js/classifier.js';

const LISTING = '[SAMPLE STAY] 駅徒歩5分｜テスト用の宿｜2BR';

const posted = {
  id: 'a1',
  from: 'automated@airbnb.com',
  subject: 'Aliceさんが5つ星のレビューを投稿しました！',
  date: '2026-09-13T07:08:07Z',
  body: `続きを読んで、満足してもらえた部分を確認しましょう
 ͏  ͏  ͏  ͏ ­ ­ ­
%opentrack%

https://www.airbnb.jp/?c=xxx

ALICEさんが滞⁠在⁠に⁠つ⁠い⁠て5⁠つ⁠星⁠評⁠価⁠をつ⁠け⁠ま⁠し⁠た

Aliceさんから、滞在についての高評価レビューが投稿されました。

滞在に関するゲストからのフィードバック

   ${LISTING}

   2026年9月4日～12日

[https://www.airbnb.jp/progress/reviews/details/1111?c=xxx]

総合評価 5

We had a wonderful time here - it was 4 of us and we still felt
like we had our own space 詳細を読む
[https://www.airbnb.jp/progress/reviews/details/1111?c=xxx]

特に感謝していること

   整頓されていた

   バスルームがきれいだった

ほか17件

レビュー全文を読む 返信を書く
[https://www.airbnb.jp/progress/reviews/details/1111?c=xxx] [https://www.airbnb.jp/users/reviews?id=999&respond_to=1111&c=xxx]

Airbnb Ireland UC
`,
};

const received = {
  id: 'a2',
  from: 'automated@airbnb.com',
  subject: 'Aliceさんからレビューが届きました',
  date: '2026-09-12T06:04:43Z',
  body: `%opentrack%
https://www.airbnb.jp/?c=xxx

ALICEさんが書いた内容を読もう

   Alice

   9月4日～12日
   ${LISTING}

Aliceさんからのレビューは、ご自身がレビューを投稿した後に読むことができます。

レビューを投稿
[https://www.airbnb.jp/hosting/reviews/2222/edit?entry_source=email]
`,
};

const reminder = {
  id: 'a3',
  from: 'automated@airbnb.com',
  subject: 'Bobさんがレビューを待っています',
  date: '2026-09-16T06:34:11Z',
  body: `貴重なフィードバックをお待ちしております。
%opentrack%

BOBさんにレビューをお願いします

   BOB 詳細を確認
                     [https://www.airbnb.jp/hosting/reviews/3333/edit?c=xxx]
   2026年8月27日～9月3日

   ${LISTING}

   残りあと16時間
`,
};

const request = {
  id: 'a4',
  from: 'automated@airbnb.com',
  subject: 'Bobさんのグループのレビューを投稿しよう',
  date: '2026-09-03T04:19:21Z',
  body: `Bobさんの滞在はいかがでしたか？ Bobさん御一行様が先ほどチェックアウトしました。レビューを書くなら今がベストです。
レビューを投稿
[https://www.airbnb.jp/hosting/reviews/3333/edit]
`,
};

const digest = {
  id: 'a5',
  from: 'automated@airbnb.com',
  subject: '2人のゲストがレビューを待っています',
  date: '2026-09-12T06:30:14Z',
  body: `貴重なフィードバックをお待ちしております。

   BOB 詳細を確認
   [https://www.airbnb.jp/hosting/reviews/3333/edit]
   2026年8月27日～9月3日

   ${LISTING}

   残りあと4日

   CAROL 詳細を確認
   [https://www.airbnb.jp/hosting/reviews/4444/edit]
   2026年9月1日～5日

   ${LISTING}

   残りあと7日
`,
};

const bookingMsg = {
  id: 'b1',
  from: '6255887259-759r.an4c@guest.booking.com',
  subject: 'DAVE PARK様からメッセージが届きました',
  date: '2026-09-18T00:25:32Z',
  body: `##- 返信内容はこの行より上に入力してください -##
予約番号： 6255887259
ゲストからの新着メッセージです
DAVE PARK様のメッセージ：
네.감사합니다.
返信 --> https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/messaging/inbox.html?res_id=1
`,
};

const bookingPromo = {
  id: 'b2',
  from: 'email.campaign@sg.booking.com',
  subject: '札幌市の宿が最大20%OFF🙌Geniusレベル3の割引を活用しよう',
  date: '2026-09-20T02:28:18Z',
  body: '﻿ ﻿ ﻿',
};

const bookingReview = {
  id: 'b3',
  from: 'noreply@booking.com',
  subject: 'Hotel Sample: 新しいクチコミが投稿されました',
  date: '2026-09-19T02:28:18Z',
  body: `Erin様が貴施設にクチコミを投稿しました。
スコア: 9.2 / 10
コメント: とても清潔で快適でした。

返信する https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/reviews.html
`,
};

test('Airbnb: 公開済みレビューを解析する', () => {
  const it = classify(posted);
  assert.equal(it.platform, 'airbnb');
  assert.equal(it.kind, 'review_posted');
  assert.equal(it.guest, 'Alice');
  assert.equal(it.rating, 5);
  assert.equal(it.listing, LISTING);
  assert.equal(it.stayDates, '2026年9月4日～12日');
  assert.equal(it.checkout, '2026-09-12');
  assert.match(it.reviewText, /wonderful time/);
  assert.ok(!/詳細を読む/.test(it.reviewText));
  assert.deepEqual(it.highlights, ['整頓されていた', 'バスルームがきれいだった']);
  assert.match(it.links.reply, /respond_to=1111/);
});

test('Airbnb: 未公開レビュー到着', () => {
  const it = classify(received);
  assert.equal(it.kind, 'review_received');
  assert.equal(it.guest, 'Alice');
  assert.equal(it.listing, LISTING);
  assert.equal(it.checkout, '2026-09-12');
  assert.match(it.links.write, /reviews\/2222\/edit/);
});

test('Airbnb: リマインドと残り時間', () => {
  const it = classify(reminder);
  assert.equal(it.kind, 'review_reminder');
  assert.equal(it.guest, 'Bob');
  assert.equal(it.hoursLeft, 16);
  assert.equal(it.checkout, '2026-09-03');
  assert.equal(it.listing, LISTING);
});

test('Airbnb: チェックアウト後の投稿依頼', () => {
  const it = classify(request);
  assert.equal(it.kind, 'review_request');
  assert.equal(it.guest, 'Bob');
});

test('Airbnb: 複数ゲストのダイジェストを展開する', () => {
  const it = classify(digest);
  assert.equal(it.kind, 'review_reminder');
  assert.equal(it.guests.length, 2);
  assert.equal(it.guests[0].guest, 'BOB');
  assert.equal(it.guests[0].hoursLeft, 96);
  assert.equal(it.guests[1].guest, 'CAROL');
  assert.equal(it.guests[1].checkout, '2026-09-05');
});

test('Airbnb: 予約確定・入金・メッセージ', () => {
  const b = classify({ from: 'automated@airbnb.com', subject: '予約確定 - 11月25日にPangDouglasさんが到着予定', date: '2026-09-16T04:34:12Z', body: 'Airbnb 新規予約が確定しました！Douglasさんが11月25日に到着予定です。' });
  assert.equal(b.kind, 'booking_confirmed');
  assert.equal(b.guest, 'Douglas');
  const p = classify({ from: 'automated@airbnb.com', subject: '¥ 115,065JPYの受取金を送金しました', date: '2026-09-20T04:25:49Z', body: '' });
  assert.equal(p.kind, 'payout');
  assert.equal(p.amount, '115,065');
  const m = classify({ from: 'express@airbnb.com', subject: `RE:「${LISTING}」での9月19日～24日のご予約`, date: '2026-09-19T03:03:24Z', body: `Airbnb 「${LISTING}」での9月19日～24日のご予約\n\nJair 予約者\n情報を入力しました。\n返信` });
  assert.equal(m.kind, 'guest_message');
  assert.equal(m.listing, LISTING);
  assert.equal(m.guest, 'Jair');
  assert.equal(m.checkout, '2026-09-24');
  const q = classify({ from: 'express@airbnb.com', subject: `RE:「${LISTING}」での12月27日～1月3日のご予約に関するお問い合わせ`, date: '2026-09-02T01:23:30Z', body: '' });
  assert.equal(q.kind, 'inquiry');
  assert.equal(q.checkout, '2027-01-03');
  const n = classify({ from: 'japan.host@airbnb.com', subject: 'Airbnb 日本ホストニュースレター（2026年第9号）', date: '2026-09-18T23:54:27Z', body: '' });
  assert.equal(n.kind, 'promo');
});

test('Booking: ゲストメッセージ・宣伝・クチコミ', () => {
  const m = classify(bookingMsg);
  assert.equal(m.platform, 'booking');
  assert.equal(m.kind, 'guest_message');
  assert.equal(m.guest, 'DAVE PARK');
  assert.equal(m.reservation, '6255887259');
  assert.equal(m.messageText, '네.감사합니다.');
  assert.match(m.links.reply, /admin\.booking\.com/);
  assert.equal(classify(bookingPromo).kind, 'promo');
  const r = classify(bookingReview);
  assert.equal(r.kind, 'review_posted');
  assert.equal(r.guest, 'Erin');
  assert.equal(r.rating, 9.2);
  assert.match(r.reviewText, /清潔/);
});

test('案件への集約と期限', () => {
  const items = [posted, received, reminder, request, digest, bookingReview].map(classify);
  const cases = buildCases(items);
  const alice = cases.find((c) => c.guest === 'Alice');
  assert.ok(alice);
  assert.equal(alice.posted, true);
  assert.equal(alice.stage, 'reply');
  assert.equal(alice.itemIds.length, 2);
  assert.equal(alice.rating, 5);
  const bob = cases.find((c) => /bob/i.test(c.guest));
  assert.ok(bob);
  assert.equal(bob.itemIds.length, 3, 'reminder + request + digest entry');
  assert.equal(bob.stage, 'write');
  // 最後のリマインド(9/16 06:34 + 16h) が期限
  assert.equal(bob.deadline, '2026-09-16T22:34:11.000Z');
  const carol = cases.find((c) => /carol/i.test(c.guest));
  assert.ok(carol);
  assert.equal(carol.checkout, '2026-09-05');
  const erin = cases.find((c) => c.guest === 'Erin');
  assert.equal(erin.platform, 'booking');
  assert.equal(erin.stage, 'reply');
  // 状態反映
  assert.equal(applyState(alice, { replied: true }).stage, 'done');
  assert.equal(applyState(bob, { hostReviewDone: true }).stage, 'done');
  assert.equal(applyState(bob, {}).expired, true);
  // 並び: 要投稿 → 返信推奨 → 完了
  assert.equal(cases[0].stage, 'write');
});

test('日付範囲の年推定', () => {
  assert.equal(parseStayDates('12月27日～1月3日', '2026-09-02T00:00:00Z').checkout, '2027-01-03');
  assert.equal(parseStayDates('2026年8月27日～9月3日', '2026-09-16T00:00:00Z').checkout, '2026-09-03');
  assert.equal(parseStayDates('9月4日～12日', '2026-09-12T00:00:00Z').checkout, '2026-09-12');
  assert.equal(parseStayDates('2026年12月27日～2027年1月3日', '2026-09-02T00:00:00Z').checkout, '2027-01-03');
});
