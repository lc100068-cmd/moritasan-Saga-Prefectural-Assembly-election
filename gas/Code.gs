/**
 * 森田浩文 活動サイト バックエンド（Google Apps Script）
 *
 * このスクリプトは「スプレッドシートに紐づいた（コンテナバインド）」形で使います。
 *  - 公開サイト用 API   : GET  ?action=content      … サイトに表示する内容(JSON)
 *  - メルマガ登録       : POST action=subscribe      … 登録フォームの受け口
 *  - 登録確認 / 配信停止 : GET  ?action=confirm / ?action=unsubscribe
 *  - 管理画面           : GET  （パラメータなし）     … 管理者のみ表示
 *
 * セットアップ手順は docs/SETUP.md を参照してください。
 */

const TZ = 'Asia/Tokyo';
const QUOTA_RESERVE = 5;          // 1日の送信上限のうち、テスト送信などのために残しておく通数
const BATCH_TIME_LIMIT_MS = 4.5 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

const HEADERS = {
  settings:    ['key', 'value', 'note'],
  profile:     ['label', 'value'],
  policies:    ['title', 'summary', 'detail'],
  history:     ['date', 'title', 'detail'],
  sns:         ['platform', 'label', 'url'],
  instagram:   ['url'],
  posts:       ['id', 'date', 'title', 'body', 'image_url', 'link_url', 'status', 'created_at', 'updated_at', 'sent_at', 'sent_count'],
  subscribers: ['email', 'name', 'status', 'token', 'consent_text', 'requested_at', 'confirmed_at', 'unsubscribed_at', 'source'],
  queue:       ['post_id', 'email', 'queued_at'],
  send_log:    ['timestamp', 'type', 'post_id', 'subject', 'count', 'actor', 'note'],
};

// サイトの一覧系（管理画面の「サイト情報」で編集できるもの）
const LIST_SHEETS = ['profile', 'policies', 'history', 'sns', 'instagram'];

// 公開APIに出さない設定キー
const PRIVATE_SETTING_KEYS = ['mail_sender_name', 'mail_footer', 'double_opt_in'];

const DEFAULT_CONSENT =
  '森田浩文（事務所）から、活動報告および選挙に関する情報（選挙運動用電子メールを含む）をメールで受け取ることに同意します。';

const SEED = {
  settings: [
    ['candidate_name', '森田 浩文', '表示名'],
    ['candidate_kana', 'もりた ひろふみ', 'ふりがな（要確認）'],
    ['election_label', '佐賀県議会議員選挙 2027', 'トップに出る小見出し'],
    ['district', '選挙区：〇〇〇〇', '選挙区名'],
    ['catchphrase', '【サンプル】ふるさと佐賀の声を、まっすぐ県政へ。', 'キャッチコピー'],
    ['lead', '【サンプル】ここにご本人の思いを2〜3行で書きます。地域を歩き、聞いた声を形にする——そんな活動を続けています。', 'リード文'],
    ['photo_url', '', '顔写真のURL（空なら仮画像）'],
    ['bio', '【サンプル】ここに自己紹介文を入れます。生い立ち、これまでの仕事、政治を志したきっかけなどを書きます。', 'プロフィール本文'],
    ['newsletter_lead', '日々の活動報告をメールでお届けします。いつでも配信停止できます。', 'メルマガ欄の説明'],
    ['consent_text', DEFAULT_CONSENT, '登録時の同意文（記録されます）'],
    ['office_name', '森田浩文 事務所', '事務所名'],
    ['office_address', '佐賀県〇〇市〇〇町 0-0-0', '住所'],
    ['office_tel', '0952-00-0000', '電話番号'],
    ['office_email', '', '問い合わせ用メールアドレス'],
    ['site_operator', '森田浩文 事務所', 'サイト運営者の表示'],
    ['site_url', '', '公開サイトのURL'],
    ['notice_date', '2027-04-02', '告示日（YYYY-MM-DD）'],
    ['election_date', '2027-04-11', '投票日（YYYY-MM-DD）'],
    ['mail_sender_name', '森田浩文', 'メール差出人名'],
    ['mail_footer', '森田浩文 事務所\n佐賀県〇〇市〇〇町 0-0-0', 'メール末尾の署名'],
    ['double_opt_in', 'TRUE', '登録時に確認メールを送るか'],
  ],
  profile: [
    ['生年月日', '【要入力】'],
    ['出身', '【要入力】'],
    ['学歴', '【要入力】'],
    ['職歴', '【要入力】'],
    ['家族', '【要入力】'],
    ['趣味', '【要入力】'],
  ],
  policies: [
    ['【サンプル】子育て・教育', '安心して子どもを産み育てられる佐賀へ。', 'ここに具体的な取り組みを書きます。'],
    ['【サンプル】地域の産業', '農業・ものづくりを次の世代へ。', 'ここに具体的な取り組みを書きます。'],
    ['【サンプル】防災・暮らし', '災害に強く、誰もが暮らしやすいまちに。', 'ここに具体的な取り組みを書きます。'],
  ],
  history: [
    ['20XX年', '【サンプル】〇〇の活動を開始', '活動の内容を書きます。'],
    ['20XX年', '【サンプル】〇〇に就任', '活動の内容を書きます。'],
    ['2026年', '【サンプル】県政への挑戦を表明', '活動の内容を書きます。'],
  ],
  sns: [
    ['instagram', 'Instagram', 'https://www.instagram.com/'],
    ['x', 'X（旧Twitter）', 'https://x.com/'],
    ['facebook', 'Facebook', 'https://www.facebook.com/'],
  ],
  instagram: [],
  posts: [],
};

/* ============================================================
 * 初期設定（Apps Script エディタから一度だけ実行）
 * ============================================================ */
function setup() {
  requireAdmin_();
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      const head = HEADERS[name];
      // 日付や TRUE などが勝手に変換されないよう、書式なしテキストにしてから書き込む
      sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e8eef6');
      sh.setFrozenRows(1);
      const seed = SEED[name];
      if (seed && seed.length) sh.getRange(2, 1, seed.length, head.length).setValues(seed);
    }
  });
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_EMAILS')) {
    props.setProperty('ADMIN_EMAILS', Session.getEffectiveUser().getEmail());
  }
  clearContentCache_();
  Logger.log('セットアップ完了。管理者: ' + props.getProperty('ADMIN_EMAILS'));
}

/* ============================================================
 * Web エンドポイント
 * ============================================================ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  switch (p.action) {
    case 'content':
      return json_({ ok: true, data: getPublicContent_() });
    case 'confirm':
      return confirmPage_(p);
    case 'unsubscribe':
      return unsubscribePage_(p);
  }
  if (!isAdmin_()) {
    return page_('管理画面', '<p>この画面は管理者専用です。運営用のGoogleアカウントでログインしてから開いてください。</p>' +
      '<p class="muted">複数のGoogleアカウントに同時ログインしていると正しく判定されないことがあります。その場合はシークレットウィンドウでお試しください。</p>');
  }
  rememberWebAppUrl_();
  return HtmlService.createHtmlOutputFromFile('Admin')
    .setTitle('管理画面 | ' + (readSettings_().candidate_name || ''))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'subscribe') return json_(handleSubscribe_(p));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: '処理中にエラーが発生しました。時間をおいて再度お試しください。' });
  }
}

/* ============================================================
 * 公開コンテンツ
 * ============================================================ */
function getPublicContent_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('content');
  if (cached) return JSON.parse(cached);

  const all = readSettings_();
  const settings = {};
  Object.keys(all).forEach(function (k) {
    if (PRIVATE_SETTING_KEYS.indexOf(k) < 0) settings[k] = all[k];
  });
  const data = {
    settings: settings,
    profile: readTable_('profile'),
    policies: readTable_('policies'),
    history: readTable_('history'),
    sns: readTable_('sns'),
    instagram: readTable_('instagram'),
    posts: readTable_('posts')
      .filter(function (r) { return r.status === 'published'; })
      .sort(byDateDesc_)
      .map(function (r) {
        return { id: r.id, date: r.date, title: r.title, body: r.body, image_url: r.image_url, link_url: r.link_url };
      }),
    generated_at: nowStr_(),
  };
  try { cache.put('content', JSON.stringify(data), 300); } catch (err) { /* 大きすぎる場合はキャッシュしない */ }
  return data;
}

function clearContentCache_() {
  CacheService.getScriptCache().remove('content');
}

/* ============================================================
 * メルマガ登録・確認・停止
 * ============================================================ */
function handleSubscribe_(p) {
  if (p.website) return { ok: true, status: 'pending' }; // ハニーポット（ボット対策）

  const email = String(p.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'メールアドレスの形式が正しくありません。' };
  }
  if (p.consent !== 'yes') return { ok: false, error: '配信への同意が必要です。' };
  const name = String(p.name || '').trim().slice(0, 50);

  const cache = CacheService.getScriptCache();
  if (cache.get('sub:' + email)) return { ok: false, error: '少し時間をおいてから再度お試しください。' };
  const burst = Number(cache.get('sub:burst') || 0);
  if (burst > 30) return { ok: false, error: 'ただいま混み合っています。時間をおいて再度お試しください。' };
  cache.put('sub:burst', String(burst + 1), 60);
  cache.put('sub:' + email, '1', 60);

  const settings = readSettings_();
  const doubleOptIn = !isFalse_(settings.double_opt_in);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let token, status;
  try {
    const t = openTable_('subscribers');
    const i = t.rows.findIndex(function (r) { return String(r.email).toLowerCase() === email; });
    if (i >= 0 && t.rows[i].status === 'active') return { ok: true, status: 'already' };

    token = newToken_();
    status = doubleOptIn ? 'pending' : 'active';
    const row = {
      email: email,
      name: name || (i >= 0 ? t.rows[i].name : ''),
      status: status,
      token: token,
      consent_text: settings.consent_text || DEFAULT_CONSENT,
      requested_at: nowStr_(),
      confirmed_at: doubleOptIn ? '' : nowStr_(),
      unsubscribed_at: '',
      source: String(p.source || 'site').slice(0, 30),
    };
    if (i >= 0) t.update(i, row); else t.append(row);
  } finally {
    lock.releaseLock();
  }

  if (doubleOptIn) sendConfirmMail_(email, name, token, settings);
  return { ok: true, status: status };
}

function sendConfirmMail_(email, name, token, s) {
  const url = webAppUrl_() + '?action=confirm&token=' + token;
  const who = name ? name + ' 様' : 'ご登録者様';
  const text = [
    who, '',
    (s.candidate_name || '') + ' のメールマガジンへのご登録ありがとうございます。',
    '以下のURLを開き、登録を完了してください。', '',
    url, '',
    'お心当たりがない場合は、このメールを破棄してください。登録は完了しません。', '',
    '――', s.mail_footer || s.office_name || '',
  ].join('\n');
  const html =
    '<p>' + esc_(who) + '</p>' +
    '<p>' + esc_(s.candidate_name || '') + ' のメールマガジンへのご登録ありがとうございます。<br>下のボタンから登録を完了してください。</p>' +
    '<p><a href="' + url + '" style="display:inline-block;padding:12px 24px;background:#17365d;color:#fff;border-radius:6px;text-decoration:none">登録を完了する</a></p>' +
    '<p style="color:#666;font-size:13px">お心当たりがない場合は、このメールを破棄してください。登録は完了しません。</p>' +
    '<hr><p style="color:#666;font-size:13px">' + nl2br_(esc_(s.mail_footer || s.office_name || '')) + '</p>';
  sendMail_(email, '【確認】メールマガジン登録の手続き', text, html, s);
}

function confirmPage_(p) {
  const t = openTable_('subscribers');
  const i = t.rows.findIndex(function (r) { return p.token && r.token === p.token; });
  if (i < 0) return page_('リンクが無効です', '<p>このリンクは無効か、期限切れです。お手数ですが、もう一度サイトから登録してください。</p>');
  const r = t.rows[i];
  if (r.status === 'active') return page_('登録済みです', '<p>すでに登録が完了しています。</p>');
  if (p.confirm !== '1') {
    return page_('登録の確認', '<p>' + esc_(r.email) + ' をメールマガジンに登録します。</p>' +
      actionForm_('confirm', p.token, '登録を完了する'));
  }
  t.update(i, { status: 'active', confirmed_at: nowStr_(), unsubscribed_at: '' });
  return page_('登録が完了しました', '<p>ご登録ありがとうございます。活動報告をお届けします。</p><p>配信停止は、各メール末尾のリンクからいつでも行えます。</p>');
}

function unsubscribePage_(p) {
  const t = openTable_('subscribers');
  const i = t.rows.findIndex(function (r) { return p.token && r.token === p.token; });
  if (i < 0) return page_('リンクが無効です', '<p>このリンクは無効です。お手数ですが事務所までご連絡ください。</p>');
  const r = t.rows[i];
  if (r.status === 'unsubscribed') return page_('配信停止済みです', '<p>すでに配信を停止しています。</p>');
  if (p.confirm !== '1') {
    return page_('配信停止', '<p>' + esc_(r.email) + ' へのメール配信を停止します。</p>' +
      actionForm_('unsubscribe', p.token, '配信を停止する'));
  }
  t.update(i, { status: 'unsubscribed', unsubscribed_at: nowStr_() });
  return page_('配信を停止しました', '<p>今後、メールマガジンは届きません。これまでお読みいただきありがとうございました。</p>');
}

/* ============================================================
 * 管理画面 API（google.script.run から呼ばれる）
 * すべて requireAdmin_() で管理者チェックを行う
 * ============================================================ */
function apiBootstrap() {
  requireAdmin_();
  const s = readSettings_();
  const subs = readTable_('subscribers');
  const posts = readTable_('posts').sort(byDateDesc_);
  const count = function (st) { return subs.filter(function (r) { return r.status === st; }).length; };
  const weekAgo = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), TZ, 'yyyy-MM-dd');
  const lists = {};
  LIST_SHEETS.forEach(function (n) { lists[n] = readTable_(n); });
  return {
    user: currentEmail_(),
    settingsRows: readTable_('settings'),
    lists: lists,
    posts: posts,
    stats: {
      active: count('active'),
      pending: count('pending'),
      unsubscribed: count('unsubscribed'),
      newThisWeek: subs.filter(function (r) { return r.status === 'active' && String(r.confirmed_at || r.requested_at) >= weekAgo; }).length,
      published: posts.filter(function (p) { return p.status === 'published'; }).length,
      queue: Math.max(0, sheet_('queue').getLastRow() - 1),
      quota: MailApp.getRemainingDailyQuota(),
    },
    phase: phase_(s),
    today: today_(),
    noticeDate: s.notice_date,
    electionDate: s.election_date,
    siteUrl: s.site_url || '',
    apiUrl: webAppUrl_(),
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
  };
}

function apiSaveSettings(obj) {
  requireAdmin_();
  guardNotElectionDay_();
  const t = openTable_('settings');
  Object.keys(obj || {}).forEach(function (key) {
    const i = t.rows.findIndex(function (r) { return r.key === key; });
    const value = String(obj[key] == null ? '' : obj[key]);
    if (i >= 0) t.update(i, { value: value }); else t.append({ key: key, value: value, note: '' });
  });
  clearContentCache_();
  log_('settings', '', '', 0, '');
  return true;
}

function apiSaveList(name, rows) {
  requireAdmin_();
  guardNotElectionDay_();
  if (LIST_SHEETS.indexOf(name) < 0) throw new Error('不正なシート名です。');
  const head = HEADERS[name];
  const clean = (rows || [])
    .map(function (r) { return head.map(function (h) { return String(r[h] == null ? '' : r[h]).trim(); }); })
    .filter(function (r) { return r.some(function (v) { return v !== ''; }); });
  const sh = sheet_(name);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
  if (clean.length) sh.getRange(2, 1, clean.length, head.length).setNumberFormat('@').setValues(clean);
  clearContentCache_();
  log_('list:' + name, '', '', clean.length, '');
  return readTable_(name);
}

function apiSavePost(post) {
  requireAdmin_();
  guardNotElectionDay_();
  if (!post || !String(post.title || '').trim()) throw new Error('タイトルを入力してください。');
  const t = openTable_('posts');
  const now = nowStr_();
  const row = {
    date: String(post.date || today_()),
    title: String(post.title).trim(),
    body: String(post.body || ''),
    image_url: String(post.image_url || '').trim(),
    link_url: String(post.link_url || '').trim(),
    status: post.status === 'published' ? 'published' : 'draft',
    updated_at: now,
  };
  let id = post.id;
  const i = id ? t.rows.findIndex(function (r) { return r.id === id; }) : -1;
  if (i >= 0) {
    t.update(i, row);
  } else {
    id = Utilities.getUuid().slice(0, 8);
    row.id = id; row.created_at = now; row.sent_at = ''; row.sent_count = 0;
    t.append(row);
  }
  clearContentCache_();
  return findPost_(id);
}

function apiDeletePost(id) {
  requireAdmin_();
  guardNotElectionDay_();
  const sh = sheet_('posts');
  const t = openTable_('posts');
  const i = t.rows.findIndex(function (r) { return r.id === id; });
  if (i < 0) throw new Error('記事が見つかりません。');
  if (t.rows[i].sent_at) throw new Error('配信済みの記事は削除できません（記録として残します）。非公開にしてください。');
  sh.deleteRow(i + 2);
  clearContentCache_();
  return true;
}

function apiUploadImage(dataUrl, filename) {
  requireAdmin_();
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('画像ファイルを選んでください。');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(filename || 'image').slice(0, 80));
  const folder = imageFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

function apiGetSubscribers() {
  requireAdmin_();
  return readTable_('subscribers').map(function (r) {
    return { email: r.email, name: r.name, status: r.status, requested_at: r.requested_at,
      confirmed_at: r.confirmed_at, unsubscribed_at: r.unsubscribed_at, source: r.source };
  });
}

function apiUnsubscribe(email) {
  requireAdmin_();
  const t = openTable_('subscribers');
  const i = t.rows.findIndex(function (r) { return r.email === email; });
  if (i < 0) throw new Error('見つかりません。');
  t.update(i, { status: 'unsubscribed', unsubscribed_at: nowStr_() });
  log_('unsubscribe', '', email, 1, '管理画面から停止');
  return true;
}

/** 紙の申込書などで本人の同意を得た人を手入力で追加する */
function apiAddSubscriber(email, name, consentNote) {
  requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('メールアドレスの形式が正しくありません。');
  if (!String(consentNote || '').trim()) throw new Error('同意を得た方法（例：○月○日 紙の申込書）を入力してください。');
  const s = readSettings_();
  const t = openTable_('subscribers');
  const i = t.rows.findIndex(function (r) { return r.email === email; });
  const row = {
    email: email, name: String(name || '').slice(0, 50), status: 'active', token: newToken_(),
    consent_text: (s.consent_text || DEFAULT_CONSENT) + '（' + String(consentNote).trim() + '）',
    requested_at: nowStr_(), confirmed_at: nowStr_(), unsubscribed_at: '', source: 'manual',
  };
  if (i >= 0) t.update(i, row); else t.append(row);
  log_('add_subscriber', '', email, 1, consentNote);
  return true;
}

/** 自分（管理者）宛てにテスト送信 */
function apiTestSend(id) {
  requireAdmin_();
  const post = findPost_(id);
  if (!post) throw new Error('先に記事を保存してください。');
  const s = readSettings_();
  const to = currentEmail_();
  const mail = buildPostMail_(post, s, 'TEST');
  sendMail_(to, '[テスト] ' + mail.subject, mail.text, mail.html, s);
  log_('test', id, mail.subject, 1, to);
  return to;
}

/** 有効な読者全員に配信（送信上限を超える分は1時間ごとに自動で続きを送る） */
function apiSendPost(id, allowResend) {
  requireAdmin_();
  guardNotElectionDay_();
  const post = findPost_(id);
  if (!post) throw new Error('記事が見つかりません。');
  if (post.status !== 'published') throw new Error('公開中の記事のみ配信できます。先に「公開」にして保存してください。');
  if (post.sent_at && !allowResend) throw new Error('この記事は配信済みです。');

  const active = readTable_('subscribers').filter(function (r) { return r.status === 'active'; });
  if (!active.length) throw new Error('配信先の読者がいません。');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('queue');
    const now = nowStr_();
    const rows = active.map(function (r) { return [id, r.email, now]; });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    const t = openTable_('posts');
    const i = t.rows.findIndex(function (r) { return r.id === id; });
    t.update(i, { sent_at: now });
  } finally {
    lock.releaseLock();
  }
  log_('queue', id, post.title, active.length, '');
  const result = processQueue();
  result.queued = active.length;
  return result;
}

function apiProcessQueue() {
  requireAdmin_();
  return processQueue();
}

function apiClearQueue() {
  requireAdmin_();
  const sh = sheet_('queue');
  const n = Math.max(0, sh.getLastRow() - 1);
  if (n) sh.getRange(2, 1, n, HEADERS.queue.length).clearContent();
  removeQueueTrigger_();
  log_('queue_clear', '', '', n, '送信待ちを取り消し');
  return n;
}

/* ============================================================
 * 送信キュー処理（時間主導トリガーからも呼ばれる）
 * ============================================================ */
function processQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { sent: 0, remaining: -1, note: '別の送信処理が実行中です。' };
  try {
    const s = readSettings_();
    const sh = sheet_('queue');
    const values = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
    const rows = values.filter(function (r) { return r[0] && r[1]; });
    if (!rows.length) { removeQueueTrigger_(); return { sent: 0, remaining: 0 }; }

    if (phase_(s) === 'election_day') {
      // 投票日当日は送信しない。キューは残し、自動処理も止める（翌日以降に管理画面から判断）
      removeQueueTrigger_();
      return { sent: 0, remaining: rows.length, note: '投票日当日のため送信を停止しました。' };
    }

    const subs = {};
    readTable_('subscribers').forEach(function (r) { if (r.status === 'active') subs[r.email] = r; });
    const posts = {};
    const start = Date.now();
    let quota = MailApp.getRemainingDailyQuota() - QUOTA_RESERVE;
    let i = 0, sent = 0, failed = 0;
    const perPost = {};

    for (; i < rows.length; i++) {
      if (quota <= 0 || Date.now() - start > BATCH_TIME_LIMIT_MS) break;
      const postId = String(rows[i][0]), email = String(rows[i][1]);
      const sub = subs[email];
      if (!sub) continue; // 途中で配信停止した人には送らない
      if (!(postId in posts)) posts[postId] = findPost_(postId);
      const post = posts[postId];
      if (!post) continue;
      try {
        const mail = buildPostMail_(post, s, sub.token);
        sendMail_(email, mail.subject, mail.text, mail.html, s);
        sent++; quota--;
        perPost[postId] = (perPost[postId] || 0) + 1;
      } catch (err) {
        failed++;
        console.error('送信失敗 ' + email + ': ' + err);
      }
    }

    const remaining = rows.slice(i);
    sh.getRange(2, 1, Math.max(values.length, 1), 3).clearContent();
    if (remaining.length) sh.getRange(2, 1, remaining.length, 3).setValues(remaining);

    if (Object.keys(perPost).length) {
      const t = openTable_('posts');
      Object.keys(perPost).forEach(function (pid) {
        const k = t.rows.findIndex(function (r) { return r.id === pid; });
        if (k >= 0) t.update(k, { sent_count: Number(t.rows[k].sent_count || 0) + perPost[pid] });
      });
    }
    if (remaining.length) ensureQueueTrigger_(); else removeQueueTrigger_();
    if (sent || failed) log_('send', Object.keys(perPost).join(','), '', sent, failed ? '失敗 ' + failed + ' 件' : '');
    return { sent: sent, failed: failed, remaining: remaining.length };
  } finally {
    lock.releaseLock();
  }
}

function ensureQueueTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processQueue'; });
  if (!exists) ScriptApp.newTrigger('processQueue').timeBased().everyHours(1).create();
}

function removeQueueTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processQueue') ScriptApp.deleteTrigger(t);
  });
}

/* ============================================================
 * メール本文
 * ============================================================ */
function buildPostMail_(post, s, token) {
  const isCampaign = phase_(s) === 'campaign';
  const unsubUrl = token === 'TEST' ? '(テスト送信のため停止リンクは無効です)' : webAppUrl_() + '?action=unsubscribe&token=' + token;
  const siteLink = s.site_url ? s.site_url.replace(/#.*$/, '') + '#post-' + post.id : '';
  const sender = s.mail_sender_name || s.candidate_name || '';
  const replyTo = s.office_email || Session.getEffectiveUser().getEmail();

  // 選挙期間中は、公職選挙法で義務付けられた表示（選挙運動用電子メールである旨・送信者・停止方法）を入れる
  const legalText = [
    isCampaign ? 'この電子メールは選挙運動用電子メールです。' : '',
    '送信者：' + sender + '（' + (s.office_name || '') + '）',
    '送信者のメールアドレス：' + replyTo,
    '今後このメールが不要な場合は、下記URLから配信停止できます（' + replyTo + ' へのご連絡でも停止できます）。',
    unsubUrl,
  ].filter(String).join('\n');

  const subject = (isCampaign ? '【選挙運動用電子メール】' : '') + post.title;
  const text = [
    isCampaign ? '【選挙運動用電子メール】\n' : '',
    post.title, post.date, '',
    post.body, '',
    post.link_url ? '関連リンク：' + post.link_url : '',
    siteLink ? 'サイトで読む：' + siteLink : '',
    '', '――', s.mail_footer || '', '', legalText,
  ].join('\n');

  const html =
    '<div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2933;line-height:1.8">' +
    (isCampaign ? '<p style="font-size:12px;color:#8a1c1c;margin:0 0 8px">【選挙運動用電子メール】</p>' : '') +
    '<p style="font-size:13px;color:#52606d;margin:0">' + esc_(sender) + ' 活動報告 ｜ ' + esc_(post.date) + '</p>' +
    '<h1 style="font-size:22px;margin:4px 0 16px;color:#17365d">' + esc_(post.title) + '</h1>' +
    (post.image_url ? '<p><img src="' + esc_(post.image_url) + '" alt="" style="max-width:100%;border-radius:8px"></p>' : '') +
    '<div>' + nl2br_(linkify_(esc_(post.body))) + '</div>' +
    (post.link_url ? '<p><a href="' + esc_(post.link_url) + '">関連リンクを見る</a></p>' : '') +
    (siteLink ? '<p><a href="' + esc_(siteLink) + '" style="display:inline-block;padding:10px 20px;background:#17365d;color:#fff;border-radius:6px;text-decoration:none">サイトで読む</a></p>' : '') +
    '<hr style="border:none;border-top:1px solid #d9e2ec;margin:24px 0">' +
    '<p style="font-size:13px;color:#52606d">' + nl2br_(esc_(s.mail_footer || '')) + '</p>' +
    '<p style="font-size:12px;color:#7b8794">' + nl2br_(linkify_(esc_(legalText))) + '</p>' +
    '</div>';
  return { subject: subject, text: text, html: html };
}

function sendMail_(to, subject, text, html, s) {
  const opts = { name: s.mail_sender_name || s.candidate_name || '', htmlBody: html };
  if (s.office_email) opts.replyTo = s.office_email;
  MailApp.sendEmail(to, subject, text, opts);
}

/* ============================================================
 * 選挙日程
 * ============================================================ */
function phase_(s) {
  const t = today_();
  if (s.notice_date && t < s.notice_date) return 'pre';          // 告示前（政治活動期間）
  if (s.election_date && t < s.election_date) return 'campaign'; // 選挙期間（告示日〜投票日前日）
  if (s.election_date && t === s.election_date) return 'election_day';
  return 'post';
}

function guardNotElectionDay_() {
  if (phase_(readSettings_()) === 'election_day') {
    throw new Error('投票日当日は、サイトの更新・メール配信ができません（公職選挙法）。');
  }
}

/* ============================================================
 * 権限
 * ============================================================ */
function currentEmail_() {
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

function adminList_() {
  const raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || Session.getEffectiveUser().getEmail();
  return String(raw).split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(String);
}

function isAdmin_() {
  const e = currentEmail_();
  return !!e && adminList_().indexOf(e) >= 0;
}

function requireAdmin_() {
  if (!isAdmin_()) throw new Error('管理者としてログインしてください。');
}

/* ============================================================
 * スプレッドシート操作ヘルパー
 * ============================================================ */
function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。setup() を実行してください。');
  return sh;
}

function readTable_(name) {
  return openTable_(name).rows.slice();
}

/** シートを読み込み、行の更新・追加ができるオブジェクトを返す */
function openTable_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const head = (values.shift() || []).map(String);
  const rows = values
    .map(function (r) {
      const o = {};
      head.forEach(function (h, i) { o[h] = normalize_(r[i]); });
      return o;
    });
  // 末尾の空行を落とす（途中の空行は位置がずれないよう残す）
  while (rows.length && head.every(function (h) { return rows[rows.length - 1][h] === ''; })) rows.pop();
  return {
    head: head,
    rows: rows,
    update: function (i, patch) {
      Object.keys(patch).forEach(function (k) {
        const c = head.indexOf(k);
        if (c >= 0) { sh.getRange(i + 2, c + 1).setValue(patch[k]); rows[i][k] = patch[k]; }
      });
    },
    append: function (obj) {
      sh.appendRow(head.map(function (h) { return obj[h] == null ? '' : obj[h]; }));
      rows.push(obj);
    },
  };
}

function readSettings_() {
  const o = {};
  readTable_('settings').forEach(function (r) { if (r.key) o[r.key] = r.value; });
  return o;
}

function findPost_(id) {
  return readTable_('posts').filter(function (r) { return r.id === id; })[0] || null;
}

function normalize_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes();
    return Utilities.formatDate(v, TZ, hasTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
  }
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v));
}

function byDateDesc_(a, b) {
  return String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at));
}

function log_(type, postId, subject, count, note) {
  try {
    sheet_('send_log').appendRow([nowStr_(), type, postId || '', subject || '', count || 0, currentEmail_() || 'system', note || '']);
  } catch (e) { console.error(e); }
}

function imageFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('IMAGE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* 作り直す */ } }
  const folder = DriveApp.createFolder('活動サイト用画像');
  props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  return folder;
}

function rememberWebAppUrl_() {
  try {
    const url = ScriptApp.getService().getUrl();
    if (url && /\/exec$/.test(url)) PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
  } catch (e) { /* noop */ }
}

function webAppUrl_() {
  return PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || ScriptApp.getService().getUrl();
}

/* ============================================================
 * 小物
 * ============================================================ */
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function isFalse_(v) { return v === false || String(v).trim().toUpperCase() === 'FALSE'; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function nl2br_(s) { return String(s).replace(/\n/g, '<br>'); }

function linkify_(escaped) {
  return String(escaped).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '">' + u + '</a>'; });
}

function actionForm_(action, token, label) {
  return '<form method="get" action="' + esc_(webAppUrl_()) + '" target="_top">' +
    '<input type="hidden" name="action" value="' + esc_(action) + '">' +
    '<input type="hidden" name="token" value="' + esc_(token) + '">' +
    '<input type="hidden" name="confirm" value="1">' +
    '<button type="submit">' + esc_(label) + '</button></form>';
}

function page_(title, bodyHtml) {
  const s = (function () { try { return readSettings_(); } catch (e) { return {}; } })();
  const back = s.site_url ? '<p><a href="' + esc_(s.site_url) + '" target="_top">サイトに戻る</a></p>' : '';
  const html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"><base target="_top">' +
    '<style>body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;background:#f5f7fa;color:#1f2933;margin:0;padding:48px 16px;line-height:1.8}' +
    '.card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.06)}' +
    'h1{font-size:20px;color:#17365d;margin:0 0 16px}.muted{color:#7b8794;font-size:13px}' +
    'button{background:#17365d;color:#fff;border:none;border-radius:6px;padding:12px 24px;font-size:15px;cursor:pointer}' +
    'small{color:#7b8794}</style></head><body><div class="card">' +
    '<small>' + esc_(s.candidate_name || '') + '</small>' +
    '<h1>' + esc_(title) + '</h1>' + bodyHtml + back + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
