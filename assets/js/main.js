(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var POSTS_PER_PAGE = 6;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v; // 固定のSVGにのみ使用
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  /** テキスト中の URL をリンクにした DOM 断片を返す（HTMLは解釈しない） */
  function linkified(text) {
    var frag = document.createDocumentFragment();
    var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(el('a', { href: m[0], target: '_blank', rel: 'noopener', text: m[0] }));
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function formatDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
    return m ? m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日' : String(s || '');
  }

  /* ---------- SNS アイコン（シンプルな線画） ---------- */
  var ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9L10 21l3.5-2.2C18.4 18.1 22 14.9 22 11c0-4.4-4.5-8-10-8z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v12a4 4 0 1 1-4-4"/><path d="M14 3c.5 3 2.5 5 6 5"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  };

  /* ---------- 「目指すこと」のアイコン（見出しの言葉から選ぶ。合うものがなければ出さない） ---------- */
  var POLICY_ICONS = [
    [/農|食/, '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 42V22"/><path d="M24 27c0-7-5-11-13-11 0 8 5 12 13 11z"/><path d="M24 22c0-8 5-13 13-13 0 9-5 14-13 13z"/><path d="M13 42h22"/></svg>'],
    [/財政|税|負担|予算/, '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 7v34M14 41h20M9 14h30"/><path d="M9 14L3.5 27a5.5 5.5 0 0 0 11 0z"/><path d="M39 14l-5.5 13a5.5 5.5 0 0 0 11 0z"/></svg>'],
    [/子ども|こども|若者|教育|学び/, '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 14c-4-3-9-4-17-4v26c8 0 13 1 17 4 4-3 9-4 17-4V10c-8 0-13 1-17 4z"/><path d="M24 14v26"/></svg>'],
    [/地域|可能性|交通|まち|産業|観光/, '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 43S11 31 11 20.5a13 13 0 0 1 26 0C37 31 24 43 24 43z"/><circle cx="24" cy="20.5" r="4.5"/></svg>'],
  ];
  function policyIcon(title) {
    for (var i = 0; i < POLICY_ICONS.length; i++) if (POLICY_ICONS[i][0].test(String(title || ''))) return POLICY_ICONS[i][1];
    return '';
  }

  /* ---------- データ取得 ---------- */
  function loadContent() {
    var fromApi = cfg.API_URL
      ? fetch(cfg.API_URL + '?action=content', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (d) { if (d && d.ok && d.data) return d.data; throw new Error('bad response'); })
      : Promise.reject(new Error('no api'));
    var fromFile = function () { return fetch(cfg.FALLBACK_DATA || 'data/site.json').then(function (r) { return r.json(); }); };
    return fromApi.then(function (data) {
      // 管理画面（API）が持っていない追加の項目（message / slogans / highlights / farm など）は、site.json から補う
      return fromFile().then(function (extra) {
        Object.keys(extra || {}).forEach(function (k) { if (data[k] === undefined) data[k] = extra[k]; });
        var es = (extra && extra.settings) || {}; data.settings = data.settings || {};
        Object.keys(es).forEach(function (k) { if (data.settings[k] === undefined) data.settings[k] = es[k]; });
        return data;
      }).catch(function () { return data; });
    }, function (err) {
      if (cfg.API_URL) console.warn('APIから読み込めなかったため、予備データを表示します', err);
      return fromFile();
    });
  }

  /* ---------- メルマガの表示切り替え（config.js の NEWSLETTER_ENABLED） ---------- */
  var NEWSLETTER = cfg.NEWSLETTER_ENABLED === true;
  $$('[data-newsletter]').forEach(function (n) { n.hidden = !NEWSLETTER; });

  /* ---------- 文字まわりの小さな部品 ---------- */
  /** 「、」「。」などの直後で区切った配列を返す（折り返し位置を文節の切れ目にそろえる） */
  function phrases(text) {
    return (String(text || '').match(/[^、。！？!?]+[、。！？!?]*|[、。！？!?]+/g) || []).map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function fillPhrases(node, text) {
    node.textContent = '';
    phrases(text).forEach(function (t) { node.appendChild(el('span', { text: t })); });
  }
  /**
   * 文字を1文字ずつ span に分ける（動きをつけるため）。
   * inner が true のときは <span class="ch"><span>字</span></span>（下からせり上がる動き用）。
   * 読み上げには影響しないよう、呼び出し側で aria-label / aria-hidden をつける。
   */
  function splitChars(node, start, inner) {
    var text = node.textContent, i = start || 0;
    node.textContent = '';
    Array.from(text).forEach(function (c) {
      if (/\s/.test(c)) { node.appendChild(document.createTextNode(c)); return; }
      var ch = el('span', { class: 'ch', style: '--i:' + (i++) }, inner ? [el('span', { text: c })] : [c]);
      node.appendChild(ch);
    });
    return i;
  }
  /** 見出し：文字が下から1文字ずつ上がる（読み上げは元の文のまま） */
  function splitHeading(h) {
    var label = h.textContent.trim();
    var wrap = el('span', { class: 'split', 'aria-hidden': 'true', text: label });
    splitChars(wrap, 0, true);
    h.textContent = ''; h.setAttribute('aria-label', label); h.appendChild(wrap);
    h.setAttribute('data-reveal', '');
  }
  $$('[data-split]').forEach(splitHeading);

  /** 名前の上に、姓・名ごとのふりがなを添える（分け方が合わないときは1行で添える） */
  function renderName(h1, name, kana) {
    var n = String(name || '').trim().split(/\s+/), k = String(kana || '').trim().split(/\s+/);
    if (!n[0]) return;
    h1.textContent = '';
    h1.setAttribute('aria-label', name + (kana ? '（' + kana + '）' : ''));
    var idx = 0;
    if (kana && n.length === k.length) {
      n.forEach(function (part, i) {
        var kanji = el('span', { class: 'np-kanji', text: part });
        idx = splitChars(kanji, idx, true);
        h1.appendChild(el('span', { class: 'np', 'aria-hidden': 'true' }, [el('span', { class: 'np-kana', text: k[i] }), kanji]));
      });
    } else {
      if (kana) h1.appendChild(el('span', { class: 'np-kana np-kana-line', 'aria-hidden': 'true', text: kana }));
      var all = el('span', { class: 'np-kanji', 'aria-hidden': 'true', text: name });
      splitChars(all, 0, true);
      h1.appendChild(all);
    }
  }
  /** 「【要入力】」だけの値は、まだ公開しない項目として扱う */
  function isTodo(v) { return /^\s*(【要入力】)?\s*$/.test(String(v == null ? '' : v)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 描画 ---------- */
  function render(d) {
    var s = d.settings || {};

    $$('[data-bind]').forEach(function (n) {
      var v = s[n.getAttribute('data-bind')];
      if (v != null && v !== '') n.textContent = v; else if (!n.textContent.trim()) n.hidden = true;
    });
    if (s.candidate_name) {
      document.title = s.candidate_name.replace(/\s+/g, '') + (s.candidate_kana ? '（' + s.candidate_kana + '）' : '') + (s.catchphrase ? '｜' + s.catchphrase : '');
    }

    // ファーストビュー
    renderName($('#hero-name'), s.candidate_name, s.candidate_kana);
    // 肩書き：「・」「／」のあとで折り返せるように、区切りごとに分ける
    var heroTitle = $('.hero-title');
    if (heroTitle && s.candidate_title) {
      var tw = el('span', { class: 'hero-title-text' }, (String(s.candidate_title).match(/[^・／]+[・／]?/g) || []).map(function (t) { return el('span', { text: t }); }));
      heroTitle.textContent = ''; heroTitle.appendChild(tw);
    }
    if (s.catchphrase) {
      fillPhrases($('#hero-catch'), s.catchphrase);
      var vc = $('#hero-vcatch'), vi = 0;
      fillPhrases(vc, s.catchphrase);
      vc.setAttribute('aria-label', s.catchphrase);
      $$('span', vc).forEach(function (seg) { seg.setAttribute('aria-hidden', 'true'); vi = splitChars(seg, vi, false); });
      var longest = Math.max.apply(null, phrases(s.catchphrase).map(function (t) { return t.length; }));
      $('#hero-vcatch').style.setProperty('--n', String(Math.max(longest, 6)));
    } else {
      // ひと言がないときは、藍鼠の面に名前を縦書きで置く
      $('#hero-catch').hidden = true;
      $('#hero-vcatch').textContent = s.candidate_name || '';
    }
    // 写真：読み込めたときだけ表示する（空・読み込み失敗のときは、藍鼠の面のデザインのまま）
    // photo_url は、https の URL か、このサイト内の画像（例：assets/img/hero.jpg）
    var rawPhoto = String(s.photo_url || '').trim();
    var photo = /^assets\/img\/[\w.\-\/]+\.(jpe?g|png|webp|avif)$/i.test(rawPhoto) && rawPhoto.indexOf('..') < 0 ? rawPhoto : safeUrl(rawPhoto);
    var img = $('#photo');
    if (photo) {
      img.alt = (s.candidate_name || '').replace(/\s+/g, '');
      img.addEventListener('load', function () { img.hidden = false; $('#hero').classList.add('has-photo'); });
      img.src = photo;
    }

    // 流れる文字の帯（ひと言と、合言葉をくり返す。合言葉がなければ選挙区）
    var slogans = (d.slogans || []).filter(function (t) { return typeof t === 'string' && t.trim(); });
    buildMarquee([s.catchphrase].concat(slogans.length ? slogans : [s.district]).filter(Boolean));

    // なぜ、県政へ（message があるときだけ）
    var msg = d.message;
    if (msg && (msg.title || msg.body)) {
      $('#message-title').textContent = msg.title || '';
      $('#message-title').hidden = !msg.title;
      String(msg.body || '').split(/\n\s*\n/).forEach(function (para) {
        if (para.trim()) $('#message-body').appendChild(el('p', { text: para.trim() }));
      });
      $('#message').hidden = false;
    }

    // リード文：読み進むにつれて濃くなる（1文字ずつに分ける。読み上げは元の文のまま）
    var lead = $('.greeting-lead');
    if (lead && s.lead && !reduceMotion) {
      var leadInner = el('span', { 'aria-hidden': 'true', text: s.lead });
      splitChars(leadInner, 0, false);
      lead.textContent = ''; lead.appendChild(el('span', { class: 'sr-only', text: s.lead })); lead.appendChild(leadInner);
      leadChars = $$('.ch', leadInner);
    }

    // 数字で見る活動（highlights があるときだけ）
    var stats = $('#stats-list');
    (d.highlights || []).forEach(function (h, i) {
      if (!h || h.value == null || h.value === '') return;
      stats.appendChild(el('li', { 'data-reveal': '', style: '--d:' + (i * 0.12) + 's' }, [
        el('p', { class: 'stat-figure' }, [
          el('span', { class: 'stat-value', 'data-count': String(h.value), text: String(h.value) }),
          h.unit ? el('span', { class: 'stat-unit', text: h.unit }) : null,
        ]),
        h.label ? el('p', { class: 'stat-label', text: h.label }) : null,
      ]));
    });
    $('#stats').hidden = !stats.children.length;

    // ごあいさつ（空行で段落を分ける）
    var bio = $('#bio');
    String(s.bio || '').split(/\n\s*\n/).forEach(function (para) {
      if (para.trim()) bio.appendChild(el('p', { text: para.trim() }));
    });

    // プロフィール（「／」で区切られた値は、行を分けて並べる）
    var facts = $('#facts');
    (d.profile || []).forEach(function (r) {
      if (!r.label || isTodo(r.value)) return;
      var parts = String(r.value).split('／').map(function (t) { return t.trim(); }).filter(Boolean);
      facts.appendChild(el('div', {}, [
        el('dt', { text: r.label }),
        el('dd', {}, parts.map(function (t) { return el('span', { text: t }); })),
      ]));
    });
    if (!facts.children.length) facts.hidden = true;
    if (!facts.children.length && !bio.children.length) $('#profile').hidden = true;

    // 目指すこと（番号・アイコンつき）。あわせて、見出しだけの一覧（ひと目でわかる、目指すこと）もつくる
    var pol = $('#policies'), pillars = $('#pillars-list'), polN = 0;
    (d.policies || []).forEach(function (p) {
      if (!p.title) return;
      var no = pad2(++polN), icon = policyIcon(p.title);
      pol.appendChild(el('li', { class: 'policy', id: 'policy-' + polN, 'data-reveal': '' }, [
        el('p', { class: 'policy-mark', 'aria-hidden': 'true' }, [
          el('span', { class: 'policy-num', text: no }),
          icon ? el('span', { class: 'policy-icon', html: icon }) : null,
        ]),
        el('h3', { text: p.title }),
        el('div', { class: 'policy-text' }, [
          p.summary ? el('p', { class: 'summary', text: p.summary }) : null,
          p.detail ? el('p', { class: 'detail', text: p.detail }) : null,
        ]),
      ]));
      pillars.appendChild(el('li', { 'data-reveal': '', style: '--d:' + ((polN - 1) * 0.08) + 's' }, [
        el('a', { href: '#policy-' + polN }, [
          el('span', { class: 'pillar-no', 'aria-hidden': 'true', text: no }),
          icon ? el('span', { class: 'pillar-icon', html: icon }) : null,
          el('span', { class: 'pillar-title', text: p.title }),
          el('span', { class: 'pillar-arrow', 'aria-hidden': 'true' }),
        ]),
      ]));
    });
    if (!pol.children.length) $('#vision').hidden = true;
    $('#pillars').hidden = !pillars.children.length;

    // 年表（「2014年」「2026年2月」は、年の数字を大きく見せる）
    var tl = $('#timeline');
    (d.history || []).forEach(function (h) {
      if (!h.date && !h.title) return;
      var m = /^(\d{4})年\s*(.*)$/.exec(String(h.date || '').trim());
      var date = m
        ? el('p', { class: 'tl-date' }, [el('span', { class: 'tl-year', text: m[1] }), el('span', { class: 'tl-rest', text: '年' + m[2] })])
        : el('p', { class: 'tl-date tl-date-plain', text: h.date });
      tl.appendChild(el('li', { 'data-reveal': '' }, [
        date,
        el('div', { class: 'tl-body' }, [
          el('h3', { text: h.title }),
          h.detail ? el('p', { text: h.detail }) : null,
        ]),
      ]));
    });
    if (!tl.children.length) $('#history').hidden = true;

    renderFarm(d.farm);
    renderPosts(d.posts || []);
    renderSns(d.sns || [], d.instagram || []);
    numberSections();

    // フッター（連絡先の表示欄）
    if (s.office_tel) { $('#f-tel').textContent = ''; $('#f-tel').appendChild(el('a', { href: 'tel:' + s.office_tel.replace(/[^\d+]/g, ''), text: s.office_tel })); }
    if (s.office_email) { $('#f-mail').textContent = ''; $('#f-mail').appendChild(el('a', { href: 'mailto:' + s.office_email, text: s.office_email })); }
    $('#year').textContent = new Date().getFullYear();

    observeReveal();
    onScroll();
  }

  /* ---------- 農園とお店（farm があるときだけ） ---------- */
  function linkItem(r) {
    var url = safeUrl(r.url); if (!url) return null;
    return el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener' }, [
      el('span', { class: 'sns-icon', html: ICONS[r.platform] || ICONS.web }),
      el('span', { class: 'sns-label', text: r.label || r.platform }),
      el('span', { class: 'sr-only', text: '（新しいタブで開きます）' }),
      el('span', { class: 'sns-out', 'aria-hidden': 'true' }),
    ])]);
  }
  function renderFarm(f) {
    var sec = $('#farm'), navLink = $('.gnav [data-for="farm"]');
    if (!f || (!f.title && !f.name && !f.lead)) { if (navLink) navLink.hidden = true; return; }
    sec.hidden = false;
    $('#farm-title').textContent = f.title || '';
    $('#farm-name').textContent = f.name || '';
    $('#farm-lead').textContent = f.lead || '';
    String(f.body || '').split(/\n\s*\n/).forEach(function (para) {
      if (para.trim()) $('#farm-text').appendChild(el('p', { text: para.trim() }));
    });
    (f.facts || []).forEach(function (h, i) {
      if (!h || h.value == null || h.value === '') return;
      $('#farm-facts').appendChild(el('li', { 'data-reveal': '', style: '--d:' + (i * 0.12) + 's' }, [
        el('p', { class: 'stat-figure' }, [
          el('span', { class: 'stat-value', 'data-count': String(h.value), text: String(h.value) }),
          h.unit ? el('span', { class: 'stat-unit', text: h.unit }) : null,
        ]),
        h.label ? el('p', { class: 'stat-label', text: h.label }) : null,
      ]));
    });
    (f.shops || []).forEach(function (sh, i) {
      if (!sh || !sh.name) return;
      $('#farm-shops').appendChild(el('li', { 'data-reveal': '', style: '--d:' + (i * 0.12) + 's' }, [
        el('p', { class: 'shop-no', 'aria-hidden': 'true', text: (f.shops.length > 1 ? 'お店 ' + pad2(i + 1) : '直営のお店') }),
        el('h3', { text: sh.name }),
        sh.place ? el('p', { class: 'shop-place', text: sh.place }) : null,
        sh.desc ? el('p', { class: 'shop-desc', text: sh.desc }) : null,
      ]));
    });
    $('#farm-note').textContent = f.note || ''; $('#farm-note').hidden = !f.note;
    (f.links || []).forEach(function (r) { var li = linkItem(r); if (li) $('#farm-links').appendChild(li); });
    ['#farm-facts', '#farm-shops', '#farm-links'].forEach(function (q) { $(q).hidden = !$(q).children.length; });
  }

  /** セクション番号（01, 02, …）を、表示されている順に振る */
  function numberSections() {
    var n = 0;
    $$('main > section').forEach(function (sec) {
      var no = $('.sec-no', sec);
      if (!no || sec.hidden) return;
      no.textContent = pad2(++n);
    });
  }

  /* ---------- Instagram：プロフィールの埋め込み（最新の投稿が自動で並ぶ） ---------- */
  function loadInstagramScript() {
    if (window.instgrm && window.instgrm.Embeds) { window.instgrm.Embeds.process(); return; }
    if ($('script[data-ig-embed]')) return;
    var sc = document.createElement('script');
    sc.async = true; sc.src = 'https://www.instagram.com/embed.js'; sc.setAttribute('data-ig-embed', '');
    sc.onload = function () { if (window.instgrm) window.instgrm.Embeds.process(); };
    document.body.appendChild(sc);
  }
  function renderInstagramProfile(sns) {
    var ig = sns.filter(function (r) { return r.platform === 'instagram' && /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?(\?.*)?$/.test(safeUrl(r.url)); })[0];
    if (!ig) return;
    var url = safeUrl(ig.url).split('?')[0].replace(/\/?$/, '/');
    var sec = $('#instagram'), box = $('#insta-embed');
    sec.hidden = false;
    $('#insta-link').href = url;
    function mount() {
      if (box.children.length) return;
      box.appendChild(el('blockquote', { class: 'instagram-media', 'data-instgrm-permalink': url, 'data-instgrm-version': '14' }, [
        el('a', { href: url, target: '_blank', rel: 'noopener', text: 'Instagram で最新の投稿を見る' }),
      ]));
      loadInstagramScript();
      // 最新の6件（3列×2段）が見えるように、枠の高さを切りそろえる。
      // Instagram の埋め込みは「プロフィール欄＋投稿6件（3列×2段）＋下のリンク」なので、プロフィール欄＋2段ぶんの高さにする。
      // 3件（1段）だけにしたいときは、INSTAGRAM_ROWS を 1 にする。6件より多くは出せない。
      var INSTAGRAM_ROWS = 2;
      function fit() {
        var f = $('iframe', box);
        if (!f || f.offsetHeight < 200) { box.style.height = ''; return; }
        var w = f.offsetWidth, row = Math.floor((w - 2) / 3), head = w >= 480 ? 158 : 147;
        var h = head + row * INSTAGRAM_ROWS + (INSTAGRAM_ROWS - 1);
        box.style.height = h >= f.offsetHeight ? '' : h + 'px';
        box.classList.remove('is-empty');
      }
      var tries = 0, timer = setInterval(function () { fit(); if (++tries > 40) clearInterval(timer); }, 500);
      window.addEventListener('resize', fit);
      // 読み込めなかったとき（通信の制限など）は、空の枠を残さない。左の「Instagram を見る」ボタンは残る
      setTimeout(function () { var f = $('iframe', box); if (!f || f.offsetHeight < 60) box.classList.add('is-empty'); }, 9000);
    }
    // 読み込みを軽くするため、近くまでスクロールしてから読み込む
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); mount(); } }, { rootMargin: '800px 0px' });
      io.observe(sec);
    } else mount();
  }

  var allPosts = [], shown = 0;
  function renderPosts(posts) {
    allPosts = posts;
    var box = $('#posts');
    if (!posts.length) { box.appendChild(el('p', { class: 'empty', text: '活動報告は準備中です。' })); return; }
    showMorePosts();
    $('#more-posts').addEventListener('click', function () {
      var count = box.children.length;
      showMorePosts();
      // 追加した最初の記事へフォーカスを移す（キーボード・読み上げで続きから読めるように）
      if (box.children[count]) box.children[count].focus();
    });
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }
  /** 日付を「2026 / 11.10」の形で組む（読み上げ用に和文の日付も持たせる） */
  function dateNode(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
    if (!m) return el('time', { class: 'post-date', text: String(s || '') });
    return el('time', { class: 'post-date', datetime: m[0], 'aria-label': formatDate(s) }, [
      el('span', { class: 'y', 'aria-hidden': 'true', text: m[1] }),
      el('span', { class: 'md', 'aria-hidden': 'true', text: pad2(Number(m[2])) + '.' + pad2(Number(m[3])) }),
    ]);
  }
  function showMorePosts() {
    var box = $('#posts');
    allPosts.slice(shown, shown + POSTS_PER_PAGE).forEach(function (p) {
      var img = safeUrl(p.image_url);
      box.appendChild(el('button', { class: 'post-row' + (img ? ' has-thumb' : ''), type: 'button', 'data-reveal': '', onclick: function () { openPost(p, true); } }, [
        dateNode(p.date),
        el('span', { class: 'post-main' }, [
          el('span', { class: 'post-title', text: p.title }),
          p.body ? el('span', { class: 'post-excerpt', text: String(p.body).replace(/\s+/g, ' ').slice(0, 120) }) : null,
        ]),
        img ? el('span', { class: 'post-thumb' }, [el('img', { src: img, alt: '', loading: 'lazy', width: '160', height: '120' })]) : null,
        el('span', { class: 'post-arrow', 'aria-hidden': 'true' }),
      ]));
    });
    shown += POSTS_PER_PAGE;
    $('#more-posts').hidden = shown >= allPosts.length;
    observeReveal();
  }

  function openPost(p, pushHash) {
    var dlg = $('#post-dialog');
    $('#pd-date').textContent = formatDate(p.date);
    $('#pd-date').setAttribute('datetime', String(p.date || ''));
    $('#pd-title').textContent = p.title;
    var img = safeUrl(p.image_url), link = safeUrl(p.link_url);
    $('#pd-img').hidden = !img; if (img) $('#pd-img').src = img;
    $('#pd-link').hidden = !link; if (link) $('#pd-link').href = link;
    var body = $('#pd-body'); body.textContent = ''; body.appendChild(linkified(p.body));
    if (pushHash && history.replaceState) history.replaceState(null, '', '#post-' + p.id);
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  }
  function openFromHash() {
    var m = /^#post-(.+)$/.exec(location.hash);
    if (!m) return;
    var p = allPosts.filter(function (x) { return String(x.id) === decodeURIComponent(m[1]); })[0];
    if (p) openPost(p, false);
  }
  $('#post-dialog').addEventListener('close', function () {
    if (/^#post-/.test(location.hash) && history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#reports');
  });
  $('#post-dialog').addEventListener('click', function (e) { if (e.target === this) this.close(); });

  function renderSns(sns, igPosts) {
    var links = $('#sns-links'), mini = $('#sns-mini');
    sns.forEach(function (r) {
      var url = safeUrl(r.url); if (!url) return;
      var icon = ICONS[r.platform] || ICONS.web, label = r.label || r.platform;
      links.appendChild(el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener' }, [
        el('span', { class: 'sns-icon', html: icon }),
        el('span', { class: 'sns-label', text: label }),
        el('span', { class: 'sr-only', text: '（新しいタブで開きます）' }),
        el('span', { class: 'sns-out', 'aria-hidden': 'true' }),
      ])]));
      mini.appendChild(el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': label + '（新しいタブで開きます）', html: icon })]));
    });
    if (!links.children.length) {
      $('#sns-note').textContent = 'SNSは準備中です。'; $('#sns-note').hidden = false;
      links.hidden = true; mini.hidden = true;
    }

    renderInstagramProfile(sns);
    setupShare();

    // 個別の投稿の埋め込み（管理画面の「サイトに埋め込む Instagram 投稿」）
    var grid = $('#ig-grid');
    var urls = igPosts.map(function (r) { return safeUrl(r.url); }).filter(function (u) { return /instagram\.com\/(p|reel|tv)\//.test(u); });
    if (!urls.length) return;
    grid.hidden = false;
    urls.forEach(function (u) {
      var clean = u.split('?')[0];
      grid.appendChild(el('blockquote', { class: 'instagram-media', 'data-instgrm-permalink': clean, 'data-instgrm-version': '14' }, [
        el('a', { href: clean, target: '_blank', rel: 'noopener', text: 'Instagramで見る' }),
      ]));
    });
    loadInstagramScript();
  }

  /* ---------- このページを共有する ---------- */
  var shareReady = false;
  function setupShare() {
    if (shareReady) return; shareReady = true;
    var url = location.origin + location.pathname, u = encodeURIComponent(url), t = encodeURIComponent(document.title);
    $('#share-line').href = 'https://social-plugins.line.me/lineit/share?url=' + u;
    $('#share-x').href = 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t;
    $('#share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
    $('#share-copy').addEventListener('click', function () {
      var status = $('#share-status');
      function done(ok) { status.textContent = ok ? 'リンクをコピーしました。' : 'コピーできませんでした。アドレス欄の URL をコピーしてください。'; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = el('textarea', { class: 'sr-only', readonly: '' });
        ta.value = url; document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
        ta.parentNode.removeChild(ta); done(ok);
      }
    });
  }

  /* ---------- 文字サイズの切り替え（標準／大） ---------- */
  (function () {
    var btns = $$('.fs-toggle button');
    function apply(v) {
      if (v === 'l') document.documentElement.setAttribute('data-fs', 'l'); else document.documentElement.removeAttribute('data-fs');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-fs') === v)); });
    }
    apply(document.documentElement.getAttribute('data-fs') === 'l' ? 'l' : 'm');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-fs'); apply(v);
        try { localStorage.setItem('fs', v); } catch (e) {}
        setTimeout(function () { measureMarquee(); onScroll(); }, 50);
      });
    });
  })();

  /* ---------- メルマガ登録 ---------- */
  var nlForm = $('#nl-form');
  if (nlForm) nlForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, status = $('#nl-status'), btn = f.querySelector('button[type=submit]');
    function show(msg, ok) { status.textContent = msg; status.className = 'nl-status ' + (ok ? 'ok' : 'err'); }

    var email = f.email.value.trim();
    if (!f.email.checkValidity() || !email) { show('メールアドレスを正しく入力してください。'); f.email.focus(); return; }
    if (!f.consent.checked) { show('配信への同意にチェックを入れてください。'); return; }
    if (!cfg.API_URL) { show('（準備中）メルマガ登録の受付はまだ開始していません。'); return; }

    btn.disabled = true; show('送信しています…', true);
    var body = new URLSearchParams({
      action: 'subscribe', email: email, name: f.name.value.trim(), consent: 'yes', website: f.website.value, source: 'site',
    });
    fetch(cfg.API_URL, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || '登録できませんでした。');
        if (d.status === 'already') show('このメールアドレスはすでに登録されています。', true);
        else if (d.status === 'pending') show('確認メールを送りました。メール内のリンクを開いて登録を完了してください。', true);
        else show('ご登録ありがとうございます。', true);
        f.reset();
      })
      .catch(function (err) { show(err.message && !/fetch|JSON/i.test(err.message) ? err.message : '通信に失敗しました。時間をおいて再度お試しください。'); })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- スマホメニュー ---------- */
  var menuBtn = $('.menu-btn'), nav = $('#gnav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    document.documentElement.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });
  // 画面を広げたら、開いたままのメニューを閉じる
  if (window.matchMedia) {
    var wide = window.matchMedia('(min-width: 1080px)');
    var onWide = function (e) { if (e.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  /* ============================================================
   * 動き
   * ============================================================ */
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var leadChars = [], leadOn = 0;

  /* ---------- スクロールで現れる ---------- */
  var revealIO = null;
  function observeReveal() {
    var nodes = $$('[data-reveal]:not(.is-in)');
    if (reduceMotion || !('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('is-in'); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in'); revealIO.unobserve(en.target);
          $$('[data-count]', en.target).forEach(countUp);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    }
    nodes.forEach(function (n) { revealIO.observe(n); });
  }

  /* ---------- 数字が数え上がる ---------- */
  function countUp(node) {
    var to = Number(node.getAttribute('data-count'));
    if (reduceMotion || !isFinite(to) || node.__done) return;
    node.__done = true;
    var t0 = null, dur = 1600;
    function step(t) {
      if (t0 == null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      node.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    }
    node.textContent = '0';
    requestAnimationFrame(step);
  }

  /* ---------- 流れる文字の帯 ---------- */
  var marquee = { track: $('#marquee-track'), x: 0, unit: 0, boost: 0 };
  function buildMarquee(words) {
    if (!words.length) { $('#marquee').hidden = true; return; }
    marquee.track.textContent = '';
    for (var r = 0; r < 4; r++) words.forEach(function (w) { marquee.track.appendChild(el('span', { class: 'marquee-item', text: w })); });
    marquee.words = words.length;
    measureMarquee();
  }
  function measureMarquee() {
    var items = marquee.track.children;
    if (!items.length) return;
    // くり返し1回ぶんの幅
    marquee.unit = items[marquee.words] ? items[marquee.words].offsetLeft - items[0].offsetLeft : 0;
  }

  /* ---------- スクロールに連動するもの（読み進んだ線・ヘッダー・リード文・年表の線） ---------- */
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    $('#progress').style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';

    var hero = $('#hero');
    $('.site-header').classList.toggle('is-solid', y > hero.offsetHeight - 80);

    marquee.boost += Math.max(-60, Math.min(60, y - lastY));
    lastY = y;

    if (leadChars.length) {
      // 画面に入りはじめてから、段落の下端が画面の下から2割ほどの位置に来るまでに、すべて濃くなる
      var r = leadChars[0].parentNode.getBoundingClientRect();
      var p = (vh * 0.96 - r.top) / (r.height + vh * 0.16);
      var n = Math.max(0, Math.min(leadChars.length, Math.round(p * leadChars.length)));
      for (; leadOn < n; leadOn++) leadChars[leadOn].classList.add('on');
      for (; leadOn > n; leadOn--) leadChars[leadOn - 1].classList.remove('on');
    }

    var tl = $('#timeline');
    if (tl && tl.children.length) {
      var tr = tl.getBoundingClientRect();
      tl.style.setProperty('--p', String(Math.max(0, Math.min(1, (vh * 0.7 - tr.top) / tr.height))));
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measureMarquee(); onScroll(); }, 150);
  });

  /* ---------- 毎フレームの処理（流れる文字の帯）。動きを減らす設定のときは止める ---------- */
  var lastT = 0;
  function frame(t) {
    var dt = Math.min(64, t - (lastT || t)); lastT = t;
    if (marquee.unit > 0) {
      marquee.x -= dt * 0.045 + marquee.boost * 0.35;
      marquee.boost *= 0.86;
      if (marquee.x <= -marquee.unit) marquee.x += marquee.unit;
      if (marquee.x > 0) marquee.x -= marquee.unit;
      marquee.track.style.transform = 'translate3d(' + marquee.x.toFixed(2) + 'px,0,0)';
    }
    requestAnimationFrame(frame);
  }
  if (!reduceMotion) requestAnimationFrame(frame);

  /* ---------- オープニング（最初の1回だけ） ---------- */
  (function () {
    var intro = $('#intro');
    if (!root.classList.contains('is-intro')) return;
    var done = false;
    function finish() {
      if (done) return; done = true;
      try { sessionStorage.setItem('intro', '1'); } catch (e) {}
      intro.classList.add('is-out');
      root.classList.remove('is-intro'); root.classList.add('is-ready');
      setTimeout(function () { intro.classList.remove('is-out'); }, 1000);
    }
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var minWait = new Promise(function (r) { setTimeout(r, 1000); });
    Promise.all([fontsReady, minWait]).then(finish);
    setTimeout(finish, 2600); // フォントが遅くても、ここで必ず開ける
  })();

  loadContent().then(render).catch(function (err) {
    console.error(err);
    $$('[data-reveal]').forEach(function (n) { n.classList.add('is-in'); });
    $('#posts').appendChild(el('p', { class: 'empty', text: '内容を読み込めませんでした。ページを再読み込みしてください。' }));
  });
})();
