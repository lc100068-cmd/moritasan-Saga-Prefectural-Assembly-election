/**
 * サイト設定
 *
 * API_URL: Google Apps Script をウェブアプリとしてデプロイしたときの URL（末尾が /exec）。
 *          空のままだと data/site.json の内容でサイトが表示され、メルマガ登録は動きません。
 */
window.SITE_CONFIG = {
  API_URL: '',
  FALLBACK_DATA: 'data/site.json',
};
