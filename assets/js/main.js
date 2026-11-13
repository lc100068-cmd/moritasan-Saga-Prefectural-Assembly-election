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

  /* ---------- 描画 ---------- */
  function render(d) {
    var s = d.settings || {};

    $$('[data-bind]').forEach(function (n) {
      var v = s[n.getAttribute('data-bind')];
      if (v != null && v !== '') n.textContent = v; else if (!n.textContent.trim()) n.hidden = true;
    });
    if (s.candidate_name) document.title = s.candidate_name + ' | 活動報告・政策';
    var photo = safeUrl(s.photo_url);
    if (photo) $('#photo').src = photo;
    $('#photo').alt = (s.candidate_name || '') + 'の写真';

    // プロフィール
    $('#bio').textContent = s.bio || '';
    var facts = $('#facts');
    (d.profile || []).forEach(function (r) {
      if (!r.label && !r.value) return;
      facts.appendChild(el('div', {}, [el('dt', { text: r.label }), el('dd', { text: r.value })]));
    });
    if (!facts.children.length) facts.hidden = true;

    // 政策
    var pol = $('#policies');
    (d.policies || []).forEach(function (p) {
      pol.appendChild(el('li', { class: 'policy' }, [
        el('h3', { text: p.title }),
        p.summary ? el('p', { class: 'summary', text: p.summary }) : null,
        p.detail ? el('p', { class: 'detail', text: p.detail }) : null,
      ]));
    });

    // 年表
    var tl = $('#timeline');
    (d.history || []).forEach(function (h) {
      tl.appendChild(el('li', {}, [
        el('span', { class: 'date', text: h.date }),
        el('h3', { text: h.title }),
        h.detail ? el('p', { text: h.detail }) : null,
      ]));
    });

    renderPosts(d.posts || []);
    renderSns(d.sns || [], d.instagram || []);

    // フッター
    if (s.office_tel) $('#f-tel').appendChild(el('a', { href: 'tel:' + s.office_tel.replace(/[^\d+]/g, ''), text: 'TEL ' + s.office_tel }));
    if (s.office_email) $('#f-mail').appendChild(el('a', { href: 'mailto:' + s.office_email, text: s.office_email }));
    $('#year').textContent = new Date().getFullYear();
  }

  var allPosts = [], shown = 0;
  function renderPosts(posts) {
    allPosts = posts;
    var box = $('#posts');
    if (!posts.length) { box.appendChild(el('p', { class: 'empty', text: '活動報告は準備中です。' })); return; }
    showMorePosts();
    $('#more-posts').addEventListener('click', showMorePosts);
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }
  function showMorePosts() {
    var box = $('#posts');
    allPosts.slice(shown, shown + POSTS_PER_PAGE).forEach(function (p) {
      var img = safeUrl(p.image_url);
      box.appendChild(el('button', { class: 'post-card', type: 'button', onclick: function () { openPost(p, true); } }, [
        el('div', { class: 'thumb' }, [img ? el('img', { src: img, alt: '', loading: 'lazy' }) : 'REPORT']),
        el('div', { class: 'body' }, [
          el('time', { datetime: p.date, text: formatDate(p.date) }),
          el('h3', { text: p.title }),
          el('p', { text: p.body }),
        ]),
      ]));
    });
    shown += POSTS_PER_PAGE;
    $('#more-posts').hidden = shown >= allPosts.length;
  }

  function openPost(p, pushHash) {
    var dlg = $('#post-dialog');
    $('#pd-date').textContent = formatDate(p.date);
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
      var icon = ICONS[r.platform] || ICONS.web;
      links.appendChild(el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener' }, [el('span', { html: icon, style: 'display:flex' }), r.label || r.platform])]));
      mini.appendChild(el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': r.label || r.platform, html: icon })]));
    });

    var grid = $('#ig-grid');
    var urls = igPosts.map(function (r) { return safeUrl(r.url); }).filter(function (u) { return /instagram\.com\/(p|reel|tv)\//.test(u); });
    if (!urls.length) {
      var ig = sns.filter(function (r) { return r.platform === 'instagram' && safeUrl(r.url); })[0];
      grid.appendChild(el('p', { class: 'ig-empty' }, ig
        ? ['日々の様子は ', el('a', { href: ig.url, target: '_blank', rel: 'noopener', text: 'Instagram' }), ' でご覧いただけます。']
        : ['SNSの投稿は準備中です。']));
      return;
    }
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
  $('#nl-form').addEventListener('submit', function (e) {
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
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
  });

  loadContent().then(render).catch(function (err) {
    console.error(err);
    $('#posts').appendChild(el('p', { class: 'empty', text: '内容を読み込めませんでした。ページを再読み込みしてください。' }));
  });
})();
