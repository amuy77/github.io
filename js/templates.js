// レビュー・返信の文例。案件(case)とホスト名から日本語+英語の下書きを作る。

function name(c) {
  return c.guest || 'ゲスト';
}
function sign(hostName) {
  return hostName ? `\n${hostName}` : '';
}

// ホストがゲストに書くレビュー(公開される)
export function hostReviewTemplate(c) {
  const g = name(c);
  return [
    `${g}さんはとても丁寧で、コミュニケーションもスムーズなゲストでした。お部屋もきれいに使っていただき、ハウスルールも守ってくださいました。ぜひまたお迎えしたいゲストです。`,
    '',
    `${g} was a wonderful guest: great communication, left the place clean and tidy, and respected all house rules. We'd be happy to host them again anytime!`,
  ].join('\n');
}

// 公開されたレビューへの返信
export function replyTemplate(c, hostName) {
  const g = name(c);
  const low = c.rating !== undefined && ((c.platform === 'booking' && c.rating < 7) || (c.platform !== 'booking' && c.rating <= 3));
  if (low) {
    return [
      `${g}さん、この度はご滞在とご意見をありがとうございました。ご期待に沿えなかった点があり申し訳ございません。いただいたご指摘は真摯に受け止め、改善に取り組んでまいります。またの機会がございましたら、より快適にお過ごしいただけるよう努めます。${sign(hostName)}`,
      '',
      `Thank you for staying with us and for your honest feedback, ${g}. We're sorry we fell short of your expectations. We take your comments seriously and are already working on improvements. We hope to have the chance to welcome you again and offer a better experience.${sign(hostName)}`,
    ].join('\n');
  }
  return [
    `${g}さん、この度はご滞在と素敵なレビューをありがとうございました！快適にお過ごしいただけたようで何よりです。またのお越しを心よりお待ちしております。${sign(hostName)}`,
    '',
    `Thank you so much for staying with us and for the lovely review, ${g}! We're delighted you enjoyed your stay. We'd love to welcome you back anytime.${sign(hostName)}`,
  ].join('\n');
}
