/**
 * サイト設定
 *
 * API_URL: Google Apps Script をウェブアプリとしてデプロイしたときの URL（末尾が /exec）。
 *          空のままだと data/site.json の内容でサイトが表示され、メルマガ登録は動きません。
 *
 * NEWSLETTER_ENABLED: メルマガ登録の表示。いまは保留中のため false（非表示）。
 *          true にすると、メルマガのセクション・ナビの「メルマガ登録」・
 *          最初の画面の「活動報告をメールで受け取る」がそのまま復活します。
 */
window.SITE_CONFIG = {
  API_URL: '',
  FALLBACK_DATA: 'data/site.json',
  NEWSLETTER_ENABLED: false,
};
