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

  /* ---------- データ取得 ---------- */
  function loadContent() {
    var fromApi = cfg.API_URL
      ? fetch(cfg.API_URL + '?action=content', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (d) { if (d && d.ok && d.data) return d.data; throw new Error('bad response'); })
      : Promise.reject(new Error('no api'));
    return fromApi.catch(function (err) {
      if (cfg.API_URL) console.warn('APIから読み込めなかったため、予備データを表示します', err);
      return fetch(cfg.FALLBACK_DATA || 'data/site.json').then(function (r) { return r.json(); });
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
  /** 名前の上に、姓・名ごとのふりがなを添える（分け方が合わないときは1行で添える） */
  function renderName(h1, name, kana) {
    var n = String(name || '').trim().split(/\s+/), k = String(kana || '').trim().split(/\s+/);
    if (!n[0]) return;
    h1.textContent = '';
    h1.setAttribute('aria-label', name + (kana ? '（' + kana + '）' : ''));
    if (kana && n.length === k.length) {
      n.forEach(function (part, i) {
        h1.appendChild(el('span', { class: 'np', 'aria-hidden': 'true' }, [el('span', { class: 'np-kana', text: k[i] }), el('span', { class: 'np-kanji', text: part })]));
      });
    } else {
      if (kana) h1.appendChild(el('span', { class: 'np-kana np-kana-line', 'aria-hidden': 'true', text: kana }));
      h1.appendChild(el('span', { class: 'np-kanji', 'aria-hidden': 'true', text: name }));
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
    if (s.candidate_name) document.title = s.candidate_name + ' | 活動報告・政策';

    // ファーストビュー
    renderName($('#hero-name'), s.candidate_name, s.candidate_kana);
    if (s.catchphrase) {
      fillPhrases($('#hero-catch'), s.catchphrase);
      fillPhrases($('#hero-vcatch'), s.catchphrase);
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
    if (!facts.children.length) $('#profile').hidden = true;

    // 目指すこと
    var pol = $('#policies');
    (d.policies || []).forEach(function (p, i) {
      if (!p.title) return;
      pol.appendChild(el('li', { class: 'policy', 'data-reveal': '' }, [
        el('span', { class: 'policy-num', 'aria-hidden': 'true', text: pad2(i + 1) }),
        el('h3', { text: p.title }),
        el('div', { class: 'policy-text' }, [
          p.summary ? el('p', { class: 'summary', text: p.summary }) : null,
          p.detail ? el('p', { class: 'detail', text: p.detail }) : null,
        ]),
      ]));
    });
    if (!pol.children.length) $('#vision').hidden = true;

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

    renderPosts(d.posts || []);
    renderSns(d.sns || [], d.instagram || []);

    // フッター（連絡先の表示欄）
    if (s.office_tel) { $('#f-tel').textContent = ''; $('#f-tel').appendChild(el('a', { href: 'tel:' + s.office_tel.replace(/[^\d+]/g, ''), text: s.office_tel })); }
    if (s.office_email) { $('#f-mail').textContent = ''; $('#f-mail').appendChild(el('a', { href: 'mailto:' + s.office_email, text: s.office_email })); }
    $('#year').textContent = new Date().getFullYear();

    observeReveal();
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
    var sc = document.createElement('script');
    sc.async = true; sc.src = 'https://www.instagram.com/embed.js';
    sc.onload = function () { if (window.instgrm) window.instgrm.Embeds.process(); };
    document.body.appendChild(sc);
  }

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
    var wide = window.matchMedia('(min-width: 960px)');
    var onWide = function (e) { if (e.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---------- スクロールに合わせた、控えめなフェードイン ---------- */
  var revealIO = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function observeReveal() {
    var nodes = $$('[data-reveal]:not(.is-in)');
    if (reduceMotion || !('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('is-in'); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    }
    nodes.forEach(function (n) { revealIO.observe(n); });
  }

  loadContent().then(render).catch(function (err) {
    console.error(err);
    $$('[data-reveal]').forEach(function (n) { n.classList.add('is-in'); });
    $('#posts').appendChild(el('p', { class: 'empty', text: '内容を読み込めませんでした。ページを再読み込みしてください。' }));
  });
})();
