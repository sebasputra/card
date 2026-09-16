/* Increasink Bio Card. Step flow renderer, membaca global DATA dari data.js. */
(function () {
  'use strict';

  var D = window.DATA || {};
  var lang = D.lang_default || 'id';
  var step = 0;      // indeks step aktif
  var open = {};     // pilar GAINS yang sedang terbuka, dikunci per key
  var tier = -1;     // indeks tier di step How to Refer Me, -1 berarti belum dipilih

  var PILL_ALL = ['goal', 'accomplishment', 'interest', 'network', 'skill'];
  var PILLARS = PILL_ALL.slice();

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

  var ICON = {
    mail: '<path d="M2 5h20v14H2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m2 6 10 7 10-7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    phone: '<path d="M6 3h4l2 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor"/>',
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
  function svg(n, c) { return '<svg class="' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; }
  /* Step BNI memakai logo aslinya. Abu saat diam, warna penuh saat aktif, diatur di CSS. */
  function tabIcon(x) {
    var logo = (D.images || {}).bni;
    if (x.key === 'bni' && has(logo)) return '<img class="tabimg" src="' + esc(logo) + '" alt="" aria-hidden="true">';
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

  /* Blok tambahan dari tombol + di editor: kolom info, teks, gambar.
     Tampil di akhir step, atau di titik <!--blocks--> kalau view menyediakannya.
     Saat menyunting semua blok selalu digambar supaya urutan DOM sama dengan indeks data. */
  function blocksHtml(key) {
    var list = (D.blocks || {})[key];
    list = Array.isArray(list) ? list : [];
    var on = editing();
    if (!list.length && !on) return '';
    var p = 'blocks.' + key;
    var html = list.map(function (b, i) {
      var bp = p + '.' + i;
      b = b || {};
      if (b.type === 'row') {
        if (!on && !has(L(b, 'label')) && !has(L(b, 'value'))) return '';
        return '<div class="blk blk-row meta"><div class="meta-row">' +
          '<div class="meta-k"' + ed(lp(bp, 'label')) + '>' + esc(L(b, 'label')) + '</div>' +
          '<div class="meta-v"' + ed(lp(bp, 'value')) + '>' + esc(L(b, 'value')) + '</div></div></div>';
      }
      if (b.type === 'text') {
        if (!on && !has(L(b, 'body'))) return '';
        return '<div class="blk blk-text"><p class="p"' + ed(lp(bp, 'body')) + '>' + esc(L(b, 'body')) + '</p></div>';
      }
      if (b.type === 'image' && has(b.src)) {
        var cap = L(b, 'caption');
        return '<figure class="blk blk-img"><img src="' + esc(b.src) + '" alt="' + esc(cap) + '" loading="lazy" data-img="' + bp + '.src">' +
          (has(cap) || on ? '<figcaption class="blk-cap"' + ed(lp(bp, 'caption')) + '>' + esc(cap) + '</figcaption>' : '') +
          '</figure>';
      }
      return on ? '<div class="blk"></div>' : '';
    }).join('');
    if (!html && !on) return '';
    return '<div class="blocks"' + (on ? ' data-arr="' + p + '" data-kind="block"' : '') + '>' + html + '</div>';
  }

  /* ---------- step definitions ---------- */
  var STEP_DEF = {
    intro:    { dark: false, icon: 'person', tab: ['Kenalan', 'About'],     label: ['Perkenalan', 'Introduction'] },
    bni:      { dark: false, icon: 'badge',  tab: ['BNI', 'BNI'],           label: ['Keanggotaan BNI', 'BNI Membership'] },
    gains:    { dark: false, icon: 'gains',  tab: ['GAINS', 'GAINS'],       label: ['Bio GAINS', 'Bio GAINS'] },
    personal: { dark: false, icon: 'heart',  tab: ['Personal', 'Personal'], label: ['Di Luar Pekerjaan', 'Beyond Work'] },
    refer:    { dark: false, icon: 'hand',   tab: ['Referral', 'Refer'],    label: ['Cara Mereferensikan', 'How to Refer'] },
    connect:  { dark: true,  icon: 'chat',   tab: ['Kontak', 'Contact'],    label: ['Kontak', 'Contact'] }
  };
  var STEP_ALL = ['intro', 'bni', 'gains', 'personal', 'refer', 'connect'];
  var STEPS = [];

  /* Urutan tersimpan di data.order. Key yang belum tercatat di sana ikut di
     belakang, jadi menambah section baru di engine tidak memecahkan kartu lama. */
  function resolveOrder(saved, all) {
    var out = [];
    (saved || []).forEach(function (k) {
      if (all.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k);
    });
    all.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function buildSteps() {
    var o = D.order || {}, hidden = o.hidden || [];
    STEPS = [{ key: 'cover', dark: false }];
    resolveOrder(o.steps, STEP_ALL).forEach(function (k) {
      var off = hidden.indexOf(k) >= 0;
      if (off && !editing()) return;
      var d = STEP_DEF[k];
      STEPS.push({ key: k, dark: d.dark, icon: d.icon, tab: d.tab, label: d.label, off: off });
    });
  }
  function buildPillars() {
    PILLARS = resolveOrder((D.order || {}).pillars, PILL_ALL);
  }
  var seen = { 1: true };

  var view = {};

  /* Deretan pin BNI. Sumbernya satu array dipakai di dua tempat, cover dan step BNI,
     dan keduanya tidak pernah dirender bersamaan karena satu step satu layar. */
  function pinRow() {
    var arr = Array.isArray(D.pins) ? D.pins : [];
    if (!arr.length && !editing()) return '';
    return '<div class="pins" data-arr="pins" data-kind="pin">' +
      arr.map(function (p, i) {
        return '<span class="pin">' +
          '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || '') + '" loading="lazy"></span>';
      }).join('') + '</div>';
  }

  view.cover = function () {
    var hero = D.hero || {}, img = (D.images || {}).cover || (D.images || {}).hero;
    var inner = has(img)
      ? '<img class="ring-img" src="' + esc(img) + '" alt="' + esc(hero.name) + '">'
      : '<span class="ring-ini">' + esc(hero.initials || '') + '</span>';
    return '<div class="cover">' +
      '<div class="ring" data-img="images.cover">' + inner + '</div>' +
      pinRow() +
      '<div class="cover-kicker"' + ed(lp('hero', 'connector')) + '>' + esc(L(hero, 'connector')) + '</div>' +
      '<h1 class="cover-name"' + ed('hero.name') + '>' + esc(hero.name || '') + '</h1>' +
      '<p class="cover-role"' + ed(lp('hero', 'role')) + '>' + esc(L(hero, 'role')) + '</p>' +
      (has((D.bni || {}).chapter) || editing()
        ? '<div class="cover-meta"' + ed('bni.chapter') + '>' + esc((D.bni || {}).chapter) + '</div>' : '') +
      '</div>';
  };

  /* Carousel ala Instagram: video dan gambar dari data.intro_slides. Video mulai tanpa suara
     karena browser HP menolak autoplay bersuara, tombol speaker menyalakan suara lewat ketukan.
     Dipakai dua kali, di step Kenalan dan di dalam overlay Our Showreel, tapi tidak pernah
     bersamaan karena satu step satu layar, jadi id "car" dan "vsound" tetap tunggal. */
  function carouselHtml(extra) {
    var hero = D.hero || {};
    var slides = (Array.isArray(D.intro_slides) ? D.intro_slides : []).filter(function (s) { return s && has(s.src); });
    if (!slides.length) return '';
    var hasVid = slides.some(function (s) { return s.type === 'video'; });
    return '<div class="portrait carousel' + (extra ? ' ' + extra : '') + '" id="car" aria-roledescription="carousel">' +
        '<div class="car-track">' + slides.map(function (s, i) {
          return '<div class="car-slide">' + (s.type === 'video'
            ? '<video class="car-media"' + (i === 0 ? ' src="' + esc(s.src) + '"' : '') +
              ' data-src="' + esc(s.src) + '"' + (has(s.poster) ? ' poster="' + esc(s.poster) + '"' : '') +
              ' muted playsinline preload="' + (i === 0 ? 'auto' : 'none') + '"' + (slides.length === 1 ? ' loop' : '') +
              ' aria-label="' + esc(hero.name || '') + '"></video>'
            : '<img class="car-media" src="' + esc(s.src) + '" alt="" draggable="false">') + '</div>';
        }).join('') + '</div>' +
        (slides.length > 1 ? '<div class="car-dots" aria-hidden="true">' +
          slides.map(function () { return '<i></i>'; }).join('') + '</div>' : '') +
          (hasVid ? '<button class="vsound" id="vsound" aria-pressed="' + introSound + '" aria-label="' +
          (introSound ? T('Matikan suara', 'Mute') : T('Nyalakan suara', 'Unmute')) + '">' +
          svg(introSound ? 'soundOn' : 'soundOff') + '</button>' : '') + '</div>';
  }

  /* Grid Instagram resmi lewat /<user>/embed/. Bukan widget pihak ketiga, tapi juga bukan
     endpoint yang didokumentasikan Meta, jadi anggap bisa berubah sewaktu-waktu. Dimuat
     malas supaya tidak ikut mengunduh saat carousel baru dibuka. */
  function igHtml() {
    var ig = (D.contact || {}).ig;
    if (!has(ig) || (D.ig_embed === false)) return '';
    return '<div class="igbox">' +
      '<div class="igbox-h">Instagram <b>@' + esc(ig) + '</b></div>' +
      '<iframe class="igframe" loading="lazy" scrolling="no" frameborder="0"' +
      ' title="Instagram @' + esc(ig) + '"' +
      ' src="https://www.instagram.com/' + esc(encodeURIComponent(ig)) + '/embed/"></iframe>' +
      '<a class="igbox-a" href="https://instagram.com/' + esc(encodeURIComponent(ig)) + '" target="_blank" rel="noopener">' +
      T('Buka profil', 'Open profile') + ' &rsaquo;</a></div>';
  }

  view.intro = function () {
    var hero = D.hero || {}, img = (D.images || {}).hero;
    var p = carouselHtml() ||
      (has(img)
        ? '<div class="portrait" data-img="images.hero" style="background-image:url(' + esc(img) + ')"></div>'
        : '<div class="portrait" data-img="images.hero"><span class="portrait-ini">' + esc(hero.initials || '') + '</span></div>');
    return '<div class="step">' +
      p +
      '<h2 class="name"' + ed('hero.name') + '>' + esc(hero.name || '') + '</h2>' +
      '<p class="role"' + ed(lp('hero', 'role')) + '>' + esc(L(hero, 'role')) + '</p>' +
      (has(L(hero, 'tagline')) || editing()
        ? '<p class="quote"' + ed(lp('hero', 'tagline'), 1) + '>' + L(hero, 'tagline') + '</p>' : '') +
      igHtml() +
      '</div>';
  };

  view.bni = function () {
    var b = D.bni || {}, biz = D.bisnis || {}, rows = '';
    function row(k, v, path) {
      if (!has(v) && !editing()) return '';
      return '<div class="meta-row"><div class="meta-k">' + esc(k) + '</div>' +
        '<div class="meta-v"' + ed(path) + '>' + v + '</div></div>';
    }
    rows += row('Chapter', esc(b.chapter), 'bni.chapter');
    rows += row(T('Klasifikasi', 'Classification'), esc(L(b, 'klasifikasi')), lp('bni', 'klasifikasi'));
    rows += row(T('Peran', 'Role'), esc(L(b, 'peran')), lp('bni', 'peran'));
    rows += row(T('Anggota Sejak', 'Member Since'), esc(L(b, 'since')), lp('bni', 'since'));
    rows += row(T('Bisnis', 'Business'),
      '<span' + ed('bisnis.nama') + '>' + esc(biz.nama) + '</span>' +
      (has(biz.sejak) || editing()
        ? ' <span style="color:var(--dm)">est. <span' + ed('bisnis.sejak') + '>' + esc(biz.sejak) + '</span></span>' : ''),
      '');
    return '<div class="step">' + h2(T('Keanggotaan', 'Membership')) +
      pinRow() +
      '<div class="meta">' + rows + '</div><!--blocks-->' + chips(b.status, 'bni.status') +
      (has(L(biz, 'layanan')) || editing()
        ? '<p class="p"' + ed(lp('bisnis', 'layanan'), 1) + '>' + L(biz, 'layanan') + '</p>' : '') +
      '</div>';
  };

  /* Lima pilar tampil sekaligus, isinya dibuka tutup lewat tombol plus. */
  view.gains = function () {
    var rows = PILLARS.map(function (key, i) {
      var g = (D.gains || {})[key] || {};
      var ipath = 'gains.' + key + '.items';
      var items = (g.items || []).map(function (it, j) {
        return '<li' + ed(ipath + '.' + j + '.' + lang, 1) + '>' + (it[lang] || it.id || it.en || '') + '</li>';
      }).join('');
      var on = !!open[key];
      return '<div class="acc-i' + (on ? ' on' : '') + '" data-pil="' + esc(key) + '">' +
        '<div class="acc-h">' +
        '<span class="acc-l" aria-hidden="true">' + esc(g.letter || key.charAt(0).toUpperCase()) + '</span>' +
        '<span class="acc-t"' + ed(lp('gains.' + key, 'title')) + '>' + esc(L(g, 'title')) + '</span>' +
        '<button class="acc-x" aria-expanded="' + on + '" aria-label="' + esc(L(g, 'title')) + '"></button>' +
        '</div>' +
        '<div class="acc-p"><div><div class="acc-in">' +
        (has(L(g, 'body')) || editing()
          ? '<p class="p"' + ed(lp('gains.' + key, 'body'), 1) + '>' + L(g, 'body') + '</p>' : '') +
        (items || (editing() && g.items)
          ? '<ul class="list" data-arr="' + ipath + '" data-kind="ml">' + items + '</ul>' : '') +
        chips(g.chips, 'gains.' + key + '.chips') +
        '</div></div></div></div>';
    }).join('');
    return '<div class="step">' +
      h2(T('Profil GAINS', 'GAINS Profile')) +
      '<div class="acc" id="pillnav" data-ord="pillars">' + rows + '</div></div>';
  };

  view.personal = function () {
    var m = D.ministry || {}, o = D.offrecord || {};
    var facts = (o.facts || []).map(function (f, i) {
      return '<div class="fact"><div class="fact-n"' + ed('offrecord.facts.' + i + '.n') + '>' + esc(f.n) + '</div>' +
        '<div class="fact-t"' + ed('offrecord.facts.' + i + '.' + lang, 1) + '>' + (f[lang] || f.id || f.en || '') + '</div></div>';
    }).join('');
    return '<div class="step">' +
      h2(L(m, 'title'), lp('ministry', 'title')) + chips(m.chips, 'ministry.chips') +
      '<div style="height:26px"></div>' + h2(L(o, 'title'), lp('offrecord', 'title')) +
      '<div class="facts" data-arr="offrecord.facts" data-kind="fact">' + facts + '</div></div>';
  };

  /* Tumpukan 3D cuma ilustrasi. Pilihan tier lewat tombol di bawahnya,
     karena lapisan 3D terlalu kecil untuk diketuk jari. */
  /* Sebelum memilih: tumpukan 3D sebagai ilustrasi. Setelah memilih: tumpukan berputar
     jadi lingkaran datar berurutan ke bawah, tiap lingkaran langsung diikuti deskripsinya. */
  view.refer = function () {
    var r = D.refer || {}, list = r.tiers || [];
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
    var head = '<div class="step">' + h2(L(r, 'title'), lp('refer', 'title')) +
      (has(L(r, 'intro')) || editing()
        ? '<p class="p"' + ed(lp('refer', 'intro')) + '>' + esc(L(r, 'intro')) + '</p>' : '');
    var nav = '<div class="tierbar">' + back +
      '<div class="tiers" id="tiernav" data-arr="refer.tiers" data-kind="fixed">' + btns + '</div></div>';
    if (tier < 0) {
      var slabs = list.map(function (x, i) {
        return '<div class="slab" data-tier="' + i + '" aria-hidden="true"' +
          ' style="--tc:' + esc(x.color || '#8E8E93') + ';--i:' + (list.length - 1 - i) + '">' +
          '<span class="bot"></span><span class="top"></span>' +
          '<b class="nm">' + esc(x.name || '') + '</b></div>';
      }).join('');
      return head + '<div class="burger" id="burger"><div class="scene">' + slabs + '</div></div>' + nav +
        '<p class="pick">' + T('Pilih salah satu lapisan.', 'Pick one of the layers.') + '</p></div>';
    }
    var flats = list.map(function (x, i) {
      var tp = 'refer.tiers.' + i;
      return '<div class="tflat' + (i === tier && !flipPending ? ' on' : '') + '" id="tier' + i + '" data-i="' + i + '" style="--tc:' + esc(x.color || '#8E8E93') + ';--d:' + i + '">' +
        '<div class="tdisc" data-tier="' + i + '"><b' + ed(tp + '.name') + '>' + esc(x.name || '') + '</b></div>' +
        '<div class="tier-lvl"' + ed(lp(tp, 'level')) + '>' + esc(L(x, 'level')) + '</div>' +
        '<p class="tier-body"' + ed(lp(tp, 'body')) + '>' + esc(L(x, 'body')) + '</p></div>';
    }).join('');
    return head + nav + '<div class="tflats" id="tflats">' + flats + '</div></div>';
  };

  view.connect = function () {
    var c = D.contact || {}, hero = D.hero || {}, rows = '';
    function link(href, icon, text, path, prefix) {
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + svg(icon, 'ic') +
        '<span class="tx"' + ed(path) + (prefix ? ' data-prefix="' + prefix + '"' : '') + '>' +
        esc(text) + '</span><span class="ar">&rsaquo;</span></a>';
    }
    if (has(c.email) || editing()) rows += link('mailto:' + c.email, 'mail', c.email, 'contact.email');
    if (has(c.phone_display) || editing()) rows += link('tel:' + String(c.phone_display || '').replace(/\s/g, ''), 'phone', c.phone_display, 'contact.phone_display');
    if (has(c.ig) || editing()) rows += link('https://instagram.com/' + c.ig, 'ig', '@' + c.ig, 'contact.ig', '@');
    if (has(c.web) || editing()) rows += link('https://' + String(c.web || '').replace(/^https?:\/\//, ''), 'web', c.web, 'contact.web');
    /* Nomor WhatsApp tidak tampil di kartu, tapi harus bisa diperbaiki dari editor. */
    if (editing()) rows += link('#', 'wa', c.wa || '', 'contact.wa');
    return '<div class="step">' +
      h2("Let's Connect") +
      '<p class="p">' + T('Senang berkenalan dengan Anda. Simpan kontak saya, atau sapa langsung lewat WhatsApp.',
        'Good to meet you. Save my details, or say hello on WhatsApp.') + '</p>' +
      '<div class="contact">' + rows + '</div>' +
      '<button class="nextlink" id="share">' + T('Bagikan kartu ini', 'Share this card') +
      '<span>' + svg('share') + '</span></button>' +
      reelBtn() +
      (has((D.images || {}).logo)
        ? '<img class="foot-logo" src="' + esc((D.images || {}).logo) + '" alt="Increasink" data-img="images.logo">' : '') +
      '<p class="p" style="font-size:12.5px">' + esc(hero.name || '') + ' &middot; ' + esc((D.bisnis || {}).nama || '') + '</p>' +
      '</div>';
  };

  /* ---------- showreel ----------
     Latar tombol memakai poster slide yang sama, jadi tidak ada berkas baru yang diunduh.
     Videonya pun src yang sama, sehingga diambil dari cache browser. */
  function reelBtn() {
    var r = D.showreel || {};
    if (!has(r.src) && !editing()) return '';
    return '<div class="reel" id="reel" role="button" tabindex="0">' +
      '<video class="reel-bg" src="' + esc(r.src) + '"' +
      (has(r.poster) ? ' poster="' + esc(r.poster) + '"' : '') +
      ' muted playsinline loop preload="metadata" aria-hidden="true" tabindex="-1"></video>' +
      '<span class="reel-ic">' + svg('play') + '</span>' +
      '<span class="reel-t"><b' + ed(lp('showreel', 'label')) + '>' + esc(L(r, 'label') || 'Our Showreel') + '</b>' +
      (has(L(r, 'note')) || editing()
        ? '<i' + ed(lp('showreel', 'note')) + '>' + esc(L(r, 'note')) + '</i>' : '') +
      '</span></div>';
  }

  function reelOpen() {
    var r = D.showreel || {}, m = el('modal');
    var car = carouselHtml('reelcar');
    if (!car) return;
    /* Selalu mulai dari slide pertama, dan suara dinyalakan karena overlay ini
       hanya terbuka lewat ketukan, jadi browser mengizinkan. playVid() tetap
       punya jalan mundur ke tanpa suara kalau ditolak. */
    carIndex = 0;
    introSound = true;
    // video kecil di tombol dihentikan, percuma ikut didekode di balik overlay
    var bg = document.querySelector('.reel-bg');
    if (bg) bg.pause();
    m.className = 'modal full show';
    m.innerHTML = '<div class="reelbox" role="dialog" aria-modal="true" aria-label="' +
      esc(L(r, 'label') || 'Our Showreel') + '">' + car +
      '<button class="reel-x" id="reelx" aria-label="' + T('Tutup', 'Close') + '">' + svg('close') + '</button></div>';
    m.onclick = function (e) { if (e.target === m || e.target.closest('#reelx')) reelClose(); };
    var box = m.querySelector('#car');
    if (box) carousel(box);
  }

  function reelClose() {
    var m = el('modal');
    Array.prototype.forEach.call(m.querySelectorAll('video'), function (v) { v.pause(); });
    clearTimeout(carTimer);
    m.className = 'modal';
    m.innerHTML = '';
    m.onclick = null;
    playReelBg();          // video di tombol dihidupkan lagi
  }

  /* Video kecil yang main di dalam tombol Our Showreel. Berkasnya sama dengan slide
     pertama carousel, jadi diambil dari cache, bukan unduhan baru. */
  function playReelBg() {
    var v = document.querySelector('.reel-bg');
    if (!v) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    v.play().catch(function () { /* poster tetap tampil */ });
  }

  /* ---------- shell ---------- */
  function render() {
    var s = STEPS[step];
    var pct = Math.round((step / (STEPS.length - 1)) * 100);
    var app = el('app');
    app.className = 'app' + (s.dark ? ' dark' : '');

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

    var body = view[s.key]();
    if (s.key !== 'cover') {
      // pakai fungsi pengganti, supaya "$&" di teks isian tidak dibaca sebagai pola replace
      var bh = blocksHtml(s.key);
      body = body.indexOf('<!--blocks-->') >= 0
        ? body.replace('<!--blocks-->', function () { return bh; })
        : body.replace(/<\/div>\s*$/, function () { return bh + '</div>'; });
    }
    if (s.key !== 'cover' && step < STEPS.length - 1) {
      body = body.replace(/<\/div>\s*$/, '<button class="nextlink" id="next">' +
        T('Lanjut', 'Continue') + '<span>' + esc(T(STEPS[step + 1].tab[0], STEPS[step + 1].tab[1])) +
        ' &rsaquo;</span></button></div>');
    }

    app.innerHTML = topnav + '<div class="stage" id="stage">' + body + '</div>' +
      footer + '<div class="modal" id="modal"></div>';

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
    if (el('share')) el('share').addEventListener('click', share);
    if (el('reel')) {
      playReelBg();
      el('reel').addEventListener('click', function () { if (!editing()) reelOpen(); });
      el('reel').addEventListener('keydown', function (e) {
        if (editing() || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        reelOpen();
      });
    }
    var nv = el('nav');
    if (nv) nv.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      go(+b.dataset.go);
    });
    if (el('lid')) el('lid').addEventListener('click', function () { setLang('id'); });
    if (el('len')) el('len').addEventListener('click', function () { setLang('en'); });

    var pn = el('pillnav');
    if (pn) pn.addEventListener('click', function (e) {
      var it = e.target.closest('.acc-i');
      if (!it || !e.target.closest('.acc-h')) return;
      /* di mode sunting, ketukan pada teks dipakai untuk mengedit, bukan membuka */
      if (editing() && !e.target.closest('.acc-x')) return;
      var k = it.dataset.pil, on = !open[k];
      open[k] = on;
      it.classList.toggle('on', on);
      var x = it.querySelector('.acc-x');
      if (x) x.setAttribute('aria-expanded', String(on));
    });
    [el('tiernav'), el('burger'), el('tflats')].forEach(function (n) {
      if (n) n.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tier]'); if (!b) return;
        pickTier(+b.dataset.tier);
      });
    });
    if (el('burger')) tilt(el('burger'));
    if (el('car')) carousel(el('car'));
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
  function paintSound(b) {
    b.innerHTML = svg(introSound ? 'soundOn' : 'soundOff');
    b.setAttribute('aria-pressed', String(introSound));
    b.setAttribute('aria-label', introSound ? T('Matikan suara', 'Mute') : T('Nyalakan suara', 'Unmute'));
  }
  function playVid(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () {
      // browser menolak suara tanpa ketukan: lanjut tanpa suara supaya video tetap jalan
      if (!v.muted) {
        v.muted = true;
        introSound = false;
        var b = el('vsound');
        if (b) paintSound(b);
        v.play().catch(function () { /* poster tetap tampil */ });
      }
    });
  }

  /* Carousel step Kenalan. Geser jari memakai scroll-snap bawaan browser, jadi rasanya sama
     seperti Instagram. Maju sendiri saat video selesai atau setelah 5 detik untuk gambar,
     dan kembali ke slide pertama setelah slide terakhir. Posisi slide diingat saat render ulang. */
  var carIndex = 0, carTimer = null;
  var IMG_MS = 5000;
  function carousel(box) {
    var track = box.querySelector('.car-track');
    var slides = Array.prototype.slice.call(track.children);
    var dots = box.querySelectorAll('.car-dots i');
    var sb = el('vsound');
    var n = slides.length;
    clearTimeout(carTimer);
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
      clearTimeout(carTimer);
      carIndex = i;
      Array.prototype.forEach.call(dots, function (d, j) { d.classList.toggle('on', j === i); });
      slides.forEach(function (s, j) {
        var o = media(j);
        if (o && j !== i && !o.paused) { o.pause(); o.currentTime = 0; }
      });
      var v = arm(i, 'auto');
      if (sb) sb.hidden = !v;   // gambar tidak punya suara
      if (v) { v.volume = 1; v.muted = !introSound; playVid(v); }
      else if (n > 1) carTimer = setTimeout(function () { if (alive()) next(); }, IMG_MS);
      if (n > 1) arm((i + 1) % n, 'metadata');   // cuma header, bukan seluruh berkas
    }
    function next() {
      if (n < 2 || !alive()) return;
      var i = (carIndex + 1) % n;
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      activate(i);
    }
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
      if (v) { v.volume = 1; v.muted = !introSound; playVid(v); }
      /* Browser, terutama Safari iOS, hanya mengizinkan video bersuara yang pernah diputar
         lewat ketukan. Selagi masih di dalam ketukan ini, video lain diputar sebentar dengan
         volume 0 lalu dihentikan, supaya nanti boleh bersuara saat carousel maju sendiri. */
      if (introSound) slides.forEach(function (s, j) {
        var o = arm(j);
        if (!o || j === carIndex) return;
        o.volume = 0;
        o.muted = false;
        var pr = o.play();
        var done = function () {
          if (j !== carIndex) { o.pause(); o.currentTime = 0; }
          o.volume = 1;
        };
        if (pr && pr.then) pr.then(done, done); else done();
      });
      paintSound(sb);
    });
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
    m.innerHTML = '<div class="box" role="dialog" aria-modal="true">' +
      (has(logo) ? '<img class="box-logo" src="' + esc(logo) + '" alt="Increasink">' : '') +
      '<div class="box-h">' + esc(L(f, 'head')) + '</div>' +
      '<p class="box-s">' + esc(L(f, 'sub')) + '</p>' + fields +
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
    var msg = L(f, 'template').replace(/\{(\w+)\}/g, function (_, k) {
      return has(vals[k]) ? vals[k] : T('(tidak diisi)', '(not filled)');
    });
    window.open('https://wa.me/' + c.wa + '?text=' + encodeURIComponent(msg), '_blank');
    el('modal').classList.remove('show');
  }

  function share() {
    var url = location.href.split('#')[0];
    var title = ((D.hero || {}).name || '') + ' · Bio GAINS';
    if (navigator.share) navigator.share({ title: title, text: title, url: url }).catch(function () {});
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      var b = el('share'); var o = b.innerHTML;
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
    stepDef: STEP_DEF,
    stepAll: STEP_ALL,
    pillars: function () { return PILLARS; },
    pillarAll: PILL_ALL,
    at: function () { return step; },
    go: go,
    render: render,
    /* Dipakai setelah urutan atau visibilitas berubah. */
    rebuild: function () {
      buildSteps();
      buildPillars();
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
    var f = document.querySelector('.igframe');
    if (f) f.style.height = Math.min(Math.max(+d.details.height, 180), 900) + 'px';
  });

  mesh();
  document.addEventListener('pointerdown', ripple, { passive: true });

  buildSteps();
  buildPillars();
  if (PILLARS.length) open[PILLARS[0]] = true;
  render();
})();
