/* Increasink Bio Card. Step flow renderer, membaca global DATA dari data.js. */
(function () {
  'use strict';

  var D = window.DATA || {};
  var lang = D.lang_default || 'id';
  var step = 0;      // indeks step aktif
  var tier = -1;     // indeks tier di step How to Refer Me, -1 berarti belum dipilih


  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function T(id, en) { return lang === 'id' ? id : en; }
  function L(o, base) {
    if (!o) return '';
    return o[base + '_' + lang] || o[base + '_id'] || o[base + '_en'] || o[base] || '';
  }
  function has(v) { return v != null && String(v).trim() !== ''; }
  function el(id) { return document.getElementById(id); }
  function editing() { return !!(window.BioCard && window.BioCard.editing); }
  /* Menempelkan alamat field ke elemen. Di mode baca atribut ini tidak berefek apa pun. */
  function ed(path, rich) {
    return path ? ' data-e="' + esc(path) + '"' + (rich ? ' data-rich="1"' : '') : '';
  }
  function lp(prefix, base) { return prefix + '.' + base + '_' + lang; }
  function clamp(v, a, b) { v = +v; return isNaN(v) ? a : Math.min(b, Math.max(a, v)); }
  function pget(path) {
    var a = String(path).split('.'), v = D;
    for (var i = 0; i < a.length && v != null; i++) v = v[a[i]];
    return v;
  }
  /* Link dari isian editor: http(s), mailto, tel. Tanpa skema dianggap alamat web. */
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(u)) return 'https://' + u;
    return '#';
  }

  /* Teks kaya dari editor (bold, italic, underline, link) disaring sebelum ditampilkan.
     Tag lain dilepas tapi teksnya dipertahankan, atribut dibuang kecuali href yang aman. */
  var RICH_OK = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, A: 1, BR: 1 };
  var RICH_DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|svg|math)$/i;
  function cleanNode(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || !RICH_OK[c.tagName]) {
        if (c.nodeType === 1 && !RICH_DROP.test(c.tagName)) {
          cleanNode(c);
          while (c.firstChild) node.insertBefore(c.firstChild, c);
        }
        node.removeChild(c);
        return;
      }
      Array.prototype.slice.call(c.attributes).forEach(function (at) {
        if (!(c.tagName === 'A' && at.name === 'href')) c.removeAttribute(at.name);
      });
      if (c.tagName === 'A') {
        var h = String(c.getAttribute('href') || '').trim();
        if (!/^(https?:|mailto:|tel:)/i.test(h)) c.removeAttribute('href');
        else if (!editing()) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
      }
      cleanNode(c);
    });
  }
  function rich(html) {
    html = String(html == null ? '' : html);
    if (!/[<&]/.test(html)) return html;
    var t = document.createElement('template');
    t.innerHTML = html;
    cleanNode(t.content);
    var d = document.createElement('div');
    d.appendChild(t.content);
    return d.innerHTML;
  }

  var ICON = {
    mail: '<path d="M2 5h20v14H2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m2 6 10 7 10-7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    phone: '<path d="M6 3h4l2 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V16M8 7.9v.1M11.5 16v-5.5M11.5 13.2c0-1.7 1-2.7 2.3-2.7s2.2.9 2.2 2.7V16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    web: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    wa: '<path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2z" fill="currentColor"/>',
    share: '<circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m8.2 10.9 6.6-3.6M8.2 13.1l6.6 3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    /* navbar */
    person: '<path d="M12 12.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.9 19.9a7.3 7.3 0 0 1 14.2 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    badge: '<path d="M12 14.4a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.7 13.6 7.6 20.6l4.4-2.3 4.4 2.3-1.1-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    gains: '<path d="M5 19.2v-4.4M12 19.2V8.6M19 19.2V4.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
    heart: '<path d="M12 20.1 4.9 13a4.5 4.5 0 0 1 6.4-6.4l.7.7.7-.7A4.5 4.5 0 0 1 19.1 13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    hand: '<path d="M9.2 11.5a3.35 3.35 0 1 0 0-6.7 3.35 3.35 0 0 0 0 6.7Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.9 19.6a6.3 6.3 0 0 1 12.6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.3 5.3a3.35 3.35 0 0 1 0 6.4M17.6 14.3a6.3 6.3 0 0 1 3.5 5.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    chat: '<path d="M20.4 14.3a2.3 2.3 0 0 1-2.3 2.3H8.5L4 20.6V5.9a2.3 2.3 0 0 1 2.3-2.3h11.8a2.3 2.3 0 0 1 2.3 2.3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
  };
  ICON.play = '<path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/>';
  ICON.close = '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  ICON.soundOff = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
  ICON.soundOn = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.8a4.6 4.6 0 0 1 0 6.4M19 6.3a8.2 8.2 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
  /* Ikon tambahan untuk tab halaman dan kotak accordion, dipilih dari editor. */
  function stroke(d, extra) {
    return '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' + (extra || '');
  }
  ICON.star = stroke('m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z');
  ICON.check = stroke('m5 12.6 4.4 4.4L19 7.4');
  ICON.target = stroke('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', '<circle cx="12" cy="12" r="1.3" fill="currentColor"/>');
  ICON.trophy = stroke('M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6h-3a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z');
  ICON.bulb = stroke('M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z');
  ICON.briefcase = stroke('M3.5 7.5h17v12h-17zM8.5 7.5V5.6c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6v1.9M3.5 12.5h17');
  ICON.camera = stroke('M4 8h3.2L9 5.5h6L16.8 8H20v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z');
  ICON.pin = stroke('M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11zM12 7.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z');
  ICON.calendar = stroke('M4 5.5h16v14.5H4zM4 10h16M8.5 3.5v4M15.5 3.5v4');
  ICON.music = stroke('M9 18V6.2l10-2.2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z');
  ICON.cross = stroke('M12 3v18M7 8.5h10');
  ICON.rocket = stroke('M14.5 4.5c2.5-1 4.5-1 5-1-.1 1-.5 3-1.5 5.1-1.2 2.4-3.3 4.6-6 6.4l-2.9-2.9c1.8-2.7 4-4.8 5.4-5.6M9.1 12.1 6 12.3l-2 2.2 3.4.7M11.9 14.9l-.2 3.1-2.2 2-.7-3.4M15.5 7.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z');
  function svg(n, c) { return '<svg class="' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || ICON.star) + '</svg>'; }
  /* Tab boleh memakai gambar (logo BNI) sebagai ganti ikon. Abu saat diam, warna penuh saat aktif. */
  function tabIcon(x) {
    if (has(x.img)) return '<img class="tabimg" src="' + esc(x.img) + '" alt="" aria-hidden="true">';
    return svg(x.icon);
  }
  function h2(title, path) {
    return '<h2 class="h2"><span class="h2t"' + ed(path) + '>' +
      esc(title) + '</span></h2>';
  }
  function chips(arr, path) {
    arr = arr || [];
    if (!arr.length && !editing()) return '';
    return '<div class="chips"' + (path ? ' data-arr="' + esc(path) + '" data-kind="text"' : '') + '>' +
      arr.map(function (c, i) {
        return '<span class="chip"' + ed(path ? path + '.' + i : '') + '>' + esc(c) + '</span>';
      }).join('') + '</div>';
  }

  /* ---------- data versi 2: halaman berisi widget ----------
     Dulu setiap section punya renderer dan kunci data sendiri (gains, biosheet, refer, ...),
     jadi editor hanya bisa mengubah teksnya. Sekarang setiap step adalah halaman berisi
     daftar widget, sehingga seluruh kartu bisa disusun ulang dari editor. Data lama
     dikonversi otomatis saat dimuat, dan baru tertulis dalam bentuk baru saat Publish. */
  var OLD_DEF = {
    intro:    { icon: 'person', tab: ['Kenalan', 'About'],     label: ['Perkenalan', 'Introduction'] },
    bni:      { icon: 'badge',  tab: ['BNI', 'BNI'],           label: ['Keanggotaan BNI', 'BNI Membership'] },
    gains:    { icon: 'gains',  tab: ['GAINS', 'GAINS'],       label: ['Bio GAINS', 'Bio GAINS'] },
    personal: { icon: 'heart',  tab: ['Personal', 'Personal'], label: ['Di Luar Pekerjaan', 'Beyond Work'] },
    refer:    { icon: 'hand',   tab: ['Referral', 'Refer'],    label: ['Cara Mereferensikan', 'How to Refer'] },
    connect:  { icon: 'chat',   tab: ['Kontak', 'Contact'],    label: ['Kontak', 'Contact'], dark: true }
  };
  var OLD_ALL = ['intro', 'bni', 'gains', 'personal', 'refer', 'connect'];
  var OLD_PILLARS = ['goal', 'accomplishment', 'interest', 'network', 'skill'];

  /* Urutan tersimpan lama. Key yang belum tercatat ikut di belakang. */
  function resolveOrder(saved, all) {
    var out = [];
    (saved || []).forEach(function (k) {
      if (all.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k);
    });
    all.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function migrate(d) {
    if (!d || Array.isArray(d.pages)) return d;
    var o = d.order || {}, hidden = o.hidden || [], blocks = d.blocks || {};
    var hero = d.hero || (d.hero = {}), bni = d.bni || {}, biz = d.bisnis || {}, imgs = d.images || {};
    var pages = resolveOrder(o.steps, OLD_ALL).map(function (k) {
      var n = 0, a = [];
      function add(type, props) {
        var w = { id: k + '-' + (++n), type: type };
        Object.keys(props || {}).forEach(function (x) { w[x] = props[x]; });
        a.push(w);
      }
      function head(id, en) { add('heading', { text_id: id || '', text_en: en || '' }); }
      function row(lid, len, vid, ven) { return { label_id: lid, label_en: len, value_id: vid || '', value_en: ven || '' }; }
      /* blok tambahan lama (kolom info, teks polos, gambar) jadi widget biasa */
      function oldBlocks() {
        (Array.isArray(blocks[k]) ? blocks[k] : []).forEach(function (b) {
          if (!b) return;
          if (b.type === 'row') add('table', { rows: [row(b.label_id || '', b.label_en || '', b.value_id, b.value_en)] });
          else if (b.type === 'text') add('text', { body_id: esc(b.body_id || ''), body_en: esc(b.body_en || '') });
          else if (b.type === 'image' && has(b.src)) add('image', { src: b.src, caption_id: b.caption_id || '', caption_en: b.caption_en || '' });
        });
      }
      if (k === 'intro') {
        add('carousel', { slides: d.intro_slides || [], sound: 2, main: true });
        add('profile');
        add('text', { style: 'quote', body_id: hero.tagline_id || '', body_en: hero.tagline_en || '' });
        if (d.ig_embed !== false) add('instagram');
        oldBlocks();
      } else if (k === 'bni') {
        var bz = (biz.nama || '') + (has(biz.sejak) ? ' est. ' + biz.sejak : '');
        head('Keanggotaan', 'Membership');
        add('pins', { shared: true });
        add('table', { rows: [
          row('Chapter', 'Chapter', bni.chapter, bni.chapter),
          row('Klasifikasi', 'Classification', bni.klasifikasi_id, bni.klasifikasi_en),
          row('Peran', 'Role', bni.peran_id, bni.peran_en),
          row('Anggota Sejak', 'Member Since', bni.since_id, bni.since_en),
          row('Bisnis', 'Business', bz, bz)
        ] });
        oldBlocks();
        add('chips', { items: bni.status || [] });
        add('text', { body_id: biz.layanan_id || '', body_en: biz.layanan_en || '' });
        if (bni.qr) add('qr', copy(bni.qr));
      } else if (k === 'gains') {
        var g = d.gains || {};
        head('Profil GAINS', 'GAINS Profile');
        add('accordion', { items: resolveOrder(o.pillars, OLD_PILLARS).filter(function (p) { return g[p]; }).map(function (p) {
          var x = g[p], it = { k: p, badge: x.letter || p.charAt(0).toUpperCase(),
            title_id: x.title_id || '', title_en: x.title_en || '', body_id: x.body_id || '', body_en: x.body_en || '' };
          if (x.items) it.list = x.items;
          if (x.chips) it.chips = x.chips;
          return it;
        }) });
        oldBlocks();
      } else if (k === 'personal') {
        var m = d.ministry || {}, of = d.offrecord || {}, bs = d.biosheet;
        head(m.title_id, m.title_en);
        add('carousel', { slides: m.slides || [] });
        add('chips', { items: m.chips || [] });
        add('space', { h: 26 });
        head(of.title_id, of.title_en);
        add('facts', { items: of.facts || [] });
        if (bs) {
          add('space', { h: 26 });
          head(bs.title_id, bs.title_en);
          (bs.groups || []).forEach(function (gr) {
            var t = { title_id: gr.title_id || '', title_en: gr.title_en || '', rows: gr.rows || [] };
            if (gr.stack) t.stack = true;
            if (gr.photos) t.photos = gr.photos;
            add('table', t);
          });
        }
        oldBlocks();
      } else if (k === 'refer') {
        var r = d.refer || {}, t10 = d.top10;
        head(r.title_id, r.title_en);
        add('text', { body_id: esc(r.intro_id || ''), body_en: esc(r.intro_en || '') });
        add('tiers', { items: r.tiers || [] });
        if (t10) {
          add('space', { h: 26 });
          head(t10.title_id, t10.title_en);
          add('facts', { items: t10.items || [] });
        }
        oldBlocks();
      } else if (k === 'connect') {
        var foot = esc(hero.name || '') + ' &middot; ' + esc(biz.nama || '');
        head("Let's Connect", "Let's Connect");
        add('contact');
        add('share');
        if (d.showreel) add('showreel', copy(d.showreel));
        if (has(imgs.logo)) add('image', { src: imgs.logo, style: 'logo', invert: true, alt: 'Increasink' });
        add('text', { size: 'xs', body_id: foot, body_en: foot });
        oldBlocks();
      }
      var def = OLD_DEF[k];
      var pg = { key: k, icon: def.icon, tab_id: def.tab[0], tab_en: def.tab[1],
        label_id: def.label[0], label_en: def.label[1] };
      if (def.dark) pg.dark = true;
      if (hidden.indexOf(k) >= 0) pg.hidden = true;
      if (k === 'bni' && has(imgs.bni)) pg.tab_img = imgs.bni;
      pg.widgets = a;
      return pg;
    });
    // baris di bawah jabatan di cover dulu meminjam bni.chapter, sekarang punya field sendiri
    if (hero.meta == null && has(bni.chapter)) hero.meta = bni.chapter;
    delete hero.tagline_id;
    delete hero.tagline_en;
    ['intro_slides', 'showreel', 'bni', 'bisnis', 'gains', 'ministry', 'refer', 'offrecord', 'top10',
      'biosheet', 'order', 'blocks', 'ig_embed'].forEach(function (x) { delete d[x]; });
    d.version = 2;
    d.pages = pages;
    return d;
  }

  /* ---------- halaman ---------- */
  var STEPS = [];
  function buildSteps() {
    STEPS = [{ key: 'cover', dark: false }];
    (D.pages || []).forEach(function (p, i) {
      if (!p || (p.hidden && !editing())) return;
      STEPS.push({
        key: p.key || 'p' + i, page: i, dark: !!p.dark, icon: p.icon || 'star', img: p.tab_img || '',
        tab: [p.tab_id || p.tab_en || '', p.tab_en || p.tab_id || ''],
        label: [p.label_id || p.tab_id || '', p.label_en || p.tab_en || ''],
        off: !!p.hidden
      });
    });
  }
  var seen = { 1: true };

  /* id tunggal (car, vsound, reel, share) dipasang di elemen pertama saja per render,
     supaya dua widget sejenis di satu halaman tidak menghasilkan id kembar. */
  var ONE = {};
  function once(name) {
    if (ONE[name]) return '';
    ONE[name] = 1;
    return ' id="' + name + '"';
  }

  /* Deretan pin. Pin cover memakai D.pins; widget pin boleh memakai pin yang sama
     (shared) atau daftarnya sendiri. */
  function pinRow(arr, path) {
    arr = Array.isArray(arr) ? arr : [];
    if (!arr.length && !editing()) return '';
    return '<div class="pins" data-arr="' + esc(path) + '" data-kind="pin">' +
      arr.map(function (p) {
        return '<span class="pin">' +
          '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || '') + '" loading="lazy"></span>';
      }).join('') + '</div>';
  }

  function coverHtml() {
    var hero = D.hero || {}, img = (D.images || {}).cover || (D.images || {}).hero;
    var inner = has(img)
      ? '<img class="ring-img" src="' + esc(img) + '" alt="' + esc(hero.name) + '">'
      : '<span class="ring-ini">' + esc(hero.initials || '') + '</span>';
    return '<div class="cover">' +
      '<div class="ring" data-img="images.cover">' + inner + '</div>' +
      pinRow(D.pins, 'pins') +
      '<div class="cover-kicker"' + ed(lp('hero', 'connector')) + '>' + esc(L(hero, 'connector')) + '</div>' +
      '<h1 class="cover-name"' + ed('hero.name') + '>' + esc(hero.name || '') + '</h1>' +
      '<p class="cover-role"' + ed(lp('hero', 'role')) + '>' + esc(L(hero, 'role')) + '</p>' +
      (has(hero.meta) || editing()
        ? '<div class="cover-meta"' + ed('hero.meta') + '>' + esc(hero.meta) + '</div>' : '') +
      '</div>';
  }

  /* Carousel ala Instagram. Video mulai tanpa suara karena browser HP menolak autoplay
     bersuara, tombol speaker menyalakan suara lewat ketukan.
     o = { cls, key, slides, path, sound, lead }. sound = jumlah slide pertama yang boleh
     bersuara (kosong berarti semua). lead = video yang ditaruh paling depan (showreel). */
  function carouselHtml(o) {
    var hero = D.hero || {};
    var slides = (Array.isArray(o.slides) ? o.slides : []).filter(function (s) { return s && has(s.src); });
    if (o.sound != null) slides = slides.map(function (s, i) { return i < o.sound ? s : { type: s.type, src: s.src, poster: s.poster, mute: true }; });
    if (o.lead && has(o.lead.src)) slides = [o.lead].concat(slides);
    if (!slides.length) return '';
    var hasVid = slides.some(function (s) { return s.type === 'video'; });
    return '<div class="portrait carousel' + (o.cls ? ' ' + o.cls : '') + '"' + once('car') + ' data-car="' + esc(o.key) + '"' +
        (o.path && editing() ? ' data-slides="' + esc(o.path) + '"' : '') + ' aria-roledescription="carousel">' +
        '<div class="car-track">' + slides.map(function (s, i) {
          return '<div class="car-slide">' + (s.type === 'video'
            ? '<video class="car-media"' + (i === 0 ? ' src="' + esc(s.src) + '"' : '') +
              ' data-src="' + esc(s.src) + '"' + (has(s.poster) ? ' poster="' + esc(s.poster) + '"' : '') +
              ' muted playsinline preload="' + (i === 0 ? 'auto' : 'none') + '"' + (slides.length === 1 ? ' loop' : '') +
              (s.mute ? ' data-mute="1"' : '') +
              ' aria-label="' + esc(hero.name || '') + '"></video>'
            : '<img class="car-media" src="' + esc(s.src) + '" alt="" draggable="false">') + '</div>';
        }).join('') + '</div>' +
        (slides.length > 1 ? '<div class="car-dots" aria-hidden="true">' +
          slides.map(function () { return '<i></i>'; }).join('') + '</div>' : '') +
          (hasVid ? '<button class="vsound"' + once('vsound') + ' aria-pressed="' + introSound + '" aria-label="' +
          (introSound ? T('Matikan suara', 'Mute') : T('Nyalakan suara', 'Unmute')) + '">' +
          svg(introSound ? 'soundOn' : 'soundOff') + '</button>' : '') +
        /* Di HP carousel digeser dengan jari. Di browser tidak ada yang bisa digeser,
           jadi dua tombol ini yang menggantikannya, muncul hanya di perangkat bertetikus. */
        (slides.length > 1
          ? '<button class="car-nav prev" aria-label="' + T('Slide sebelumnya', 'Previous slide') + '">&lsaquo;</button>' +
            '<button class="car-nav next" aria-label="' + T('Slide berikutnya', 'Next slide') + '">&rsaquo;</button>' : '') +
        '</div>';
  }

  /* Grid Instagram resmi lewat /<user>/embed/. Bukan widget pihak ketiga, tapi juga bukan
     endpoint yang didokumentasikan Meta, jadi anggap bisa berubah sewaktu-waktu. Dimuat
     malas supaya tidak ikut mengunduh saat carousel baru dibuka. */
  function igHtml(ig) {
    if (!has(ig)) return '';
    return '<div class="igbox">' +
      '<div class="igbox-h">Instagram <b>@' + esc(ig) + '</b></div>' +
      '<iframe class="igframe" loading="lazy" scrolling="no" frameborder="0"' +
      ' title="Instagram @' + esc(ig) + '"' +
      ' data-src="https://www.instagram.com/' + esc(encodeURIComponent(ig)) + '/embed/"></iframe>' +
      '<a class="igbox-a" href="https://instagram.com/' + esc(encodeURIComponent(ig)) + '" target="_blank" rel="noopener">' +
      T('Buka profil', 'Open profile') + ' &rsaquo;</a></div>';
  }

  /* Kode QR. Dibungkus tautan supaya di HP tidak perlu dipindai pakai alat lain, cukup
     diketuk. Di mode sunting tautannya dimatikan agar gambarnya bisa diganti. */
  function qrHtml(q, p) {
    if (!has(q.src)) {
      return editing() ? '<div class="qrbox w-ph"><p class="qrhint">' +
        T('Belum ada QR. Ketuk Atur lalu isi link-nya, QR dibuat otomatis.', 'No QR yet. Tap Settings and enter a link, the QR is made for you.') +
        '</p></div>' : '';
    }
    var tap = has(q.url) && !editing();
    return '<div class="qrbox">' +
      (tap ? '<a class="qrtap" href="' + esc(safeUrl(q.url)) + '" target="_blank" rel="noopener">' : '<div class="qrtap">') +
      '<img class="qrimg" src="' + esc(q.src) + '" alt="' + esc(L(q, 'label') || 'QR') + '" loading="lazy" data-img="' + p + '.src">' +
      (tap ? '</a>' : '</div>') +
      '<div class="qrlab"' + ed(lp(p, 'label')) + '>' + esc(L(q, 'label')) + '</div>' +
      (has(L(q, 'hint')) || editing()
        ? '<p class="qrhint"' + ed(lp(p, 'hint'), 1) + '>' + rich(L(q, 'hint')) + '</p>' : '') +
      '</div>';
  }

  /* Tabel dua kolom (label dan isi). Kolom kosong tidak tampil, kecuali saat menyunting
     supaya bisa diisi. Baris bisa di-hide tanpa dihapus. Strip foto opsional di bawahnya. */
  function tableHtml(w, p) {
    var rows = (w.rows || []).map(function (r, ri) {
      var rp = p + '.rows.' + ri, v = L(r, 'value');
      if ((!has(v) || r.hidden) && !editing()) return '';
      var hd = editing() ? ' data-hide="' + esc(rp) + '"' : '';
      return '<div class="meta-row' + (r.hidden ? ' ed-off' : '') + '"' + hd + '><div class="meta-k"' + ed(lp(rp, 'label')) + '>' + esc(L(r, 'label')) + '</div>' +
        '<div class="meta-v"' + ed(lp(rp, 'value')) + '>' + (editing() ? esc(v) : igLinks(v, r.links)) + '</div></div>';
    }).join('');
    // strip foto kecil di bawah baris, tiga terlihat, sisanya digeser
    var photos = (w.photos || []).map(function (ph, pi) {
      if (!ph || !has(ph.src)) return '';
      return '<div class="bs-ph"><img src="' + esc(ph.src) + '" alt="' + esc(L(ph, 'alt')) + '" loading="lazy" data-img="' + p + '.photos.' + pi + '.src"></div>';
    }).join('');
    if (!rows && !photos && !editing()) return '';
    var title = L(w, 'title');
    return (has(title) || (editing() && w.title_id != null)
        ? '<div class="bs-h"' + ed(lp(p, 'title')) + '>' + esc(title) + '</div>' : '') +
      '<div class="meta' + (w.stack ? ' bs-stack' : '') + '"' + (editing() ? ' data-arr="' + p + '.rows" data-kind="row"' : '') + '>' + rows +
      (photos ? '<div class="bs-photos">' + photos + '</div>' : '') + '</div>';
  }

  /* Kotak huruf atau ikon di kiri judul accordion, seperti G A I N S. */
  function badgeHtml(g, gp) {
    var inner = g.icon && ICON[g.icon] ? svg(g.icon) : esc(g.badge || '');
    return '<span class="acc-l' + (g.icon && ICON[g.icon] ? ' ico' : '') + '" aria-hidden="true"' +
      (editing() ? ' data-badge="' + esc(gp) + '"' : '') + '>' + inner + '</span>';
  }

  /* Accordion bergaya GAINS: kotak huruf atau ikon, judul, isi yang dibuka tutup lewat
     tombol plus. Item pertama terbuka di awal. collapsible:false membuat semua terbuka. */
  var open = {};
  function accHtml(w, p) {
    var col = w.collapsible !== false;
    var rows = (w.items || []).map(function (g, i) {
      var gp = p + '.items.' + i, ok = w.id + ':' + (g.k || i);
      var list = (g.list || []).map(function (it, j) {
        return '<li' + ed(gp + '.list.' + j + '.' + lang, 1) + '>' + rich(it[lang] || it.id || it.en || '') + '</li>';
      }).join('');
      var on = !col || (open[ok] != null ? open[ok] : i === 0);
      return '<div class="acc-i' + (on ? ' on' : '') + '" data-pil="' + esc(ok) + '">' +
        '<div class="acc-h">' + badgeHtml(g, gp) +
        '<span class="acc-t"' + ed(lp(gp, 'title')) + '>' + esc(L(g, 'title')) + '</span>' +
        (col ? '<button class="acc-x" aria-expanded="' + on + '" aria-label="' + esc(L(g, 'title')) + '"></button>' : '') +
        '</div>' +
        '<div class="acc-p"><div><div class="acc-in">' +
        (has(L(g, 'body')) || editing()
          ? '<p class="p"' + ed(lp(gp, 'body'), 1) + '>' + rich(L(g, 'body')) + '</p>' : '') +
        (list || (editing() && g.list)
          ? '<ul class="list" data-arr="' + gp + '.list" data-kind="ml">' + list + '</ul>' : '') +
        chips(g.chips, gp + '.chips') +
        (editing() && (!g.list || !g.chips)
          ? '<div class="ed-more" data-more="' + esc(gp) + '">' +
            (!g.list ? '<button type="button" data-m="list">+ ' + T('Poin', 'Bullets') + '</button>' : '') +
            (!g.chips ? '<button type="button" data-m="chips">+ ' + T('Chip', 'Chips') + '</button>' : '') + '</div>' : '') +
        '</div></div></div></div>';
    }).join('');
    return '<div class="acc" data-acc="' + esc(w.id) + '"' + (editing() ? ' data-arr="' + p + '.items" data-kind="acc"' : '') + '>' + rows + '</div>';
  }

  /* Nama di teks Bio Sheet yang punya post Instagram jadi tombol play. Teksnya tetap teks
     biasa di data (bisa disunting), tautannya disimpan terpisah di row.links. Dipasang lewat
     penanda dulu supaya label berikutnya tidak ikut cocok di dalam HTML tombol sebelumnya. */
  function igLinks(v, links) {
    var h = esc(v), btns = [];
    (links || []).forEach(function (k) {
      if (!k || !has(k.label) || !has(k.url)) return;
      var t = esc(k.label), i = h.indexOf(t);
      if (i < 0) return;
      h = h.slice(0, i) + '\u0000' + btns.length + '\u0000' + h.slice(i + t.length);
      btns.push('<button type="button" class="iglink" data-ig="' + esc(k.url) + '" data-name="' + t + '">' +
        svg('play') + t + '</button>');
    });
    return h.replace(/\u0000(\d+)\u0000/g, function (_, n) { return btns[+n]; });
  }

  /* Post Instagram dibuka di lembar dari bawah lewat /embed/ resmi, jadi pengunjung tetap
     di kartu. Tinggi iframe diatur pesan MEASURE di bawah, lembarnya yang di-scroll. */
  function igOpen(url, name) {
    var m = el('modal'), code = (String(url).match(/instagram\.com\/(?:p|reel)\/([\w-]+)/) || [])[1];
    if (!code) { window.open(url, '_blank', 'noopener'); return; }
    var post = 'https://www.instagram.com/p/' + code + '/';
    m.className = 'modal igm show';
    m.innerHTML = '<div class="box igsheet" role="dialog" aria-modal="true" aria-label="' + esc(name) + '">' +
      '<div class="igsheet-h"><button class="igsheet-back" id="igx" type="button">&lsaquo; ' + T('Kembali', 'Back') + '</button>' +
      '<b>' + esc(name) + '</b></div>' +
      '<div class="igsheet-b"><iframe class="igpost" scrolling="no" frameborder="0" title="Instagram ' + esc(name) + '"' +
      ' src="' + post + 'embed/captioned/"></iframe></div>' +
      '<a class="btn igsheet-a" href="' + post + '" target="_blank" rel="noopener">' + svg('ig') +
      T('Lihat di Instagram', 'View on Instagram') + '</a></div>';
    m.onclick = function (e) { if (e.target === m || e.target.closest('#igx')) igClose(); };
  }
  function igClose() {
    var m = el('modal');
    m.className = 'modal';
    m.innerHTML = '';      // iframe dibuang, video di post ikut berhenti
    m.onclick = null;
  }

  /* Daftar bernomor (Off the Record, Top Ten Customers): nomor atau huruf, lalu teks. */
  function factsHtml(w, p) {
    var items = (w.items || []).map(function (f, i) {
      var fp = p + '.items.' + i;
      return '<div class="fact"><div class="fact-n"' + ed(fp + '.n') + '>' + esc(f.n) + '</div>' +
        '<div class="fact-t"' + ed(fp + '.' + lang, 1) + '>' + rich(f[lang] || f.id || f.en || '') + '</div></div>';
    }).join('');
    if (!items && !editing()) return '';
    return '<div class="facts" data-arr="' + p + '.items" data-kind="fact">' + items + '</div>';
  }

  /* Tumpukan 3D Bread, Cheese, Meat. Sebelum memilih: tumpukan sebagai ilustrasi.
     Setelah memilih: tumpukan berputar jadi lingkaran datar berurutan ke bawah, tiap
     lingkaran langsung diikuti deskripsinya. Pilihan tier lewat tombol di bawahnya,
     karena lapisan 3D terlalu kecil untuk diketuk jari. Satu kartu satu tumpukan. */
  function tiersHtml(w, p) {
    var list = w.items || [];
    /* Ikon burger 4 garis (roti atas, cheese, meat, roti bawah). Tier 0 menyalakan
       dua garis roti, tier 1 garis kedua, tier 2 garis ketiga. */
    var lines = '<i></i><i></i><i></i><i></i>';
    var btns = list.map(function (x, i) {
      return '<button data-tier="' + i + '" class="' + (i === tier ? 'on' : '') + '" aria-pressed="' + (i === tier) + '"' +
        ' style="--tc:' + esc(x.color || '#8E8E93') + '"><span class="tico t' + i + '" aria-hidden="true">' + lines + '</span>' +
        esc(x.name || '') + '</button>';
    }).join('');
    var col = function (i) { return esc((list[i] || {}).color || '#8E8E93'); };
    var back = tier < 0 ? '' :
      '<button class="tback" id="tback" aria-label="' + T('Kembali ke tumpukan 3D', 'Back to the 3D stack') + '">' +
      '<span class="tico tall" aria-hidden="true" style="--c0:' + col(0) + ';--c1:' + col(1) + ';--c2:' + col(2) + '">' + lines + '</span></button>';
    var nav = '<div class="tierbar">' + back +
      '<div class="tiers" id="tiernav" data-arr="' + p + '.items" data-kind="fixed">' + btns + '</div></div>';
    if (tier < 0) {
      var slabs = list.map(function (x, i) {
        return '<div class="slab" data-tier="' + i + '" aria-hidden="true"' +
          ' style="--tc:' + esc(x.color || '#8E8E93') + ';--i:' + (list.length - 1 - i) + '">' +
          '<span class="bot"></span><span class="top"></span>' +
          '<b class="nm">' + esc(x.name || '') + '</b></div>';
      }).join('');
      return '<div class="burger" id="burger"><div class="scene">' + slabs + '</div></div>' + nav +
        '<p class="pick">' + T('Pilih salah satu lapisan.', 'Pick one of the layers.') + '</p>';
    }
    var flats = list.map(function (x, i) {
      var tp = p + '.items.' + i;
      return '<div class="tflat' + (i === tier && !flipPending ? ' on' : '') + '" id="tier' + i + '" data-i="' + i + '" style="--tc:' + esc(x.color || '#8E8E93') + ';--d:' + i + '">' +
        '<div class="tdisc" data-tier="' + i + '"><b' + ed(tp + '.name') + '>' + esc(x.name || '') + '</b></div>' +
        '<div class="tier-lvl"' + ed(lp(tp, 'level')) + '>' + esc(L(x, 'level')) + '</div>' +
        '<p class="tier-body"' + ed(lp(tp, 'body')) + '>' + esc(L(x, 'body')) + '</p></div>';
    }).join('');
    return nav + '<div class="tflats" id="tflats">' + flats + '</div>';
  }

  /* Daftar kontak. Datanya global (D.contact) karena dipakai juga oleh tombol WhatsApp,
     tombol Instagram, dan file vCard. */
  function contactHtml() {
    var c = D.contact || {}, hero = D.hero || {}, rows = '';
    function link(href, icon, text, path, prefix) {
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + svg(icon, 'ic') +
        '<span class="tx"' + ed(path) + (prefix ? ' data-prefix="' + prefix + '"' : '') + '>' +
        esc(text) + '</span><span class="ar">&rsaquo;</span></a>';
    }
    if (has(c.email) || editing()) rows += link('mailto:' + c.email, 'mail', c.email, 'contact.email');
    if (has(c.phone_display) || editing()) rows += link('tel:' + String(c.phone_display || '').replace(/\s/g, ''), 'phone', c.phone_display, 'contact.phone_display');
    if (has(c.ig) || editing()) rows += link('https://instagram.com/' + c.ig, 'ig', '@' + c.ig, 'contact.ig', '@');
    if (has(c.linkedin) || editing()) rows += link('https://www.linkedin.com/in/' + c.linkedin + '/', 'linkedin', editing() ? 'linkedin.com/in/' + c.linkedin : hero.name, 'contact.linkedin', 'linkedin.com/in/');
    if (has(c.web) || editing()) rows += link('https://' + String(c.web || '').replace(/^https?:\/\//, ''), 'web', c.web, 'contact.web');
    /* Nomor WhatsApp tidak tampil di kartu, tapi harus bisa diperbaiki dari editor. */
    if (editing()) rows += link('#', 'wa', c.wa || '', 'contact.wa');
    return '<div class="contact">' + rows + '</div>';
  }

  /* ---------- showreel ----------
     Tombol gelap pekat dengan keping video 16:9 di kanan. Latar video penuh pernah dicoba
     dan rusak begitu videonya berlatar putih, jadi jangan dikembalikan. */
  function reelBtn(r, p) {
    if (!has(r.src) && !editing()) return '';
    /* Latar tombol memakai klip pendek kalau ada, bukan film penuh, supaya pengunjung
       yang meloncat langsung ke tab Contact tidak menarik berkas besar hanya untuk
       sebuah strip setinggi 92px. */
    return '<div class="reel"' + once('reel') + ' role="button" tabindex="0" data-reel="' + esc(p) + '">' +
      '<span class="reel-ic">' + svg('play') + '</span>' +
      '<span class="reel-t"><b' + ed(lp(p, 'label')) + '>' + esc(L(r, 'label') || 'Our Showreel') + '</b>' +
      (has(L(r, 'note')) || editing()
        ? '<i' + ed(lp(p, 'note')) + '>' + esc(L(r, 'note')) + '</i>' : '') +
      '</span>' +
      (has(r.src) ? '<video class="reel-bg" src="' + esc(r.loop || r.src) + '"' +
      (has(r.poster) ? ' poster="' + esc(r.poster) + '"' : '') +
      ' muted playsinline loop preload="metadata" aria-hidden="true" tabindex="-1"></video>' : '') + '</div>';
  }

  /* Carousel utama kartu (yang ditandai main, atau carousel pertama) ikut diputar di
     overlay showreel, sesudah video showreel-nya sendiri. */
  function mainCarousel() {
    var first = null, main = null;
    (D.pages || []).forEach(function (pg) {
      (pg && pg.widgets || []).forEach(function (w) {
        if (!w || w.type !== 'carousel' || w.hidden) return;
        if (!first) first = w;
        if (w.main && !main) main = w;
      });
    });
    return main || first;
  }

  function reelOpen(r) {
    var m = el('modal'), mc = mainCarousel() || {};
    // videonya sendiri jadi slide pembuka overlay, baru disusul slide carousel utama
    var car = carouselHtml({ cls: 'reelcar', key: 'reelcar', slides: mc.slides, sound: mc.sound,
      lead: has(r.src) ? { type: 'video', src: r.src, poster: r.poster } : null });
    if (!car) return;
    /* Selalu mulai dari slide pertama, dan suara dinyalakan karena overlay ini
       hanya terbuka lewat ketukan, jadi browser mengizinkan. playVid() tetap
       punya jalan mundur ke tanpa suara kalau ditolak. */
    carPos.reelcar = 0;
    introSound = true;
    // video kecil di tombol dihentikan, percuma ikut didekode di balik overlay
    Array.prototype.forEach.call(document.querySelectorAll('.reel-bg'), function (v) { v.pause(); });
    m.className = 'modal full show';
    m.innerHTML = '<div class="reelbox" role="dialog" aria-modal="true" aria-label="' +
      esc(L(r, 'label') || 'Our Showreel') + '">' + car +
      '<button class="reel-x" id="reelx" aria-label="' + T('Tutup', 'Close') + '">' + svg('close') + '</button></div>';
    m.onclick = function (e) { if (e.target === m || e.target.closest('#reelx')) reelClose(); };
    var box = m.querySelector('.carousel');
    if (box) carousel(box);
  }

  function reelClose() {
    var m = el('modal');
    Array.prototype.forEach.call(m.querySelectorAll('video'), function (v) { v.pause(); });
    clearTimeout(carTimers.reelcar);
    m.className = 'modal';
    m.innerHTML = '';
    m.onclick = null;
    playReelBgs();          // video di tombol dihidupkan lagi
  }

  /* Gambar. w = lebar dalam persen kolom, align kiri/tengah/kanan. Gaya logo memakai
     tinggi tetap (h piksel) dan boleh dibalik warnanya di halaman gelap. */
  function imageHtml(w, p) {
    if (!has(w.src)) {
      return editing() ? '<div class="w-ph" data-img="' + p + '.src">' + T('Belum ada gambar.', 'No image yet.') + '</div>' : '';
    }
    if (w.style === 'logo') {
      var h = Math.round(clamp(w.h || 28, 12, 120));
      return '<img class="foot-logo' + (w.invert ? '' : ' noinv') + '" src="' + esc(w.src) + '" alt="' + esc(w.alt || L(w, 'caption')) + '"' +
        (h !== 28 ? ' style="height:' + h + 'px"' : '') + ' data-img="' + p + '.src">';
    }
    var cap = L(w, 'caption'), pct = Math.round(clamp(w.w || 100, 10, 100)), al = w.align || 'center';
    var st = pct < 100 ? 'width:' + pct + '%;' + (al === 'left' ? '' : al === 'right' ? 'margin-left:auto;' : 'margin-left:auto;margin-right:auto;') : '';
    var img = '<img src="' + esc(w.src) + '" alt="' + esc(cap) + '" loading="lazy" data-img="' + p + '.src"' + (w.round === false ? ' class="sq"' : '') + '>';
    if (has(w.link) && !editing()) img = '<a href="' + esc(safeUrl(w.link)) + '" target="_blank" rel="noopener">' + img + '</a>';
    return '<figure class="blk-img wimg"' + (st ? ' style="' + st + '"' : '') + ' data-wimg="' + esc(p) + '">' + img +
      (has(cap) || editing() ? '<figcaption class="blk-cap"' + ed(lp(p, 'caption')) + '>' + esc(cap) + '</figcaption>' : '') +
      '</figure>';
  }

  function textHtml(w, p) {
    var b = L(w, 'body');
    if (!has(b) && !editing()) return '';
    var css = (w.size === 's' ? 'font-size:15px;' : w.size === 'xs' ? 'font-size:12.5px;' : w.size === 'l' ? 'font-size:20px;' : '') +
      (w.align === 'center' ? 'text-align:center;' : '');
    css = css.replace(/;$/, '');
    return '<p class="' + (w.style === 'quote' ? 'quote' : 'p') + '"' + (css ? ' style="' + css + '"' : '') +
      ed(lp(p, 'body'), 1) + '>' + rich(b) + '</p>';
  }

  function headingHtml(w, p) {
    var t = L(w, 'text');
    if (!has(t) && !editing()) return '';
    if (w.size === 's') return '<div class="bs-h"' + ed(lp(p, 'text')) + '>' + esc(t) + '</div>';
    return h2(t, lp(p, 'text'));
  }

  function buttonHtml(w, p) {
    var t = L(w, 'label');
    if (editing()) return '<div class="nextlink wbtn"><span' + ed(lp(p, 'label')) + '>' + esc(t) + '</span><span><i class="ar2">&rsaquo;</i></span></div>';
    if (!has(t) || !has(w.url)) return '';
    return '<a class="nextlink wbtn" href="' + esc(safeUrl(w.url)) + '" target="_blank" rel="noopener">' + esc(t) +
      '<span><i class="ar2">&rsaquo;</i></span></a>';
  }

  /* Semua jenis widget. Masing-masing menerima (widget, alamat data, indeks di halaman)
     dan mengembalikan HTML. String kosong berarti tidak tampil. */
  var WG = {
    heading: headingHtml,
    text: textHtml,
    image: imageHtml,
    button: buttonHtml,
    space: function (w) { return '<div style="height:' + Math.round(clamp(w.h == null ? 26 : w.h, 0, 160)) + 'px"></div>'; },
    carousel: function (w, p, i) {
      var c = carouselHtml({ cls: i ? 'mincar' : '', key: w.id, slides: w.slides, path: p + '.slides', sound: w.sound });
      if (c || !editing()) return c;
      return '<div class="portrait carousel' + (i ? ' mincar' : '') + ' mincar-empty" data-slides="' + esc(p + '.slides') + '"></div>';
    },
    profile: function () {
      var hero = D.hero || {};
      return '<h2 class="name"' + ed('hero.name') + '>' + esc(hero.name || '') + '</h2>' +
        '<p class="role"' + ed(lp('hero', 'role')) + '>' + esc(L(hero, 'role')) + '</p>';
    },
    instagram: function (w) { return igHtml(has(w.user) ? w.user : (D.contact || {}).ig); },
    pins: function (w, p) { return w.shared ? pinRow(D.pins, 'pins') : pinRow(w.items, p + '.items'); },
    table: tableHtml,
    chips: function (w, p) { return chips(w.items, p + '.items'); },
    accordion: accHtml,
    facts: factsHtml,
    qr: qrHtml,
    tiers: tiersHtml,
    contact: contactHtml,
    share: function () {
      return '<button class="nextlink"' + once('share') + ' data-share="1">' + T('Bagikan kartu ini', 'Share this card') +
        '<span>' + svg('share') + '</span></button>';
    },
    showreel: reelBtn
  };

  /* Satu halaman = daftar widget. Di mode baca widget digambar apa adanya tanpa pembungkus,
     jadi tampilannya sama persis dengan kartu sebelum ada widget. Saat menyunting tiap
     widget dibungkus .w supaya bisa dipilih, digeser, dan diatur. */
  function pageHtml(s) {
    var pg = (D.pages || [])[s.page] || {}, list = Array.isArray(pg.widgets) ? pg.widgets : [];
    var base = 'pages.' + s.page + '.widgets', on = editing();
    var html = list.map(function (w, i) {
      if (!w || !WG[w.type] || (w.hidden && !on)) return '';
      var inner = WG[w.type](w, base + '.' + i, i) || '';
      if (!on) return inner;
      return '<div class="w' + (w.hidden ? ' w-off' : '') + (inner ? '' : ' w-blank') + '" data-w="' + i + '" data-wt="' + esc(w.type) + '">' + inner + '</div>';
    }).join('');
    if (on && !list.length) {
      html = '<div class="w-empty">' + T('Halaman ini masih kosong. Ketuk + untuk menambah widget.', 'This page is empty. Tap + to add a widget.') + '</div>';
    }
    return '<div class="step"' + (on ? ' data-wl="' + base + '"' : '') + '>' + html + '</div>';
  }

  /* Video kecil yang main di dalam tombol Our Showreel. Berkasnya sama dengan slide
     pertama carousel, jadi biasanya sudah ada di cache.

     Diputar berulang hanya REEL_BG_S detik pertama, bukan sampai habis. Ini bukan soal
     rasa, tapi soal berat: kalau pengunjung meloncat langsung ke tab Contact lewat navbar
     tanpa mampir ke Kenalan, berkasnya belum di cache, dan tanpa batas ini browser akan
     menarik seluruh 71 detik hanya untuk sebuah strip setinggi 92px. */
  var REEL_BG_S = 15;

  /* Sama alasannya dengan embed Instagram: jangan mengunduh apa pun sebelum
     tombolnya benar-benar mendekat layar. */
  var reelSpy = null;
  function armReelBg() {
    var vs = document.querySelectorAll('#stage .reel-bg');
    if (reelSpy) { reelSpy.disconnect(); reelSpy = null; }
    if (!vs.length) return;
    if (!window.IntersectionObserver) { playReelBgs(); return; }
    reelSpy = new IntersectionObserver(function (list) {
      list.forEach(function (x) {
        if (!x.isIntersecting) return;
        playReelBg(x.target);
        if (reelSpy) reelSpy.unobserve(x.target);
      });
    }, { root: el('stage'), rootMargin: '150px 0px' });
    Array.prototype.forEach.call(vs, function (v) { reelSpy.observe(v); });
  }
  function playReelBgs() {
    Array.prototype.forEach.call(document.querySelectorAll('#stage .reel-bg'), playReelBg);
  }

  function playReelBg(v) {
    if (!v) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    if (!v.dataset.capped) {
      v.dataset.capped = '1';
      v.addEventListener('timeupdate', function () {
        if (v.currentTime >= REEL_BG_S) v.currentTime = 0;
      });
    }
    v.play().catch(function () { /* poster tetap tampil */ });
  }

  /* ---------- shell ---------- */
  var lastStep = -1;
  function render() {
    var s = STEPS[step];
    // Saat menyunting, render ulang di step yang sama (tambah, hapus, geser item) jangan
    // loncat ke atas dan jangan memutar ulang animasi masuk halaman.
    var calm = editing() && step === lastStep;
    var keepY = calm && el('stage') ? el('stage').scrollTop : 0;
    lastStep = step;
    var pct = Math.round((step / (STEPS.length - 1)) * 100);
    var app = el('app');
    app.className = 'app' + (s.dark ? ' dark' : '') + (calm ? ' calm' : '');

    var topnav = s.key === 'cover'
      ? ''
      : '<div class="topnav">' +
        '<button class="back" id="back" aria-label="' + T('Kembali', 'Back') + '">&lsaquo;</button>' +
        '<div class="track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
        '<div class="langs"><button id="len" class="' + (lang === 'en' ? 'on' : '') + '">EN</button>' +
        '<button id="lid" class="' + (lang === 'id' ? 'on' : '') + '">ID</button></div></div>';

    var footer;
    if (s.key === 'cover') {
      footer = '<div class="foot plain"><button class="btn" id="next">' +
        T('Mari Berkenalan', "Let's connect") + '</button></div>';
    } else {
      var tabs = STEPS.map(function (x, i) {
        if (i === 0) return '';
        var cls = (i === step ? 'on' : (seen[i] ? 'done' : ''));
        return '<button data-go="' + i + '" class="' + cls + '"' +
          (i === step ? ' aria-current="page"' : '') + '>' + tabIcon(x) +
          '<b>' + esc(T(x.tab[0], x.tab[1])) + '</b></button>';
      }).join('');
      var av = (D.images || {}).hero, ig = (D.contact || {}).ig;
      footer = '<div class="foot"><div class="cta">' +
        '<button class="btn wabtn" id="wa">' + svg('wa') + T('Chat WhatsApp', 'Chat on WhatsApp') +
        (has(av) ? '<span class="wa-av"><img src="' + esc(av) + '" alt=""></span>' : '') + '</button>' +
        (has(ig) ? '<a class="btn wabtn igbtn" href="https://instagram.com/' + esc(encodeURIComponent(ig)) +
          '" target="_blank" rel="noopener" aria-label="Instagram @' + esc(ig) + '">' + svg('ig') + '</a>' : '') +
        '</div>' +
        '<nav class="nav" id="nav" aria-label="' + T('Bagian kartu', 'Card sections') + '">' + tabs + '</nav>' +
        '</div>';
    }

    ONE = {};
    var body = s.key === 'cover' ? coverHtml() : pageHtml(s);
    if (s.key !== 'cover' && step < STEPS.length - 1) {
      body = body.replace(/<\/div>\s*$/, '<button class="nextlink" id="next">' +
        T('Lanjut', 'Continue') + '<span>' + esc(T(STEPS[step + 1].tab[0], STEPS[step + 1].tab[1])) +
        '<i class="ar2">&rsaquo;</i></span></button></div>');
    }

    app.innerHTML = topnav + '<div class="stage" id="stage">' + body + '</div>' +
      footer + '<div class="modal" id="modal"></div>';
    if (keepY) el('stage').scrollTop = keepY;

    bind();
    (window.BioCard.onRender || []).forEach(function (fn) {
      try { fn(); } catch (err) { /* editor gagal, kartu tetap tampil */ }
    });
  }

  function bind() {
    var s = STEPS[step];
    if (el('next')) el('next').addEventListener('click', next);
    if (el('back')) el('back').addEventListener('click', back);
    if (el('wa')) el('wa').addEventListener('click', waOpen);
    Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (b) {
      b.addEventListener('click', function () { share(b); });
    });
    armReelBg();
    Array.prototype.forEach.call(document.querySelectorAll('#stage .reel'), function (r) {
      var w = pget(r.dataset.reel) || {};
      r.addEventListener('click', function () { if (!editing()) reelOpen(w); });
      r.addEventListener('keydown', function (e) {
        if (editing() || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        reelOpen(w);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.iglink'), function (b) {
      b.addEventListener('click', function () { igOpen(b.dataset.ig, b.dataset.name); });
    });
    var nv = el('nav');
    if (nv) nv.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      go(+b.dataset.go);
    });
    if (el('lid')) el('lid').addEventListener('click', function () { setLang('id'); });
    if (el('len')) el('len').addEventListener('click', function () { setLang('en'); });

    Array.prototype.forEach.call(document.querySelectorAll('#stage .acc[data-acc]'), function (pn) {
      pn.addEventListener('click', function (e) {
      var it = e.target.closest('.acc-i');
      if (!it || !e.target.closest('.acc-h')) return;
      /* di mode sunting, ketukan pada teks dipakai untuk mengedit, bukan membuka */
      if (editing() && !e.target.closest('.acc-x')) return;
      var x = it.querySelector('.acc-x');
      if (!x) return;    // accordion yang selalu terbuka
      var k = it.dataset.pil, on = !it.classList.contains('on');
      open[k] = on;
      it.classList.toggle('on', on);
      x.setAttribute('aria-expanded', String(on));
      });
    });
    [el('tiernav'), el('burger'), el('tflats')].forEach(function (n) {
      if (n) n.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tier]'); if (!b) return;
        pickTier(+b.dataset.tier);
      });
    });
    armIg();
    if (el('burger')) tilt(el('burger'));
    Array.prototype.forEach.call(document.querySelectorAll('#stage .carousel[data-car]'), carousel);
    if (el('tflats')) spyTiers();
    if (el('tback')) el('tback').addEventListener('click', function () {
      tier = -1;
      if (spy) { spy.disconnect(); spy = null; }
      render();
    });

    if (s.key !== 'cover') swipe(el('stage'));
  }

  /* ---------- navigation ---------- */
  function next() { go(step + 1); }
  function back() { go(step - 1); }
  function go(i) {
    if (i < 0 || i > STEPS.length - 1) return;
    step = i;
    seen[i] = true;
    render();
    var st = el('stage'); if (st) st.scrollTop = 0;
  }
  function setLang(l) { if (l !== lang) { lang = l; render(); } }

  /* Hanya tier yang disorot yang datar, sisanya tetap lingkaran 3D miring.
     Pilihan pertama menggambar semuanya 3D dulu, lalu yang dipilih berputar jadi datar.
     Pilihan berikutnya cukup menggulir dan memindahkan sorotan. */
  var flipPending = false;
  var spyQuiet = 0;   // selama gulir otomatis, sorotan tidak ikut berpindah-pindah
  function pickTier(i) {
    var first = tier < 0;
    tier = i;
    spyQuiet = Date.now() + 900;
    if (first) {
      flipPending = true;
      render();
      flipPending = false;
      // dua frame, supaya lingkaran sempat tergambar 3D dan transisi ke datar kelihatan
      requestAnimationFrame(function () { requestAnimationFrame(markTier); });
    } else {
      markTier();
    }
    var t = el('tier' + i);
    if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function markTier() {
    Array.prototype.forEach.call(document.querySelectorAll('#tiernav [data-tier]'), function (b) {
      var on = +b.dataset.tier === tier;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tflat'), function (n) {
      n.classList.toggle('on', +n.dataset.i === tier);
    });
  }
  /* Tombol tier yang menempel di atas ikut menandai tier yang sedang dibaca. */
  /* loading="lazy" saja tidak cukup: ambang Chrome longgar, di koneksi cepat iframe
     ditarik sekitar 1250px sebelum masuk layar, jadi 373 KB dari instagram.com ikut
     berebut pipa dengan video slide pertama. Src baru dipasang saat kotaknya betul
     betul mendekat. Tanpa IntersectionObserver, dipasang langsung. */
  var igSpy = null;
  function armIg() {
    var fs = Array.prototype.filter.call(document.querySelectorAll('.igframe'), function (f) { return f.dataset.src; });
    if (igSpy) { igSpy.disconnect(); igSpy = null; }
    if (!fs.length) return;
    var load = function (f) {
      if (!f.dataset.src) return;
      f.src = f.dataset.src;
      delete f.dataset.src;
      if (igSpy) igSpy.unobserve(f);
    };
    if (!window.IntersectionObserver) { fs.forEach(load); return; }
    igSpy = new IntersectionObserver(function (list) {
      list.forEach(function (x) { if (x.isIntersecting) load(x.target); });
    }, { root: el('stage'), rootMargin: '250px 0px' });
    fs.forEach(function (f) { igSpy.observe(f); });
  }

  var spy = null;
  function spyTiers() {
    if (spy) spy.disconnect();
    if (!window.IntersectionObserver) return;
    spy = new IntersectionObserver(function (list) {
      list.forEach(function (x) {
        if (x.isIntersecting && Date.now() > spyQuiet) { tier = +x.target.dataset.i; markTier(); }
      });
    }, { root: el('stage'), rootMargin: '-35% 0px -60% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.tflat'), function (n) { spy.observe(n); });
  }

  /* Suara video Kenalan. Pilihan suara diingat selama halaman terbuka; video ikut
     hilang saat pindah step, jadi suara tidak terus berbunyi di step lain. */
  var introSound = false;
  var SOUND_SLIDES = 2;
  function quiet(v) { return v.dataset.mute === '1'; }
  function paintSound(b) {
    b.innerHTML = svg(introSound ? 'soundOn' : 'soundOff');
    b.setAttribute('aria-pressed', String(introSound));
    b.setAttribute('aria-label', introSound ? T('Matikan suara', 'Mute') : T('Nyalakan suara', 'Unmute'));
  }
  function playVid(v, b) {
    var p = v.play();
    if (p && p.catch) p.catch(function () {
      // browser menolak suara tanpa ketukan: lanjut tanpa suara supaya video tetap jalan
      if (!v.muted) {
        v.muted = true;
        introSound = false;
        if (b) paintSound(b);
        v.play().catch(function () { /* poster tetap tampil */ });
      }
    });
  }

  /* Carousel step Kenalan. Geser jari memakai scroll-snap bawaan browser, jadi rasanya sama
     seperti Instagram. Maju sendiri saat video selesai atau setelah 5 detik untuk gambar,
     dan kembali ke slide pertama setelah slide terakhir. Posisi slide diingat saat render ulang. */
  /* Posisi dan timer disimpan per carousel (data-car), jadi beberapa carousel bisa hidup
     di satu halaman dan posisinya tetap diingat saat render ulang. */
  var carPos = {}, carTimers = {};
  var IMG_MS = 5000;
  function carousel(box) {
    var key = box.dataset.car;
    var track = box.querySelector('.car-track');
    var slides = Array.prototype.slice.call(track.children);
    var dots = box.querySelectorAll('.car-dots i');
    var sb = box.querySelector('.vsound');
    var n = slides.length;
    var carIndex = carPos[key] || 0;
    clearTimeout(carTimers[key]);
    if (carIndex > n - 1) carIndex = 0;

    function media(i) { return slides[i] && slides[i].querySelector('video'); }
    /* Hanya slide pertama yang punya src sejak awal. Sisanya dipasang saat gilirannya dekat,
       supaya di sinyal lemah seluruh jalur dipakai video yang sedang ditonton, bukan dibagi empat. */
    function arm(i, pre) {
      var v = media(i);
      if (!v) return null;
      if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
      if (pre) v.preload = pre;
      return v;
    }
    function alive() { return document.body.contains(track); }
    function activate(i) {
      clearTimeout(carTimers[key]);
      carIndex = i;
      carPos[key] = i;
      Array.prototype.forEach.call(dots, function (d, j) { d.classList.toggle('on', j === i); });
      slides.forEach(function (s, j) {
        var o = media(j);
        if (o && j !== i && !o.paused) { o.pause(); o.currentTime = 0; }
      });
      var v = arm(i, 'auto');
      if (sb) sb.hidden = !v || quiet(v);   // gambar dan slide senyap tidak punya suara
      if (v) { v.volume = 1; v.muted = !introSound || quiet(v); playVid(v, sb); }
      else if (n > 1) carTimers[key] = setTimeout(function () { if (alive()) next(); }, IMG_MS);
      if (n > 1) arm((i + 1) % n, 'metadata');   // cuma header, bukan seluruh berkas
    }
    // sengaja bukan go(), supaya tidak menutupi go() global yang memindahkan step
    function slideTo(i) {
      if (n < 2 || !alive()) return;
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      activate(i);
    }
    function next() { slideTo((carIndex + 1) % n); }
    function prev() { slideTo((carIndex - 1 + n) % n); }
    slides.forEach(function (s, j) {
      var v = media(j);
      if (v) v.addEventListener('ended', function () { if (j === carIndex && alive()) next(); });
    });
    // slide dianggap pindah setelah geseran berhenti, bukan di tengah jalan
    var settle = null;
    track.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== carIndex && i >= 0 && i < n) activate(i);
      }, 90);
    }, { passive: true });
    if (sb) sb.addEventListener('click', function () {
      introSound = !introSound;
      var v = arm(carIndex, 'auto');
      if (v) { v.volume = 1; v.muted = !introSound || quiet(v); playVid(v, sb); }
      /* Browser, terutama Safari iOS, hanya mengizinkan video bersuara yang pernah diputar
         lewat ketukan. Selagi masih di dalam ketukan ini, video lain diputar sebentar dengan
         volume 0 lalu dihentikan, supaya nanti boleh bersuara saat carousel maju sendiri. */
      if (introSound) slides.forEach(function (s, j) {
        var o = arm(j);
        if (!o || j === carIndex || quiet(o)) return;
        /* iOS mengabaikan volume, jadi video langsung dihentikan di baris yang sama.
           Panggilan play() di dalam ketukan sudah cukup untuk membuka izin suara. */
        o.volume = 0;
        o.muted = false;
        var pr = o.play();
        o.pause();
        o.currentTime = 0;
        o.volume = 1;
        if (pr && pr.catch) pr.catch(function () { /* pause() sengaja memotong play() */ });
      });
      paintSound(sb);
    });
    var bp = box.querySelector('.car-nav.prev'), bn = box.querySelector('.car-nav.next');
    if (bp) bp.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
    if (bn) bn.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    track.scrollLeft = carIndex * track.clientWidth;
    activate(carIndex);
  }

  /* Tumpukan burger ikut miring mengikuti jari, lalu kembali ke posisi diam. */
  function tilt(node) {
    var sc = node.querySelector('.scene');
    if (!sc) return;
    function move(e) {
      var r = node.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5;
      var py = (e.clientY - r.top) / r.height - .5;
      sc.style.setProperty('--rx', (58 - py * 16) + 'deg');
      sc.style.setProperty('--rz', (-16 + px * 26) + 'deg');
    }
    function rest() { sc.style.removeProperty('--rx'); sc.style.removeProperty('--rz'); }
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', rest);
    node.addEventListener('pointercancel', rest);
  }

  /* Riak cahaya di titik sentuh. Murni hiasan, tidak menahan klik apa pun. */
  function ripple(e) {
    if (editing()) return;
    var r = document.createElement('span');
    r.className = 'ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    r.addEventListener('animationend', function () { r.remove(); });
  }

  /* Getar ringan di setiap aksi. Android lewat navigator.vibrate. Safari iOS tidak
     punya API itu, tapi sejak iOS 18 mengetuk <input switch> memberi haptic, jadi
     dipakai sakelar tersembunyi sebagai jalan belakang. Harus dipanggil dari gestur. */
  function haptic() {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    // pola yang sama dengan library ios-haptics: sakelar baru tiap kali, dipasang, diklik, dilepas
    var lb = document.createElement('label');
    lb.setAttribute('aria-hidden', 'true');
    lb.style.display = 'none';
    var inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.setAttribute('switch', '');
    lb.appendChild(inp);
    document.head.appendChild(lb);
    lb.click();
    document.head.removeChild(lb);
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest || t.closest('[contenteditable="true"]')) return;
    if (t.closest('button, a, [data-tier], .acc-h')) haptic();
  }, true);

  /* Lapisan gradient hidup di body, dipasang sekali supaya geraknya tidak
     terpotong setiap kali step digambar ulang. */
  function mesh() {
    if (document.querySelector('.mesh')) return;
    var m = document.createElement('div');
    m.className = 'mesh';
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML = '<i></i><i></i><i></i>';
    document.body.insertBefore(m, document.body.firstChild);
  }

  function swipe(node) {
    if (!node || editing()) return;
    var x0 = null, y0 = null;
    node.addEventListener('touchstart', function (e) {
      // geser di carousel milik carousel, jangan ikut memindahkan step kartu
      if (e.target.closest && e.target.closest('.carousel')) { x0 = y0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    node.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) { haptic(); dx < 0 ? next() : back(); }
      x0 = y0 = null;
    }, { passive: true });
  }
  document.addEventListener('keydown', function (e) {
    if (editing()) return;
    if (el('modal') && el('modal').classList.contains('show')) {
      if (e.key === 'Escape') {
        if (el('modal').classList.contains('full')) reelClose();
        else if (el('modal').classList.contains('igm')) igClose();
        else el('modal').classList.remove('show');
      }
      return;
    }
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') back();
  });

  /* ---------- whatsapp ---------- */
  function waOpen() {
    var f = D.wa_form || {}, m = el('modal');
    m.className = 'modal';
    var fields = (f.fields || []).map(function (fd) {
      return '<div class="fld"><label for="f_' + esc(fd.key) + '">' + esc(L(fd, 'label')) + '</label>' +
        '<input id="f_' + esc(fd.key) + '" autocomplete="' + esc(fd.autocomplete || 'off') + '"></div>';
    }).join('');
    var logo = (D.images || {}).logo;
    // simpan kontak dulu sebelum ke WhatsApp, karena dari WhatsApp orang jarang kembali ke kartu
    var vcf = has(D.id) ? '/api/vcard?card=' + encodeURIComponent(D.id) +
      '&u=' + encodeURIComponent(location.href.split('#')[0]) : '';
    m.innerHTML = '<div class="box" role="dialog" aria-modal="true">' +
      (has(logo) ? '<img class="box-logo" src="' + esc(logo) + '" alt="Increasink">' : '') +
      '<div class="box-h">' + esc(L(f, 'head')) + '</div>' +
      '<p class="box-s">' + esc(L(f, 'sub')) + '</p>' +
      (vcf ? '<a class="btn ghost" id="wasave" href="' + esc(vcf) + '">' + svg('person') +
        T('Simpan kontak saya', 'Save my contact') + '</a>' : '') + fields +
      '<div class="err" id="waerr">' + T('Semua kolom wajib diisi.', 'Please fill in every field.') + '</div>' +
      '<button class="btn" id="wasend" style="margin-top:20px">' + svg('wa') + T('Kirim ke WhatsApp', 'Send to WhatsApp') + '</button>' +
      '<button class="skip" id="wacancel" style="width:100%;margin-top:8px">' + T('Batal', 'Cancel') + '</button></div>';
    m.classList.add('show');
    m.onclick = function (e) { if (e.target === m) m.classList.remove('show'); };
    el('wasend').addEventListener('click', waSend);
    el('wacancel').addEventListener('click', function () { m.classList.remove('show'); });
    var first = (f.fields || [])[0];
    if (first) setTimeout(function () { var i = el('f_' + first.key); if (i) i.focus(); }, 80);
  }

  function waSend() {
    var f = D.wa_form || {}, c = D.contact || {}, vals = {}, firstMiss = null;
    (f.fields || []).forEach(function (fd) {
      var i = el('f_' + fd.key);
      vals[fd.key] = i ? i.value.trim() : '';
      var miss = !!fd.required && !vals[fd.key];
      if (i) i.classList.toggle('miss', miss);
      if (miss && !firstMiss) firstMiss = i || true;
    });
    if (firstMiss) {
      el('waerr').classList.add('show');
      if (firstMiss.focus) firstMiss.focus();
      return;
    }
    // link kartu ikut di pesan, supaya pengirim bisa balik ke kartu dari chat WhatsApp
    vals.link = location.href.split('#')[0];
    var msg = L(f, 'template').replace(/\{(\w+)\}/g, function (_, k) {
      return has(vals[k]) ? vals[k] : T('(tidak diisi)', '(not filled)');
    });
    window.open('https://wa.me/' + c.wa + '?text=' + encodeURIComponent(msg), '_blank');
    el('modal').classList.remove('show');
  }

  function share(b) {
    var url = location.href.split('#')[0];
    var title = ((D.hero || {}).name || '') + ' · Bio GAINS';
    if (navigator.share) navigator.share({ title: title, text: title, url: url }).catch(function () {});
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      var o = b.innerHTML;
      b.textContent = T('Link tersalin', 'Link copied');
      setTimeout(function () { b.innerHTML = o; }, 1500);
    }
  }

  /* ---------- pintu untuk layer editor ----------
     Diisi sebelum render pertama karena render() sudah memanggil onRender. */
  window.BioCard = {
    editing: false,
    onRender: [],
    data: function () { return D; },
    lang: function () { return lang; },
    steps: function () { return STEPS; },
    at: function () { return step; },
    /* dipakai editor untuk draft dan patokan yang masih berformat lama */
    migrate: migrate,
    icons: ICON,
    go: go,
    render: render,
    /* Dipakai setelah urutan atau visibilitas berubah. */
    rebuild: function () {
      buildSteps();
      if (step > STEPS.length - 1) step = STEPS.length - 1;
      render();
    }
  };

  /* Instagram mengirim tinggi kontennya sendiri lewat postMessage {type:"MEASURE"}.
     Dipakai supaya tinggi iframe pas tanpa menebak, dan ikut menyesuaikan kalau lebar
     kartu berubah. Tinggi di CSS tetap jadi cadangan kalau pesannya tidak pernah datang.
     Origin diperiksa, jangan percaya postMessage dari sembarang halaman. */
  window.addEventListener('message', function (e) {
    if (String(e.origin || '').indexOf('instagram.com') < 0) return;
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || d.type !== 'MEASURE' || !d.details || !d.details.height) return;
    // cocokkan dengan iframe pengirimnya: embed profil atau post di lembar Instagram
    var fs = document.querySelectorAll('.igframe, .igpost'), f = null;
    for (var i = 0; i < fs.length; i++) if (fs[i].contentWindow === e.source) f = fs[i];
    f = f || document.querySelector('.igframe');
    if (f) f.style.height = Math.min(Math.max(+d.details.height, 180), f.classList.contains('igpost') ? 2400 : 900) + 'px';
  });

  mesh();
  document.addEventListener('pointerdown', ripple, { passive: true });

  migrate(D);
  buildSteps();
  render();
})();
