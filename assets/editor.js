/* Increasink Bio Card, layer editor.
   Diam sepenuhnya sampai ada yang mengetuk pojok kanan atas tiga kali dan
   memasukkan password. Password dan token GitHub tidak ada di file ini,
   keduanya hidup sebagai env var di server. Yang disimpan di browser hanya
   tiket sesi berumur 12 jam yang diterbitkan /api/login.

   Isi kartu adalah halaman berisi widget (lihat migrate() di app.js). Editor ini
   memilih, menambah, menggeser, menduplikat, menyembunyikan, dan mengatur widget,
   plus mengelola halamannya. Teks tetap disunting langsung di tempatnya. */
(function () {
  'use strict';

  var BC = window.BioCard;
  if (!BC) return;

  var CARD = (BC.data().id || 'card').replace(/[^a-z0-9-]/g, '');
  var API = window.BIOCARD_API || '/api';
  var K_TOK = 'bc.tok.' + CARD;
  var K_DRAFT = 'bc.draft.' + CARD;

  var PUBLISHED = clone(BC.data());   // isi apa adanya dari data.js (sudah dikonversi ke widget)
  var token = null;
  var unlocked = false;
  var editing = false;
  var dirty = false;
  var busy = false;
  var suppressUntil = 0;

  var CHILD = { text: '.chip', ml: 'li', fact: '.fact', fixed: 'button', pin: '.pin', row: '.meta-row', acc: '.acc-i' };

  var EYE_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l16 16M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6.4 0 10.2 6.5 10.2 6.5a18 18 0 0 1-3.5 4.2M6.5 7.8A17.6 17.6 0 0 0 1.8 12S5.6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/></svg>';
  function ic(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var IC = {
    up: ic('M12 19V5M6 11l6-6 6 6'),
    down: ic('M12 5v14M6 13l6 6 6-6'),
    gear: ic('M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8'),
    copy: ic('M8.5 8.5h11v11h-11zM5 15.5H4.5v-11h11V5'),
    trash: ic('M4.5 7h15M10 7V4.8h4V7M6.8 7l.9 12.5h8.6L17.2 7'),
    close: ic('m6 6 12 12M18 6 6 18'),
    undo: ic('M9 5.5 4 10.5l5 5M4 10.5h10.5a5.5 5.5 0 0 1 0 11H12'),
    pages: ic('M5 4h10l4 4v12H5zM15 4v4h4'),
    grip: ic('M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01')
  };

  /* ================= util ================= */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function T(id, en) { return BC.lang() === 'id' ? id : en; }
  function TN(pair) { return pair ? T(pair[0], pair[1]) : ''; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function app() { return document.getElementById('app'); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* mode privat */ }
  }
  function rid() { return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6); }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(u)) return 'https://' + u;
    return '';
  }

  function pget(o, path) {
    var a = path.split('.'), v = o;
    for (var i = 0; i < a.length && v != null; i++) v = v[a[i]];
    return v;
  }
  function pset(o, path, val) {
    var a = path.split('.'), v = o, i;
    for (i = 0; i < a.length - 1; i++) {
      if (v[a[i]] == null) v[a[i]] = /^\d+$/.test(a[i + 1]) ? [] : {};
      v = v[a[i]];
    }
    v[a[a.length - 1]] = val;
  }

  /* Menukar isi objek D di tempat, karena app.js memegang referensinya.
     Draft dan patokan lama bisa masih berformat sebelum widget, jadi dikonversi dulu. */
  function replaceData(src) {
    BC.migrate(src);
    var d = BC.data();
    Object.keys(d).forEach(function (k) { delete d[k]; });
    Object.keys(src).forEach(function (k) { d[k] = src[k]; });
  }

  /* ================= gerbang tersembunyi ================= */
  var taps = [];
  document.addEventListener('pointerdown', function (e) {
    if (editing) return;
    var w = window.innerWidth;
    var zone = Math.min(130, w * 0.32);
    if (e.clientX < w - zone || e.clientY > 96) return;
    // Tombol bahasa duduk di sudut yang sama. Ketukan di atasnya diabaikan
    // supaya ganti bahasa tidak pernah membuka gerbang tanpa sengaja.
    if (e.target.closest && e.target.closest('button, a, input, [contenteditable]')) return;
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 1100; });
    taps.push(now);
    if (taps.length >= 3) { taps = []; unlocked ? enter() : openLogin(); }
  }, true);

  /* ================= lembar ================= */
  function sheet(html, onMount) {
    // lembar yang diganti lembar lain langsung dibuang, latar gelapnya tidak perlu memudar ulang
    var prev = app().querySelectorAll('.ed-sheet');
    Array.prototype.forEach.call(prev, function (x) { x.remove(); });
    var s = document.createElement('div');
    s.className = 'ed-sheet' + (prev.length ? ' swap' : '');
    s.innerHTML = '<div class="ed-box">' + html + '</div>';
    s.addEventListener('pointerdown', function (e) { if (e.target === s) closeSheet(); });
    app().appendChild(s);
    if (onMount) onMount(s);
    return s;
  }
  function closeSheet() {
    var s = app() && app().querySelector('.ed-sheet:not(.out)');
    if (s) leave(s, 320);
  }

  /* Animasi keluar dulu, baru dibuang. Waktunya sama dengan animasi keluar di editor.css. */
  function leave(nd, ms) {
    nd.classList.add('out');
    setTimeout(function () { if (nd.parentNode) nd.remove(); }, ms);
  }

  /* act = { label, fn } menambah tombol di toast, dipakai untuk Urungkan. */
  function toast(msg, kind, act) {
    var old = document.querySelector('.ed-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'ed-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    if (act) {
      var b = document.createElement('button');
      b.className = 'ed-toast-a';
      b.type = 'button';
      b.textContent = act.label;
      b.addEventListener('click', function () { leave(t, 260); act.fn(); });
      t.appendChild(b);
    }
    document.body.appendChild(t);
    if (kind !== 'wait') setTimeout(function () { if (t.parentNode) leave(t, 260); }, act ? 6000 : 4200);
    return t;
  }

  /* ================= login ================= */
  function openLogin() {
    sheet(
      '<div class="ed-h">' + T('Login', 'Sign in') + '</div>' +
      '<p class="ed-sub">' + T('Halaman ini hanya untuk pemilik kartu.', 'This is for the card owner only.') + '</p>' +
      '<input class="ed-input" id="edpw" type="password" autocomplete="current-password" placeholder="Password">' +
      '<div class="ed-err" id="ederr"></div>' +
      '<div class="ed-row">' +
      '<button class="ed-btn" data-a="cancel">' + T('Batal', 'Cancel') + '</button>' +
      '<button class="ed-btn primary" data-a="go">' + T('Login', 'Sign in') + '</button>' +
      '</div>',
      function (s) {
        var pw = s.querySelector('#edpw');
        var err = s.querySelector('#ederr');
        var go = s.querySelector('[data-a="go"]');
        setTimeout(function () { pw.focus(); }, 90);
        pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        s.querySelector('[data-a="cancel"]').addEventListener('click', closeSheet);
        go.addEventListener('click', submit);

        function submit() {
          if (busy) return;
          busy = true;
          go.disabled = true;
          go.textContent = T('Sebentar...', 'Checking...');
          err.classList.remove('show');
          fetch(API + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw.value })
          }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
          }).then(function (x) {
            busy = false;
            go.disabled = false;
            go.textContent = T('Login', 'Sign in');
            if (!x.ok) {
              err.textContent = x.j.error || T('Password salah.', 'Wrong password.');
              err.classList.add('show');
              pw.select();
              return;
            }
            token = x.j.token;
            lsSet(K_TOK, JSON.stringify({ token: token, exp: x.j.exp }));
            unlocked = true;
            closeSheet();
            enter();
          }).catch(function () {
            busy = false;
            go.disabled = false;
            go.textContent = T('Login', 'Sign in');
            err.textContent = T('Gagal menghubungi server.', 'Cannot reach the server.');
            err.classList.add('show');
          });
        }
      }
    );
  }

  /* Masuk mode sunting. Tidak ada tombol yang terlihat di kartu, pintunya
     selalu tap 3 kali di kanan atas. Sesi yang masih berlaku tidak minta login lagi. */
  function enter() {
    UNDO = [];
    snapNow();
    setEditing(true);
    offerDraft();
  }

  function logout() {
    token = null;
    unlocked = false;
    setEditing(false);
    lsSet(K_TOK, null);
    paint();
  }

  /* ================= draf lokal ================= */
  function saveDraft() {
    var now = JSON.stringify(BC.data());
    if (lastSnap != null && now !== lastSnap) {
      UNDO.push(lastSnap);
      if (UNDO.length > UNDO_MAX) UNDO.shift();
    }
    lastSnap = now;
    dirty = now !== JSON.stringify(PUBLISHED);
    lsSet(K_DRAFT, dirty ? now : null);
    var b = app().querySelector('.ed-btn.primary[data-a="pub"]');
    if (b) b.classList.toggle('dot', dirty);
    var u = app().querySelector('[data-a="undo"]');
    if (u) u.disabled = !UNDO.length;
  }

  function offerDraft() {
    var raw = ls(K_DRAFT);
    if (!raw) return;
    var draft;
    try { draft = BC.migrate(JSON.parse(raw)); } catch (e) { lsSet(K_DRAFT, null); return; }
    if (same(draft, PUBLISHED)) { lsSet(K_DRAFT, null); return; }
    sheet(
      '<div class="ed-h">' + T('Ada draft tersimpan', 'Unsaved draft') + '</div>' +
      '<p class="ed-sub">' + T('Perubahan terakhir di device ini belum di-publish.',
        'Your last changes on this device were never published.') + '</p>' +
      '<div class="ed-col">' +
      '<button class="ed-btn primary" data-a="keep">' + T('Lanjutkan draft', 'Continue draft') + '</button>' +
      '<button class="ed-btn danger" data-a="drop">' + T('Hapus, pakai versi online', 'Discard, use live version') + '</button>' +
      '</div>',
      function (s) {
        s.querySelector('[data-a="keep"]').addEventListener('click', function () {
          replaceData(draft);
          dirty = true;
          snapNow();
          closeSheet();
          setEditing(true);
        });
        s.querySelector('[data-a="drop"]').addEventListener('click', function () {
          lsSet(K_DRAFT, null);
          closeSheet();
        });
      }
    );
  }

  function revert() {
    replaceData(clone(PUBLISHED));
    dirty = false;
    lsSet(K_DRAFT, null);
    UNDO = [];
    snapNow();
    selId = null;
    panelClose();
    BC.rebuild();
  }

  /* ================= publish ================= */
  function publish() {
    if (busy) return;
    busy = true;
    var t = toast(T('Menyimpan...', 'Saving...'), 'wait');
    fetch(API + '/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        card: CARD,
        data: BC.data(),
        message: 'Perbarui kartu ' + CARD + ' lewat editor'
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    }).then(function (x) {
      busy = false;
      if (t.parentNode) t.remove();
      if (!x.ok) {
        if (x.status === 401) { logout(); }
        toast(x.j.error || T('Gagal menyimpan.', 'Save failed.'), 'bad');
        return;
      }
      PUBLISHED = clone(BC.data());
      dirty = false;
      lsSet(K_DRAFT, null);
      paint();
      toast(T('Tersimpan. Kartu versi baru online sekitar satu menit lagi.',
        'Saved. The new version goes live in about a minute.'), 'good');
    }).catch(function () {
      busy = false;
      if (t.parentNode) t.remove();
      toast(T('Gagal menghubungi server.', 'Cannot reach the server.'), 'bad');
    });
  }

  /* ================= mode sunting ================= */
  function setEditing(on) {
    editing = !!on;
    BC.editing = editing;
    if (!editing) { selId = null; panelClose(); }
    BC.rebuild();          // halaman tersembunyi ikut muncul saat menyunting
  }

  function askDone() {
    if (!dirty) { setEditing(false); return; }
    sheet(
      '<div class="ed-h">' + T('Masih ada perubahan', 'You have changes') + '</div>' +
      '<p class="ed-sub">' + T('Perubahan ini belum kelihatan ke orang lain sampai di-publish.',
        'Nobody else sees these until you publish.') + '</p>' +
      '<div class="ed-col">' +
      '<button class="ed-btn primary" data-a="pub">' + T('Publish sekarang', 'Publish now') + '</button>' +
      '<button class="ed-btn" data-a="keep">' + T('Simpan draft, lanjut nanti', 'Keep draft for later') + '</button>' +
      '<button class="ed-btn danger" data-a="revert">' + T('Hapus semua perubahan', 'Discard all changes') + '</button>' +
      '</div>',
      function (s) {
        s.querySelector('[data-a="pub"]').addEventListener('click', function () { closeSheet(); publish(); });
        s.querySelector('[data-a="keep"]').addEventListener('click', function () { closeSheet(); setEditing(false); });
        s.querySelector('[data-a="revert"]').addEventListener('click', function () {
          closeSheet();
          revert();
          setEditing(false);
        });
      }
    );
  }

  /* ================= urungkan =================
     Setiap saveDraft() menyimpan keadaan sebelumnya. Semua perubahan lewat editor
     berakhir di saveDraft(), jadi satu tumpukan ini menangkap semuanya. */
  var UNDO = [], lastSnap = null, UNDO_MAX = 40;
  function snapNow() { lastSnap = JSON.stringify(BC.data()); }
  function undo() {
    if (!UNDO.length) { toast(T('Tidak ada yang bisa diurungkan.', 'Nothing to undo.')); return; }
    var prev = UNDO.pop();
    replaceData(JSON.parse(prev));
    lastSnap = prev;
    dirty = prev !== JSON.stringify(PUBLISHED);
    lsSet(K_DRAFT, dirty ? prev : null);
    panelClose();
    BC.rebuild();
  }

  /* ================= widget yang dipilih ================= */
  var selId = null;
  function curPage() {
    var s = BC.steps()[BC.at()];
    return s && s.page != null ? s.page : null;
  }
  function pageWidgets(p) {
    p = p == null ? curPage() : p;
    var pg = p == null ? null : (BC.data().pages || [])[p];
    if (!pg) return null;
    if (!Array.isArray(pg.widgets)) pg.widgets = [];
    return pg.widgets;
  }
  function selIndex() {
    var l = pageWidgets();
    if (!l || !selId) return -1;
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === selId) return i;
    return -1;
  }
  function selWidget() { var i = selIndex(); return i < 0 ? null : pageWidgets()[i]; }
  function wPath(i) { return 'pages.' + curPage() + '.widgets.' + i; }
  function newId(type) { return String(type || 'w').slice(0, 4) + '-' + rid(); }
  function allWidgets() {
    var out = [];
    (BC.data().pages || []).forEach(function (pg) { (pg && pg.widgets || []).forEach(function (w) { if (w) out.push(w); }); });
    return out;
  }

  function select(id) {
    if (id === selId) return;
    selId = id;
    markSel();
    swapBar();
    if (panel) { if (id) openPanel(); else panelClose(); }
  }
  function swapBar() {
    var a = app(), old = a && a.querySelector('.ed-bar');
    if (!old) return;
    old.replaceWith(buildBar());
  }
  /* Tanda pilih, label jenis, pegangan geser, dan pegangan ubah ukuran gambar.
     Cukup ubah DOM, tanpa render ulang, supaya teks yang sedang diketik tidak lepas. */
  function markSel() {
    var a = app();
    if (!a) return;
    var i = selIndex(), w = selWidget();
    Array.prototype.forEach.call(a.querySelectorAll('.ed-wgrip, .ed-rs'), function (x) { x.remove(); });
    Array.prototype.forEach.call(a.querySelectorAll('.step[data-wl] > .w'), function (nd) {
      var on = +nd.dataset.w === i;
      nd.classList.toggle('sel', on);
      if (!on) return;
      var g = document.createElement('span');
      g.className = 'ed-wgrip';
      g.setAttribute('contenteditable', 'false');
      g.setAttribute('aria-hidden', 'true');
      g.innerHTML = IC.grip;
      nd.appendChild(g);
      var fig = w && w.type === 'image' && w.style !== 'logo' && nd.querySelector('figure.wimg');
      if (fig) wireResize(fig, w);
    });
  }
  function revealSel(focus) {
    var nd = app().querySelector('.step[data-wl] > .w.sel');
    if (!nd) return;
    var f = focus && nd.querySelector('[data-e]');
    if (f) f.focus({ preventScroll: true });
    nd.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function moveSel(d) {
    var l = pageWidgets(), i = selIndex(), j = i + d;
    if (i < 0 || j < 0 || j >= l.length) return;
    var t = l[i]; l[i] = l[j]; l[j] = t;
    saveDraft();
    BC.render();
    revealSel();
  }
  function dupSel() {
    var l = pageWidgets(), i = selIndex();
    if (i < 0) return;
    if (TYPES[l[i].type] && TYPES[l[i].type].unique) { toast(T('Widget ini hanya boleh satu per kartu.', 'Only one of this widget per card.')); return; }
    var c = clone(l[i]);
    c.id = newId(c.type);
    (c.items || []).forEach(function (it) { if (it && typeof it === 'object' && it.k) it.k = rid(); });
    l.splice(i + 1, 0, c);
    selId = c.id;
    saveDraft();
    BC.render();
    revealSel();
    toast(T('Widget diduplikat.', 'Widget duplicated.'));
  }
  function hideSel() {
    var w = selWidget();
    if (!w) return;
    if (w.hidden) delete w.hidden; else w.hidden = true;
    saveDraft();
    BC.render();
    toast(w.hidden ? T('Disembunyikan dari pengunjung.', 'Hidden from visitors.') : T('Tampil lagi di kartu.', 'Visible again.'));
  }
  function delSel() {
    var l = pageWidgets(), i = selIndex();
    if (i < 0) return;
    l.splice(i, 1);
    selId = null;
    panelClose();
    saveDraft();
    BC.render();
    toast(T('Widget dihapus.', 'Widget removed.'), null, { label: T('Urungkan', 'Undo'), fn: undo });
  }

  /* ================= strip bawah ================= */
  function barBtn(a, icon, label, dis) {
    return '<button class="ed-wb" data-a="' + a + '"' + (dis ? ' disabled' : '') + ' aria-label="' + esc(label) + '">' +
      icon + '<span>' + esc(label) + '</span></button>';
  }
  function buildBar() {
    var steps = BC.steps(), i = BC.at(), cur = steps[i] || {};
    var name = cur.key === 'cover' ? T('Cover', 'Cover') : TN(cur.label) || cur.key;
    var w = selWidget(), wi = selIndex(), n = (pageWidgets() || []).length;
    var bar = document.createElement('div');
    bar.className = 'ed-bar';
    bar.innerHTML =
      (cur.key !== 'cover'
        ? '<button class="ed-fab" data-a="add" aria-label="' + T('Tambah widget', 'Add widget') + '">+</button>' : '') +
      '<div class="ed-nav">' +
      '<button class="ed-ico" data-a="prev"' + (i <= 0 ? ' disabled' : '') + ' aria-label="' + T('Sebelumnya', 'Previous') + '">&lsaquo;</button>' +
      '<span class="ed-cur">' + esc(name) + (cur.off ? ' · ' + T('disembunyikan', 'hidden') : '') +
      (w ? ' · <b>' + esc(TN((TYPES[w.type] || {}).name) || w.type) + '</b>' : '') + '</span>' +
      '<button class="ed-ico" data-a="next"' + (i >= steps.length - 1 ? ' disabled' : '') + ' aria-label="' + T('Berikutnya', 'Next') + '">&rsaquo;</button>' +
      '</div>' +
      (w
        ? '<div class="ed-wrow">' +
          barBtn('w-up', IC.up, T('Naik', 'Up'), wi <= 0) +
          barBtn('w-down', IC.down, T('Turun', 'Down'), wi >= n - 1) +
          barBtn('w-set', IC.gear, T('Atur', 'Settings')) +
          barBtn('w-dup', IC.copy, T('Duplikat', 'Duplicate')) +
          barBtn('w-hide', w.hidden ? EYE_OFF : EYE_ON, w.hidden ? T('Tampilkan', 'Show') : T('Sembunyi', 'Hide')) +
          barBtn('w-del', IC.trash, T('Hapus', 'Delete')) +
          barBtn('w-x', IC.close, T('Tutup', 'Close')) +
          '</div>'
        : '<div class="ed-acts">' +
          '<button class="ed-btn ed-undo" data-a="undo"' + (UNDO.length ? '' : ' disabled') + ' aria-label="' + T('Urungkan', 'Undo') + '">' + IC.undo + '</button>' +
          '<button class="ed-btn" data-a="order">' + T('Halaman', 'Pages') + '</button>' +
          '<button class="ed-btn" data-a="done">' + T('Selesai', 'Done') + '</button>' +
          '<button class="ed-btn primary' + (dirty ? ' dot' : '') + '" data-a="pub">' + T('Publish', 'Publish') + '</button>' +
          '</div>');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var a = b.dataset.a;
      if (a === 'prev') BC.go(BC.at() - 1);
      else if (a === 'next') BC.go(BC.at() + 1);
      else if (a === 'order') openPages();
      else if (a === 'done') askDone();
      else if (a === 'pub') publish();
      else if (a === 'add') openPicker();
      else if (a === 'undo') undo();
      else if (a === 'w-up') moveSel(-1);
      else if (a === 'w-down') moveSel(1);
      else if (a === 'w-set') openPanel();
      else if (a === 'w-dup') dupSel();
      else if (a === 'w-hide') hideSel();
      else if (a === 'w-del') delSel();
      else if (a === 'w-x') select(null);
    });
    return bar;
  }

  /* ================= jenis widget =================
     name, desc: label di menu Tambah. make(): isi awal. fields: kontrol di panel Atur.
     acts: tombol aksi di panel. after(): langkah lanjutan begitu ditambahkan. */
  function tierDefaults() {
    return [
      { name: 'Bread', color: '#A0703C', level_id: 'Referral harian', level_en: 'Everyday referral', body_id: '', body_en: '' },
      { name: 'Cheese', color: '#C9A227', level_id: 'Lebih dalam', level_en: 'Better fit', body_id: '', body_en: '' },
      { name: 'Meat', color: '#B0893C', level_id: 'Referral impian', level_en: 'Dream referral', body_id: '', body_en: '' }
    ];
  }
  var PICK_ICONS = ['star', 'check', 'target', 'trophy', 'bulb', 'rocket', 'briefcase', 'person', 'hand', 'heart', 'badge', 'gains',
    'chat', 'mail', 'phone', 'web', 'ig', 'linkedin', 'camera', 'pin', 'calendar', 'music', 'cross', 'play', 'share'];

  var TYPES = {
    heading: {
      name: ['Judul', 'Heading'], desc: ['Judul besar atau kecil', 'Large or small title'],
      ico: ic('M6 5v14M18 5v14M6 12h12'),
      make: function () { return { text_id: 'Judul baru', text_en: 'New heading' }; },
      fields: [{ k: 'size', type: 'seg', label: ['Ukuran', 'Size'], opts: [['', 'Besar', 'Large'], ['s', 'Kecil', 'Small']] }]
    },
    text: {
      name: ['Teks', 'Text'], desc: ['Paragraf, bisa bold, italic, link', 'Paragraph with bold, italic, links'],
      ico: ic('M5 6h14M5 11h14M5 16h9'),
      make: function () { return { body_id: '', body_en: '' }; },
      fields: [
        { k: 'style', type: 'seg', label: ['Gaya', 'Style'], opts: [['', 'Paragraf', 'Paragraph'], ['quote', 'Kotak kutipan', 'Quote box']] },
        { k: 'size', type: 'seg', label: ['Ukuran', 'Size'], opts: [['xs', 'XS', 'XS'], ['s', 'S', 'S'], ['', 'M', 'M'], ['l', 'L', 'L']] },
        { k: 'align', type: 'seg', label: ['Rata', 'Align'], opts: [['', 'Kiri', 'Left'], ['center', 'Tengah', 'Center']] }
      ]
    },
    image: {
      name: ['Gambar', 'Image'], desc: ['Foto atau logo, ukurannya bisa diatur', 'Photo or logo, resizable'],
      ico: ic('M3 4h18v16H3zM9 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM4 18l5-5 4 4 3-3 4 4'),
      make: function () { return { src: '', w: 100, align: 'center' }; },
      after: function (w, i) { chooseImage(function (url) { pset(BC.data(), wPath(i) + '.src', url); }); },
      acts: [{ label: ['Ganti gambar', 'Change image'], fn: function (w, p) { chooseImage(function (url) { pset(BC.data(), p + '.src', url); }, reopenPanel); } }],
      fields: [
        { k: 'style', type: 'seg', label: ['Jenis', 'Kind'], opts: [['', 'Foto', 'Photo'], ['logo', 'Logo', 'Logo']] },
        { k: 'w', type: 'range', label: ['Lebar', 'Width'], min: 10, max: 100, step: 1, unit: '%', def: 100,
          show: function (w) { return w.style !== 'logo'; },
          live: function (nd, v, w) { var f = nd.querySelector('figure.wimg'); if (f) applyImgW(f, v, w.align); } },
        { k: 'align', type: 'seg', label: ['Posisi', 'Position'], opts: [['left', 'Kiri', 'Left'], ['center', 'Tengah', 'Center'], ['right', 'Kanan', 'Right']], def: 'center',
          show: function (w) { return w.style !== 'logo'; } },
        { k: 'round', type: 'toggle', label: ['Sudut membulat', 'Rounded corners'], def: true, off: false,
          show: function (w) { return w.style !== 'logo'; } },
        { k: 'h', type: 'range', label: ['Tinggi logo', 'Logo height'], min: 12, max: 90, step: 1, unit: 'px', def: 28,
          show: function (w) { return w.style === 'logo'; },
          live: function (nd, v) { var im = nd.querySelector('img.foot-logo'); if (im) im.style.height = v + 'px'; } },
        { k: 'invert', type: 'toggle', label: ['Jadi putih di halaman gelap', 'Turn white on dark pages'],
          show: function (w) { return w.style === 'logo'; } },
        { k: 'link', type: 'text', label: ['Link saat diketuk (opsional)', 'Link on tap (optional)'], ph: 'https://' }
      ]
    },
    button: {
      name: ['Tombol link', 'Link button'], desc: ['Tombol ke website, WhatsApp, dll', 'Button to a website, form, etc.'],
      ico: ic('M3 8h18v8H3zM13.5 12h4M16 10l2 2-2 2'),
      make: function () { return { label_id: 'Kunjungi website', label_en: 'Visit website', url: '' }; },
      fields: [{ k: 'url', type: 'text', label: ['Link tujuan', 'Destination link'], ph: 'https://' }],
      note: ['Tombol baru tampil ke pengunjung setelah link-nya diisi.', 'The button shows to visitors once the link is filled in.']
    },
    space: {
      name: ['Jarak', 'Spacer'], desc: ['Ruang kosong di antara widget', 'Empty space between widgets'],
      ico: ic('M5 4h14M5 20h14M12 7.5v9M9.5 10 12 7.5 14.5 10M9.5 14 12 16.5 14.5 14'),
      make: function () { return { h: 26 }; },
      fields: [{ k: 'h', type: 'range', label: ['Tinggi', 'Height'], min: 0, max: 120, step: 2, unit: 'px', def: 26,
        live: function (nd, v) { var d = nd.firstElementChild; if (d) d.style.height = v + 'px'; } }]
    },
    carousel: {
      name: ['Carousel', 'Carousel'], desc: ['Foto dan video yang digeser', 'Swipeable photos and videos'],
      ico: ic('M7 5h10v14H7zM3.5 7.5v9M20.5 7.5v9'),
      make: function () { return { slides: [] }; },
      after: function (w, i) { openSlides(wPath(i) + '.slides'); },
      acts: [{ label: ['Atur foto dan video', 'Manage photos and videos'], fn: function (w, p) { panelClose(); openSlides(p + '.slides'); } }],
      fields: [{ k: 'main', type: 'toggle', label: ['Ikut diputar di overlay Showreel', 'Also play in the Showreel overlay'] }]
    },
    showreel: {
      name: ['Showreel', 'Showreel'], desc: ['Tombol video layar penuh', 'Full-screen video button'],
      ico: ic('M3 5h18v14H3zM10 9v6l5-3z'),
      make: function () { return { src: '', label_id: 'Our Showreel', label_en: 'Our Showreel', note_id: 'Ketuk untuk lihat', note_en: 'Tap to watch' }; },
      after: function (w, i) { chooseVideo(function (url) { pset(BC.data(), wPath(i) + '.src', url); }); },
      acts: [
        { label: ['Ganti video', 'Change video'], fn: function (w, p) {
          chooseVideo(function (url) { var o = pget(BC.data(), p); o.src = url; delete o.loop; delete o.poster; }, reopenPanel);
        } },
        { label: ['Ganti gambar sampul', 'Change cover image'], fn: function (w, p) { chooseImage(function (url) { pset(BC.data(), p + '.poster', url); }, reopenPanel); } }
      ]
    },
    instagram: {
      name: ['Instagram', 'Instagram'], desc: ['Grid post terbaru dari profil', 'Latest posts grid from a profile'],
      ico: ic('M4 4h16v16H4zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM16.8 6.8h.01'),
      make: function () { return { user: '' }; },
      fields: [{ k: 'user', type: 'text', label: ['Username (kosong = Instagram di kontak)', 'Username (empty = contact Instagram)'], ph: 'stephenseptian' }]
    },
    table: {
      name: ['Tabel', 'Table'], desc: ['Label dan isi, seperti Bio Sheet', 'Labels and values, like the Bio Sheet'],
      ico: ic('M3 5h18v14H3zM3 12h18M9 5v14'),
      make: function () { return { rows: [{ label_id: 'Label', label_en: 'Label', value_id: '', value_en: '' }] }; },
      acts: [{ label: ['Atur foto di bawah tabel', 'Manage photos under the table'], fn: function (w, p) {
        panelClose();
        openSlides(p + '.photos', { images: true, title: ['Foto di bawah tabel', 'Photos under the table'] });
      } }],
      fields: [
        { k: 'title_id', type: 'toggle', label: ['Judul kecil di atas tabel', 'Small title above the table'],
          get: function (w) { return w.title_id != null; },
          set: function (w, v) { if (v) { w.title_id = w.title_id || ''; w.title_en = w.title_en || ''; } else { delete w.title_id; delete w.title_en; } } },
        { k: 'stack', type: 'toggle', label: ['Label di atas isi (untuk pertanyaan panjang)', 'Label above value (for long questions)'] }
      ],
      note: ['Tambah baris dengan tombol + Tambah di bawah tabel. Ikon mata menyembunyikan satu baris.', 'Add rows with + Add under the table. The eye hides a single row.']
    },
    facts: {
      name: ['Daftar bernomor', 'Numbered list'], desc: ['Seperti Off the Record dan Top Ten', 'Like Off the Record and Top Ten'],
      ico: ic('M10 6.5h10M10 12h10M10 17.5h10M4.5 5.5h1.5v3M4.5 15.5h2l-2 3h2'),
      make: function () { return { items: [{ n: '01', id: 'Teks baru', en: 'New text' }] }; },
      note: ['Nomornya bisa diganti huruf atau apa saja, ketuk untuk mengubah.', 'Numbers can be letters or anything, tap to change.']
    },
    accordion: {
      name: ['Ikon + judul', 'Icon + title'], desc: ['Kotak huruf/ikon ala GAINS, bisa dibuka', 'GAINS-style letter or icon rows'],
      ico: ic('M4 4.5h16v6H4zM4 13.5h16v6H4zM7 7.5h2M7 16.5h2'),
      make: function () { return { items: [{ k: rid(), badge: 'A', title_id: 'Judul', title_en: 'Title', body_id: '', body_en: '' }] }; },
      fields: [{ k: 'collapsible', type: 'toggle', label: ['Bisa dibuka tutup', 'Expand and collapse'], def: true, off: false }],
      note: ['Ketuk kotak hurufnya untuk mengganti huruf atau memilih ikon. Tahan lalu geser kotak itu untuk mengubah urutan.', 'Tap the letter box to change the letter or pick an icon. Hold and drag it to reorder.']
    },
    chips: {
      name: ['Chip / tag', 'Chips / tags'], desc: ['Label-label kecil berbentuk pil', 'Small pill labels'],
      ico: ic('M3 9h7a3 3 0 0 1 0 6H3zM14 9h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 0-6z'),
      make: function () { return { items: [T('Baru', 'New')] }; }
    },
    qr: {
      name: ['QR code', 'QR code'], desc: ['Isi link, QR dibuat otomatis', 'Enter a link, the QR is made for you'],
      ico: ic('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5h1M19 14h1'),
      make: function () { return { src: '', url: '', label_id: 'Pindai saya', label_en: 'Scan me', hint_id: '', hint_en: '' }; },
      after: function () { openPanel(); },
      fields: [{ k: 'url', type: 'text', label: ['Link di dalam QR', 'Link inside the QR'], ph: 'https://',
        onSet: function (w, p) { if (w.url && (!w.src || w.qr_auto)) makeQrFor(p); } }],
      acts: [
        { label: ['Buat ulang QR dari link', 'Rebuild QR from the link'], fn: function (w, p) { makeQrFor(p); } },
        { label: ['Pakai gambar QR sendiri', 'Use my own QR image'], fn: function (w, p) {
          chooseImage(function (url) { var o = pget(BC.data(), p); o.src = url; delete o.qr_auto; }, reopenPanel);
        } }
      ]
    },
    profile: {
      name: ['Nama + jabatan', 'Name + role'], desc: ['Sama dengan yang di cover', 'Same as on the cover'],
      ico: ic('M12 12.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8zM4.9 19.9a7.3 7.3 0 0 1 14.2 0'),
      make: function () { return {}; },
      note: ['Nama dan jabatan ini dipakai juga di cover dan file vCard.', 'This name and role are also used on the cover and in the vCard.']
    },
    pins: {
      name: ['Pin', 'Pins'], desc: ['Deretan pin BNI', 'Row of BNI pins'],
      ico: ic('M12 14.4a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM8.7 13.6 7.6 20.6l4.4-2.3 4.4 2.3-1.1-7'),
      make: function () { return { shared: true }; },
      fields: [{ k: 'shared', type: 'toggle', label: ['Sama dengan pin di cover', 'Same pins as the cover'],
        set: function (w, v) {
          if (v) { w.shared = true; return; }
          delete w.shared;
          if (!Array.isArray(w.items)) w.items = clone(BC.data().pins || []);
        } }]
    },
    contact: {
      name: ['Kontak', 'Contact list'], desc: ['Email, telepon, IG, LinkedIn, web', 'Email, phone, IG, LinkedIn, web'],
      ico: ic('M2.5 5h19v14h-19zM2.5 6l9.5 7 9.5-7'),
      make: function () { return {}; },
      note: ['Isi kontak dipakai juga oleh tombol WhatsApp, tombol Instagram, dan file vCard. Ketuk teksnya di kartu untuk mengubah.', 'These details are also used by the WhatsApp and Instagram buttons and the vCard. Tap the text on the card to edit.']
    },
    share: {
      name: ['Tombol bagikan', 'Share button'], desc: ['Bagikan link kartu ini', 'Share this card link'],
      ico: ic('M6 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM17 3.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM17 15.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM8.2 10.9l6.6-3.6M8.2 13.1l6.6 3.6'),
      make: function () { return {}; }
    },
    tiers: {
      name: ['Bread, Cheese, Meat', 'Bread, Cheese, Meat'], desc: ['Tumpukan 3D tingkat referral', '3D referral tier stack'],
      ico: ic('M12 4 3 8.5l9 4.5 9-4.5zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5'),
      unique: true,
      make: function () { return { items: tierDefaults() }; },
      fields: [0, 1, 2].map(function (i) {
        return { k: 'items.' + i + '.color', type: 'color', label: ['Warna lapisan ' + (i + 1), 'Layer ' + (i + 1) + ' colour'],
          show: function (w) { return !!(w.items || [])[i]; } };
      }),
      note: ['Ketuk salah satu lapisan di kartu untuk menyunting nama dan deskripsinya.', 'Tap a layer on the card to edit its name and description.']
    }
  };
  var PICK_GROUPS = [
    [['Dasar', 'Basics'], ['heading', 'text', 'image', 'button', 'space']],
    [['Media', 'Media'], ['carousel', 'showreel', 'instagram']],
    [['Info', 'Info'], ['table', 'facts', 'accordion', 'chips', 'qr']],
    [['Kartu', 'Card'], ['profile', 'pins', 'contact', 'share', 'tiers']]
  ];

  /* ================= menu Tambah widget ================= */
  function openPicker() {
    if (curPage() == null) return;
    var have = {};
    allWidgets().forEach(function (w) { have[w.type] = true; });
    var w = selWidget();
    sheet(
      '<div class="ed-h">' + T('Tambah widget', 'Add widget') + '</div>' +
      '<p class="ed-sub">' + (w
        ? T('Disisipkan tepat di bawah widget yang sedang dipilih.', 'Inserted right below the selected widget.')
        : T('Ditambahkan di akhir halaman ini. Pilih widget dulu kalau mau menyisipkan di tengah.', 'Added at the end of this page. Select a widget first to insert in between.')) + '</p>' +
      PICK_GROUPS.map(function (g) {
        return '<div class="ed-pk-g">' + esc(TN(g[0])) + '</div><div class="ed-pk">' + g[1].map(function (t) {
          var ty = TYPES[t], off = ty.unique && have[t];
          return '<button type="button" data-t="' + t + '"' + (off ? ' disabled' : '') + '>' + ty.ico +
            '<b>' + esc(TN(ty.name)) + '</b><span>' + esc(off ? T('Sudah ada di kartu', 'Already on the card') : TN(ty.desc)) + '</span></button>';
        }).join('') + '</div>';
      }).join('') +
      '<div class="ed-row"><button class="ed-btn" data-a="no">' + T('Batal', 'Cancel') + '</button></div>',
      function (s) {
        s.querySelector('[data-a="no"]').addEventListener('click', closeSheet);
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-t]');
          if (!b || b.disabled) return;
          closeSheet();
          addWidget(b.dataset.t);
        });
      }
    );
  }

  function addWidget(type) {
    var ty = TYPES[type], l = pageWidgets();
    if (!ty || !l) return;
    var w = { id: newId(type), type: type }, init = ty.make();
    Object.keys(init).forEach(function (k) { w[k] = init[k]; });
    var at = selIndex() < 0 ? l.length : selIndex() + 1;
    l.splice(at, 0, w);
    selId = w.id;
    saveDraft();
    BC.render();
    revealSel(true);
    if (ty.after) ty.after(w, at);
  }

  /* ================= panel Atur =================
     Hidup di <body>, bukan di #app, jadi tidak ikut terhapus saat kartu dirender ulang.
     Karena itu setiap perubahan langsung kelihatan di kartu. Di HP muncul dari bawah,
     di layar lebar menempel di kanan. */
  var panel = null;
  function panelClose() {
    if (!panel) return;
    panel.remove();
    panel = null;
    document.body.classList.remove('ed-panel-on');
  }
  function reopenPanel() { if (selWidget()) openPanel(); }

  function fieldGet(f, w) {
    var v = f.get ? f.get(w) : pget(w, f.k);
    return v == null ? f.def : v;
  }
  function fieldSet(f, w, v) {
    if (f.set) { f.set(w, v); return; }
    if (f.type === 'toggle' && !v) { if (f.off === false) pset(w, f.k, false); else delete w[f.k]; return; }
    if (f.type === 'toggle' && v && f.off === false) { delete w[f.k]; return; }
    if (f.type === 'seg' && v === '') { delete w[f.k]; return; }
    pset(w, f.k, v);
  }

  function fieldHtml(f, w, n) {
    var v = fieldGet(f, w), lab = '<label class="ed-fl">' + esc(TN(f.label)) + '</label>';
    if (f.type === 'seg') {
      return '<div class="ed-f" data-f="' + n + '">' + lab + '<div class="ed-seg">' + f.opts.map(function (o) {
        return '<button type="button" data-v="' + esc(o[0]) + '" class="' + (String(v == null ? '' : v) === o[0] ? 'on' : '') + '">' + esc(T(o[1], o[2])) + '</button>';
      }).join('') + '</div></div>';
    }
    if (f.type === 'range') {
      return '<div class="ed-f" data-f="' + n + '">' + lab + '<div class="ed-rng"><input type="range" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + esc(v) + '">' +
        '<output>' + esc(v) + (f.unit || '') + '</output></div></div>';
    }
    if (f.type === 'toggle') {
      return '<div class="ed-f ed-tg" data-f="' + n + '"><label class="ed-sw"><input type="checkbox"' + (v ? ' checked' : '') + '><i></i><span>' + esc(TN(f.label)) + '</span></label></div>';
    }
    if (f.type === 'color') {
      return '<div class="ed-f ed-tg" data-f="' + n + '"><label class="ed-sw ed-clr"><input type="color" value="' + esc(v || '#8E8E93') + '"><span>' + esc(TN(f.label)) + '</span></label></div>';
    }
    return '<div class="ed-f" data-f="' + n + '">' + lab + '<input class="ed-input" type="text" value="' + esc(v || '') + '" placeholder="' + esc(f.ph || '') + '"></div>';
  }

  function openPanel() {
    var i = selIndex();
    if (i < 0) return;
    var w = pageWidgets()[i], ty = TYPES[w.type] || {}, p = wPath(i);
    var fields = (ty.fields || []).filter(function (f) { return !f.show || f.show(w); });
    var pages = BC.data().pages || [], cp = curPage();
    var again = panel && panel.dataset.wid === w.id;
    var keepY = again ? panel.querySelector('.ed-pbody').scrollTop : 0;
    panelClose();
    panel = document.createElement('div');
    panel.className = 'ed-panel';
    panel.dataset.wid = w.id;
    panel.innerHTML =
      '<div class="ed-ph"><span class="ed-pi">' + (ty.ico || '') + '</span><b>' + esc(TN(ty.name) || w.type) + '</b>' +
      '<button type="button" class="ed-px" aria-label="' + T('Tutup', 'Close') + '">' + IC.close + '</button></div>' +
      '<div class="ed-pbody">' +
      (ty.note ? '<p class="ed-sub">' + esc(TN(ty.note)) + '</p>' : '') +
      fields.map(function (f, n) { return fieldHtml(f, w, n); }).join('') +
      (ty.acts ? '<div class="ed-col">' + ty.acts.map(function (a, n) {
        return '<button class="ed-btn" type="button" data-act="' + n + '">' + esc(TN(a.label)) + '</button>';
      }).join('') + '</div>' : '') +
      (!fields.length && !ty.acts && !ty.note
        ? '<p class="ed-sub">' + T('Widget ini tidak punya pengaturan. Ketuk teksnya di kartu untuk mengubah isi.', 'No settings for this widget. Tap its text on the card to edit.') + '</p>' : '') +
      '<div class="ed-sep"></div>' +
      (pages.length > 1
        ? '<div class="ed-f"><label class="ed-fl">' + T('Pindahkan ke halaman', 'Move to page') + '</label><select class="ed-input" data-move>' +
          pages.map(function (pg, k) {
            return '<option value="' + k + '"' + (k === cp ? ' selected' : '') + '>' + esc(T(pg.tab_id || pg.tab_en, pg.tab_en || pg.tab_id) || ('#' + (k + 1))) + '</option>';
          }).join('') + '</select></div>' : '') +
      '<div class="ed-col"><button class="ed-btn danger" type="button" data-del>' + T('Hapus widget ini', 'Delete this widget') + '</button></div>' +
      '</div>';
    document.body.appendChild(panel);
    document.body.classList.add('ed-panel-on');
    panel.querySelector('.ed-pbody').scrollTop = keepY;
    // di HP panel menutup separuh bawah: gulir widget ke atas supaya perubahannya kelihatan
    if (!again && window.innerWidth < 900) {
      var nd = app().querySelector('.step[data-wl] > .w.sel'), st = document.getElementById('stage');
      if (nd && st) st.scrollTop += nd.getBoundingClientRect().top - st.getBoundingClientRect().top - 36;
    }

    function commit(f) {
      saveDraft();
      BC.render();
      if (f && f.onSet) f.onSet(pget(BC.data(), p), p);
    }
    panel.querySelector('.ed-px').addEventListener('click', panelClose);
    panel.querySelector('[data-del]').addEventListener('click', delSel);
    var mv = panel.querySelector('[data-move]');
    if (mv) mv.addEventListener('change', function () {
      var to = +mv.value, l = pageWidgets();
      if (to === cp) return;
      var it = l.splice(selIndex(), 1)[0];
      pageWidgets(to).push(it);
      selId = null;
      panelClose();
      saveDraft();
      BC.render();
      var pg = pages[to] || {};
      toast(T('Dipindah ke halaman ', 'Moved to page ') + (T(pg.tab_id, pg.tab_en) || to + 1) + '.');
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () { ty.acts[+b.dataset.act].fn(pget(BC.data(), p), p); });
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-f]'), function (box) {
      var f = fields[+box.dataset.f];
      if (f.type === 'seg') {
        box.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b) return;
          fieldSet(f, w, b.dataset.v);
          commit(f);
          // jenis gambar mengubah kontrol yang tampil, panelnya digambar ulang
          if (f.k === 'style' && w.type === 'image') { openPanel(); return; }
          Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
        });
        return;
      }
      var inp = box.querySelector('input');
      if (f.type === 'range') {
        var out = box.querySelector('output');
        inp.addEventListener('input', function () {
          out.textContent = inp.value + (f.unit || '');
          var nd = app().querySelector('.step[data-wl] > .w.sel');
          if (nd && f.live) f.live(nd, +inp.value, w);
        });
        inp.addEventListener('change', function () { fieldSet(f, w, +inp.value); commit(f); });
        return;
      }
      if (f.type === 'toggle') {
        inp.addEventListener('change', function () {
          fieldSet(f, w, inp.checked);
          commit(f);
          openPanel();
        });
        return;
      }
      inp.addEventListener('change', function () {
        var v = inp.value.trim();
        fieldSet(f, w, v);
        commit(f);
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    });
  }

  /* ================= QR otomatis =================
     Pustaka QR (qrcode-generator, MIT) hanya dimuat di editor, saat dibutuhkan.
     Hasilnya PNG yang diunggah seperti gambar biasa, jadi pengunjung tidak ikut
     mengunduh pustaka apa pun. */
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  var qrLoad = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrLoad) return qrLoad;
    qrLoad = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = QR_LIB;
      s.onload = function () { window.qrcode ? ok(window.qrcode) : no(new Error('qr')); };
      s.onerror = function () { qrLoad = null; no(new Error('qr')); };
      document.head.appendChild(s);
    });
    return qrLoad;
  }
  function qrBlob(text) {
    return loadQr().then(function (qrcode) {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      var q = qrcode(0, 'M');
      q.addData(text, 'Byte');
      q.make();
      var n = q.getModuleCount(), quiet = 4, cell = Math.max(6, Math.floor(760 / (n + quiet * 2)));
      var c = document.createElement('canvas');
      c.width = c.height = (n + quiet * 2) * cell;
      var x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) {
        if (q.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    });
  }
  function makeQrFor(p) {
    var o = pget(BC.data(), p);
    var url = o && safeUrl(o.url);
    if (!url) { toast(T('Isi link-nya dulu, misalnya https://increasink.co.id', 'Enter a link first, e.g. https://increasink.co.id'), 'bad'); return; }
    if (busy) return;
    busy = true;
    var t = toast(T('Membuat QR...', 'Making the QR...'), 'wait');
    qrBlob(url).then(upload).then(function (src) {
      busy = false;
      if (t.parentNode) t.remove();
      var cur = pget(BC.data(), p);
      if (!cur) return;
      cur.src = src;
      cur.qr_auto = true;
      saveDraft();
      BC.render();
      reopenPanel();
      toast(T('QR siap. Coba pindai dari HP lain.', 'QR ready. Try scanning it with another phone.'), 'good');
    }).catch(function (err) {
      busy = false;
      if (t.parentNode) t.remove();
      toast((err && err.message !== 'qr' && err.message) || T('Gagal membuat QR.', 'Could not make the QR.'), 'bad');
    });
  }

  /* ================= ubah ukuran gambar langsung di kartu ================= */
  function applyImgW(fig, v, al) {
    al = al || 'center';
    fig.style.width = v < 100 ? v + '%' : '';
    fig.style.marginLeft = v < 100 && al !== 'left' ? 'auto' : '';
    fig.style.marginRight = v < 100 && al === 'center' ? 'auto' : '';
  }
  function wireResize(fig, w) {
    var h = document.createElement('span');
    h.className = 'ed-rs' + (w.align === 'right' ? ' l' : '');
    h.setAttribute('contenteditable', 'false');
    h.setAttribute('aria-label', T('Tarik untuk mengubah ukuran', 'Drag to resize'));
    var lab = document.createElement('span');
    lab.className = 'ed-rs-v';
    h.appendChild(lab);
    fig.appendChild(h);
    h.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { h.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ }
      var col = fig.parentNode.getBoundingClientRect(), cur = w.w || 100, al = w.align || 'center';
      h.classList.add('on');
      function pct(x) {
        var v = al === 'center' ? 2 * Math.abs(x - (col.left + col.width / 2)) / col.width
          : al === 'left' ? (x - col.left) / col.width : (col.right - x) / col.width;
        return Math.round(Math.min(100, Math.max(10, v * 100)));
      }
      function mv(ev) {
        cur = pct(ev.clientX);
        applyImgW(fig, cur, al);
        lab.textContent = cur + '%';
      }
      function up() {
        h.removeEventListener('pointermove', mv);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        suppressUntil = Date.now() + 300;
        if (cur === (w.w || 100)) { h.classList.remove('on'); return; }
        w.w = cur;
        saveDraft();
        BC.render();
        if (panel) openPanel();
      }
      lab.textContent = cur + '%';
      h.addEventListener('pointermove', mv);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  }

  /* ================= kotak huruf accordion ================= */
  function openBadge(gp) {
    var g = pget(BC.data(), gp);
    if (!g) return;
    sheet(
      '<div class="ed-h">' + T('Kotak di kiri judul', 'Box beside the title') + '</div>' +
      '<p class="ed-sub">' + T('Isi satu atau dua huruf, atau pilih ikon.', 'Type one or two letters, or pick an icon.') + '</p>' +
      '<input class="ed-input" id="edbadge" maxlength="2" value="' + esc(g.icon ? '' : g.badge || '') + '" placeholder="G">' +
      '<div class="ed-icons">' + PICK_ICONS.map(function (k) {
        return '<button type="button" data-ic="' + k + '" class="' + (g.icon === k ? 'on' : '') + '" aria-label="' + k + '"><svg viewBox="0 0 24 24">' + BC.icons[k] + '</svg></button>';
      }).join('') + '</div>' +
      '<div class="ed-row"><button class="ed-btn" data-a="no">' + T('Batal', 'Cancel') + '</button>' +
      '<button class="ed-btn primary" data-a="ok">' + T('Pakai huruf', 'Use letters') + '</button></div>',
      function (s) {
        var inp = s.querySelector('#edbadge');
        s.querySelector('[data-a="no"]').addEventListener('click', closeSheet);
        function done() { closeSheet(); saveDraft(); BC.render(); }
        s.querySelector('[data-a="ok"]').addEventListener('click', function () {
          var v = inp.value.trim();
          if (!v) { inp.focus(); return; }
          g.badge = v;
          delete g.icon;
          done();
        });
        s.querySelector('.ed-icons').addEventListener('click', function (e) {
          var b = e.target.closest('[data-ic]');
          if (!b) return;
          g.icon = b.dataset.ic;
          done();
        });
      }
    );
  }

  /* ================= lembar halaman =================
     Urutan, tampil/sembunyi, tambah halaman, dan pengaturan tiap halaman (nama tab, ikon,
     latar gelap). Plus patokan dan hapus semua perubahan. */
  function openPages() {
    var pages = BC.data().pages || [];
    var tiles = pages.map(function (pg, i) {
      return '<div class="ed-tile' + (pg.hidden ? ' off' : '') + '" data-i="' + i + '">' +
        '<span class="ed-grip"></span>' +
        '<span class="ed-tile-ic">' + (pg.tab_img ? '<img src="' + esc(pg.tab_img) + '" alt="">' : '<svg viewBox="0 0 24 24">' + (BC.icons[pg.icon] || BC.icons.star) + '</svg>') + '</span>' +
        '<span class="ed-tile-t">' + esc(T(pg.tab_id || pg.tab_en, pg.tab_en || pg.tab_id) || '#' + (i + 1)) +
        '<em>' + (pg.widgets || []).length + ' widget</em></span>' +
        '<button class="ed-eye ed-pset" aria-label="' + T('Atur halaman', 'Page settings') + '">' + IC.gear + '</button>' +
        '<button class="ed-eye ed-peye" aria-label="' + T('Tampilkan atau sembunyikan', 'Show or hide') + '">' +
        (pg.hidden ? EYE_OFF : EYE_ON) + '</button></div>';
    }).join('');

    sheet(
      '<div class="ed-h">' + T('Halaman', 'Pages') + '</div>' +
      '<p class="ed-sub">' + T('Tahan lalu geser untuk mengubah urutan tab. Ikon mata menyembunyikan halaman dari pengunjung.',
        'Hold and drag to reorder the tabs. The eye hides a page from visitors.') + '</p>' +
      '<div class="ed-tiles ed-live" id="edtiles">' + tiles + '</div>' +
      '<div class="ed-col"><button class="ed-btn" data-a="newpage">+ ' + T('Halaman baru', 'New page') + '</button></div>' +
      '<div class="ed-sep"></div>' +
      '<div class="ed-col">' +
      '<button class="ed-btn" data-a="setdef">' + T('Jadikan patokan', 'Save as baseline') + '</button>' +
      '<button class="ed-btn" data-a="getdef">' + T('Kembalikan ke patokan', 'Restore baseline') + '</button>' +
      '<button class="ed-btn danger" data-a="revert">' + T('Hapus semua perubahan', 'Discard all changes') + '</button>' +
      '</div>' +
      '<div class="ed-row"><button class="ed-btn primary" data-a="ok">' + T('Selesai', 'Done') + '</button></div>',
      function (s) {
        var box = s.querySelector('#edtiles');
        s.querySelector('[data-a="ok"]').addEventListener('click', function () {
          closeSheet();
          BC.rebuild();
        });
        s.querySelector('[data-a="newpage"]').addEventListener('click', function () {
          pages.push({ key: 'p-' + rid(), icon: 'star', tab_id: 'Baru', tab_en: 'New', label_id: 'Halaman baru', label_en: 'New page',
            widgets: [{ id: newId('heading'), type: 'heading', text_id: 'Judul halaman', text_en: 'Page title' }] });
          saveDraft();
          closeSheet();
          selId = null;
          BC.rebuild();
          var st = BC.steps();
          for (var k = 0; k < st.length; k++) if (st[k].page === pages.length - 1) BC.go(k);
          toast(T('Halaman baru dibuat. Ganti nama tab dan ikonnya lewat Halaman.', 'New page created. Rename its tab and icon under Pages.'), 'good');
        });
        s.querySelector('[data-a="setdef"]').addEventListener('click', function () { closeSheet(); askSetDefault(); });
        s.querySelector('[data-a="getdef"]').addEventListener('click', function () { closeSheet(); askGetDefault(); });
        s.querySelector('[data-a="revert"]').addEventListener('click', function () {
          if (!dirty) { toast(T('Belum ada perubahan.', 'Nothing has changed yet.')); return; }
          closeSheet();
          revert();
        });
        box.addEventListener('click', function (e) {
          if (Date.now() < suppressUntil) return;
          var tile = e.target.closest('.ed-tile');
          if (!tile) return;
          var pg = pages[+tile.dataset.i];
          if (e.target.closest('.ed-pset')) { openPageSet(+tile.dataset.i); return; }
          var eye = e.target.closest('.ed-peye');
          if (!eye) return;
          if (pg.hidden) delete pg.hidden; else pg.hidden = true;
          tile.classList.toggle('off', !!pg.hidden);
          eye.innerHTML = pg.hidden ? EYE_OFF : EYE_ON;
          saveDraft();
        });
        sortable(box, '.ed-tile', function () {
          var next = Array.prototype.map.call(box.querySelectorAll('.ed-tile'), function (t) { return pages[+t.dataset.i]; });
          pages.length = 0;
          next.forEach(function (x) { pages.push(x); });
          Array.prototype.forEach.call(box.querySelectorAll('.ed-tile'), function (t, i) { t.dataset.i = i; });
          saveDraft();
        });
      }
    );
  }

  function openPageSet(i) {
    var pages = BC.data().pages, pg = pages[i];
    if (!pg) return;
    sheet(
      '<div class="ed-h">' + T('Atur halaman', 'Page settings') + '</div>' +
      '<div class="ed-f"><label class="ed-fl">' + T('Nama tab (Indonesia)', 'Tab name (Indonesian)') + '</label><input class="ed-input" data-k="tab_id" maxlength="14" value="' + esc(pg.tab_id || '') + '"></div>' +
      '<div class="ed-f"><label class="ed-fl">' + T('Nama tab (Inggris)', 'Tab name (English)') + '</label><input class="ed-input" data-k="tab_en" maxlength="14" value="' + esc(pg.tab_en || '') + '"></div>' +
      '<div class="ed-f"><label class="ed-fl">' + T('Ikon tab', 'Tab icon') + '</label><div class="ed-icons">' + PICK_ICONS.map(function (k) {
        return '<button type="button" data-ic="' + k + '" class="' + (!pg.tab_img && pg.icon === k ? 'on' : '') + '" aria-label="' + k + '"><svg viewBox="0 0 24 24">' + BC.icons[k] + '</svg></button>';
      }).join('') + '</div></div>' +
      '<div class="ed-col"><button class="ed-btn" data-a="img">' + (pg.tab_img ? T('Ganti gambar ikon', 'Change icon image') : T('Pakai gambar sebagai ikon (mis. logo)', 'Use an image as the icon (e.g. a logo)')) + '</button>' +
      (pg.tab_img ? '<button class="ed-btn" data-a="noimg">' + T('Lepas gambar, pakai ikon', 'Remove image, use icon') + '</button>' : '') + '</div>' +
      '<div class="ed-f ed-tg"><label class="ed-sw"><input type="checkbox" data-k="dark"' + (pg.dark ? ' checked' : '') + '><i></i><span>' + T('Latar gelap', 'Dark background') + '</span></label></div>' +
      '<div class="ed-sep"></div>' +
      '<div class="ed-col">' + (pages.length > 1 ? '<button class="ed-btn danger" data-a="del">' + T('Hapus halaman ini', 'Delete this page') + '</button>' : '') + '</div>' +
      '<div class="ed-row"><button class="ed-btn primary" data-a="back">' + T('Selesai', 'Done') + '</button></div>',
      function (s) {
        function save() { saveDraft(); }
        Array.prototype.forEach.call(s.querySelectorAll('input[data-k]'), function (inp) {
          inp.addEventListener('change', function () {
            var k = inp.dataset.k;
            if (k === 'dark') { if (inp.checked) pg.dark = true; else delete pg.dark; }
            else {
              pg[k] = inp.value.trim();
              // label dipakai di strip editor, ikut nama tab supaya tidak membingungkan
              pg[k === 'tab_id' ? 'label_id' : 'label_en'] = pg[k];
            }
            save();
          });
        });
        s.querySelector('.ed-icons').addEventListener('click', function (e) {
          var b = e.target.closest('[data-ic]');
          if (!b) return;
          pg.icon = b.dataset.ic;
          delete pg.tab_img;
          Array.prototype.forEach.call(s.querySelectorAll('[data-ic]'), function (x) { x.classList.toggle('on', x === b); });
          save();
        });
        s.querySelector('[data-a="img"]').addEventListener('click', function () {
          closeSheet();
          chooseImage(function (url) { pg.tab_img = url; }, function () { openPageSet(i); });
        });
        var ni = s.querySelector('[data-a="noimg"]');
        if (ni) ni.addEventListener('click', function () { delete pg.tab_img; save(); openPageSet(i); });
        var del = s.querySelector('[data-a="del"]');
        if (del) del.addEventListener('click', function () {
          sheet(
            '<div class="ed-h">' + T('Hapus halaman?', 'Delete page?') + '</div>' +
            '<p class="ed-sub">' + T('Halaman dan semua widget di dalamnya dihapus. Masih bisa diurungkan sebelum Publish.',
              'The page and all its widgets are removed. You can still undo before publishing.') + '</p>' +
            '<div class="ed-col"><button class="ed-btn danger" data-a="go">' + T('Hapus', 'Delete') + '</button>' +
            '<button class="ed-btn" data-a="no">' + T('Batal', 'Cancel') + '</button></div>',
            function (s2) {
              s2.querySelector('[data-a="no"]').addEventListener('click', function () { openPageSet(i); });
              s2.querySelector('[data-a="go"]').addEventListener('click', function () {
                pages.splice(i, 1);
                selId = null;
                saveDraft();
                closeSheet();
                BC.rebuild();
                toast(T('Halaman dihapus.', 'Page deleted.'), null, { label: T('Urungkan', 'Undo'), fn: undo });
              });
            }
          );
        });
        s.querySelector('[data-a="back"]').addEventListener('click', function () { openPages(); });
      }
    );
  }

  /* ================= lembar slide carousel =================
     Urutan, hapus, tambah gambar, dan tambah video. Gambar lewat /api/upload,
     video langsung ke Vercel Blob karena terlalu besar untuk body function.
     opt.images = hanya gambar (strip foto tabel). */
  function slideTile(sl, i) {
    var vid = sl.type === 'video';
    var thumb = vid ? sl.poster : sl.src;
    var name = (vid ? T('Video', 'Video') : T('Gambar', 'Image')) + ' ' + (i + 1);
    var file = String(sl.src || '').split('/').pop();
    return '<div class="ed-tile" data-i="' + i + '">' +
      '<span class="ed-grip"></span>' +
      '<span class="ed-thumb"' + (thumb ? ' style="background-image:url(' + esc(thumb) + ')"' : '') + '></span>' +
      '<span class="ed-tile-t">' + esc(name) + '<em>' + esc(file) + '</em></span>' +
      '<button class="ed-eye ed-del" aria-label="' + T('Hapus slide', 'Remove slide') + '">&times;</button></div>';
  }

  function openSlides(path, opt) {
    opt = opt || {};
    var arr = pget(BC.data(), path);
    if (!Array.isArray(arr)) {
      arr = [];
      pset(BC.data(), path, arr);
    }
    var title = opt.title || ['Foto dan video', 'Photos and videos'];
    var again = function () { openSlides(path, opt); };
    var EMPTY = '<p class="ed-sub" style="margin:0">' + T('Belum ada isi.', 'Nothing here yet.') + '</p>';

    sheet(
      '<div class="ed-h">' + esc(TN(title)) + '</div>' +
      '<p class="ed-sub">' + T('Tahan lalu geser untuk memindahkan. Tombol silang menghapus.',
        'Hold and drag to move. The cross removes an item.') + '</p>' +
      '<div class="ed-tiles ed-live" id="edslides">' + (arr.length ? arr.map(slideTile).join('') : EMPTY) + '</div>' +
      '<div class="ed-col"><button class="ed-btn" data-a="addimg">+ ' +
      T('Tambah gambar', 'Add image') + '</button>' +
      (opt.images ? '' : '<button class="ed-btn" data-a="addvid">+ ' + T('Tambah video', 'Add video') + '</button>') + '</div>' +
      '<div class="ed-row">' +
      '<button class="ed-btn primary" data-a="ok">' + T('Selesai', 'Done') + '</button></div>',
      function (s) {
        var box = s.querySelector('#edslides');
        function reindex() {
          Array.prototype.forEach.call(box.querySelectorAll('.ed-tile'), function (t, i) { t.dataset.i = i; });
        }
        s.querySelector('[data-a="ok"]').addEventListener('click', function () { closeSheet(); BC.rebuild(); });
        s.querySelector('[data-a="addimg"]').addEventListener('click', function () {
          closeSheet();
          chooseImage(function (url) {
            arr.push(opt.images ? { src: url } : { type: 'image', src: url });
          }, again);
        });
        var av = s.querySelector('[data-a="addvid"]');
        if (av) av.addEventListener('click', function () {
          closeSheet();
          chooseVideo(function (url) {
            arr.push({ type: 'video', src: url });
          }, again);
        });
        box.addEventListener('click', function (e) {
          var x = e.target.closest('.ed-del');
          if (!x || Date.now() < suppressUntil) return;
          var tile = x.closest('.ed-tile');
          arr.splice(+tile.dataset.i, 1);
          tile.remove();
          reindex();
          saveDraft();
          if (!arr.length) box.innerHTML = EMPTY;
        });
        /* Jangan panggil BC.render() di sini: render menulis ulang isi #app dan
           lembar ini ikut terhapus. Kartu baru disegarkan saat Selesai. */
        sortable(box, '.ed-tile', function () {
          var next = Array.prototype.map.call(box.querySelectorAll('.ed-tile'), function (t) {
            return arr[+t.dataset.i];
          });
          arr.length = 0;
          next.forEach(function (x) { arr.push(x); });
          reindex();
          saveDraft();
        });
      }
    );
  }

  /* ================= patokan =================
     Disimpan sebagai <card>/default.json lewat /api/publish slot "default".
     Kartu yang tayang tidak ikut berubah sampai Publish ditekan. */
  function askSetDefault() {
    sheet(
      '<div class="ed-h">' + T('Jadikan patokan', 'Save as baseline') + '</div>' +
      '<p class="ed-sub">' + T('Isi kartu saat ini disimpan sebagai titik aman. Patokan lama akan ditimpa.',
        'The card as it is now becomes the safe point. The previous baseline is overwritten.') + '</p>' +
      '<div class="ed-col">' +
      '<button class="ed-btn primary" data-a="go">' + T('Simpan patokan', 'Save baseline') + '</button>' +
      '<button class="ed-btn" data-a="no">' + T('Batal', 'Cancel') + '</button></div>',
      function (s) {
        s.querySelector('[data-a="no"]').addEventListener('click', closeSheet);
        s.querySelector('[data-a="go"]').addEventListener('click', function () { closeSheet(); setDefault(); });
      }
    );
  }

  function setDefault() {
    if (busy) return;
    busy = true;
    var t = toast(T('Menyimpan patokan...', 'Saving baseline...'), 'wait');
    fetch(API + '/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ card: CARD, slot: 'default', data: BC.data() })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    }).then(function (x) {
      busy = false;
      if (t.parentNode) t.remove();
      if (!x.ok) {
        if (x.status === 401) logout();
        toast(x.j.error || T('Gagal menyimpan patokan.', 'Could not save baseline.'), 'bad');
        return;
      }
      toast(T('Patokan tersimpan.', 'Baseline saved.'), 'good');
    }).catch(function () {
      busy = false;
      if (t.parentNode) t.remove();
      toast(T('Gagal menghubungi server.', 'Cannot reach the server.'), 'bad');
    });
  }

  function askGetDefault() {
    if (busy) return;
    busy = true;
    var t = toast(T('Mengambil patokan...', 'Loading baseline...'), 'wait');
    fetch('default.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('404');
      return r.json();
    }).then(function (def) {
      busy = false;
      if (t.parentNode) t.remove();
      if (!def || typeof def !== 'object' || Array.isArray(def)) throw new Error('bad');
      sheet(
        '<div class="ed-h">' + T('Kembalikan ke patokan', 'Restore baseline') + '</div>' +
        '<p class="ed-sub">' + T('Seluruh isi kartu diganti dengan patokan yang tersimpan. Kartu yang tayang belum berubah sampai Anda menekan Publish.',
          'The whole card is replaced by the saved baseline. The live card does not change until you press Publish.') + '</p>' +
        '<div class="ed-col">' +
        '<button class="ed-btn danger" data-a="go">' + T('Kembalikan', 'Restore') + '</button>' +
        '<button class="ed-btn" data-a="no">' + T('Batal', 'Cancel') + '</button></div>',
        function (s) {
          s.querySelector('[data-a="no"]').addEventListener('click', closeSheet);
          s.querySelector('[data-a="go"]').addEventListener('click', function () {
            closeSheet();
            replaceData(def);
            saveDraft();
            BC.rebuild();
            toast(T('Sudah kembali ke patokan. Tekan Publish supaya orang lain ikut melihat.',
              'Back to the baseline. Press Publish so everyone else sees it too.'), 'good');
          });
        }
      );
    }).catch(function () {
      busy = false;
      if (t.parentNode) t.remove();
      toast(T('Belum ada patokan tersimpan. Simpan dulu lewat Jadikan patokan.',
        'No baseline saved yet. Use Save as baseline first.'), 'bad');
    });
  }

  /* ================= mesin geser ala home screen =================
     Satu state global, listener document dipasang sekali seumur halaman.
     sortable() hanya menandai sebuah container, jadi render ulang kartu tidak
     pernah menumpuk listener. */
  var DG = null;   // { box, sel, onDrop, node, sx, sy, pid, live, timer }

  function sortable(box, sel, onDrop, handle) {
    box.addEventListener('pointerdown', function (e) {
      if (DG || (e.button != null && e.button !== 0)) return;
      // item besar (pilar GAINS) hanya bisa diseret dari pegangannya, supaya teks tetap bisa disunting
      if (handle && !e.target.closest(handle)) return;
      var it = e.target.closest(sel);
      if (!it || it.parentNode !== box) return;
      if (e.target.closest('.ed-x, .ed-add, .ed-eye')) return;
      DG = {
        box: box, sel: sel, onDrop: onDrop, node: it,
        sx: e.clientX, sy: e.clientY, pid: e.pointerId, live: false, timer: null
      };
      DG.timer = setTimeout(dragBegin, e.pointerType === 'mouse' ? 140 : 260);
    });
  }

  function dragSiblings() {
    return Array.prototype.filter.call(DG.box.children, function (c) { return c.matches(DG.sel); });
  }

  function dragBegin() {
    if (!DG) return;
    DG.live = true;
    try { DG.node.setPointerCapture(DG.pid); } catch (e) { /* abaikan */ }
    DG.node.classList.add('ed-drag');
    dragSiblings().forEach(function (x) { if (x !== DG.node) x.classList.add('ed-shift'); });
    if (navigator.vibrate) navigator.vibrate(9);
  }

  document.addEventListener('pointermove', function (e) {
    if (!DG || e.pointerId !== DG.pid) return;
    var dx = e.clientX - DG.sx, dy = e.clientY - DG.sy;
    if (!DG.live) {
      // bergerak sebelum tahanan cukup lama berarti scroll atau ketukan biasa
      if (Math.abs(dx) > 9 || Math.abs(dy) > 9) { clearTimeout(DG.timer); DG = null; }
      return;
    }
    e.preventDefault();
    DG.node.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.03)';

    var under = document.elementFromPoint(e.clientX, e.clientY);
    var sib = under && under.closest ? under.closest(DG.sel) : null;
    if (!sib || sib === DG.node || sib.parentNode !== DG.box) return;

    var r = sib.getBoundingClientRect();
    var sameRow = Math.abs(r.top - DG.node.getBoundingClientRect().top) < r.height * 0.6;
    var before = sameRow ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;

    var pre = DG.node.getBoundingClientRect();
    DG.box.insertBefore(DG.node, before ? sib : sib.nextSibling);
    var post = DG.node.getBoundingClientRect();
    // elemen berpindah di layout, geser titik awal supaya tetap di bawah jari
    DG.sx += post.left - pre.left;
    DG.sy += post.top - pre.top;
    DG.node.style.transform = 'translate(' + (e.clientX - DG.sx) + 'px,' + (e.clientY - DG.sy) + 'px) scale(1.03)';
  }, { passive: false });

  function dragEnd(e) {
    if (!DG || (e && e.pointerId !== DG.pid)) return;
    var g = DG;
    DG = null;
    clearTimeout(g.timer);
    g.node.style.transform = '';
    g.node.classList.remove('ed-drag');
    Array.prototype.forEach.call(g.box.children, function (x) { x.classList.remove('ed-shift'); });
    if (g.live) {
      suppressUntil = Date.now() + 350;   // jangan biarkan drag berubah jadi klik
      g.onDrop();
    }
  }
  document.addEventListener('pointerup', dragEnd);
  document.addEventListener('pointercancel', dragEnd);

  /* ================= memasang kontrol sunting ================= */
  function readVal(nd) {
    var c = nd.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.ed-x, .ed-wgrip, .ed-rs'), function (x) { x.remove(); });
    var v = nd.dataset.rich ? c.innerHTML : (c.textContent || '');
    v = v.replace(/ /g, ' ').replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();  // baris baru dipertahankan (alamat dua baris)
    if (nd.dataset.rich) v = v.replace(/(<br\s*\/?>\s*)+$/i, '');
    if (nd.dataset.prefix && v.indexOf(nd.dataset.prefix) === 0) v = v.slice(nd.dataset.prefix.length);
    return v;
  }

  function wireText(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-e]'), function (nd) {
      nd.setAttribute('contenteditable', 'true');
      nd.setAttribute('spellcheck', 'false');
      nd.setAttribute('data-ph', T('Ketuk untuk isi', 'Tap to fill'));
      nd.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { nd.blur(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        // teks kaya boleh pindah baris lewat Shift+Enter, selain itu Enter berarti selesai
        if (e.shiftKey && nd.dataset.rich) {
          if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>');
          return;
        }
        nd.blur();
      });
      // tempel sebagai teks polos, jangan bawa gaya dari sumbernya
      nd.addEventListener('paste', function (e) {
        e.preventDefault();
        var txt = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, String(txt).replace(/\s+/g, ' '));
      });
      nd.addEventListener('focus', function () { fmtShow(nd); });
      nd.addEventListener('blur', function () {
        if (!fmtLock) fmtHide();
        var path = nd.dataset.e;
        var next = readVal(nd);
        var now = pget(BC.data(), path);
        if (String(now == null ? '' : now) === next) return;
        pset(BC.data(), path, next);
        saveDraft();
      });
    });
  }

  /* Toolbar kecil di atas teks yang sedang disunting: Bold, Italic, Underline, Link,
     hapus format, dan Hapus item. Di HP tidak ada Ctrl+B, dan tombol × di pojok item
     terlalu kecil. Tombolnya dipicu pointerdown + preventDefault supaya fokus tidak
     lepas dari teks. Saat mengetik link fokus memang pindah ke kolom link, jadi
     fmtLock menahan toolbar supaya tidak ikut hilang. */
  var fmt = null, fmtLock = false;
  function fmtHide() { fmtLock = false; if (fmt && fmt.parentNode) fmt.remove(); fmt = null; }
  function itemOf(nd) {
    var box = nd.closest('[data-arr]');
    if (!box) return null;
    var kind = box.dataset.kind || 'fixed', sel = CHILD[kind] || '*';
    if (kind === 'fixed' || kind === 'pin') return null;
    var it = nd.closest(sel);
    if (!it || it.parentNode !== box) return null;
    var i = Array.prototype.filter.call(box.children, function (c) { return c.matches(sel); }).indexOf(it);
    return i < 0 ? null : { box: box, i: i, kind: kind };
  }
  function fmtPlace(nd) {
    var r = nd.getBoundingClientRect();
    fmt.style.left = Math.max(8, Math.min(r.left, window.innerWidth - fmt.offsetWidth - 8)) + 'px';
    fmt.style.top = Math.max(8, r.top - 46) + 'px';
  }
  function fmtShow(nd) {
    fmtHide();
    var item = itemOf(nd);
    var rich = !!nd.dataset.rich;
    if (!rich && !item) return;
    fmt = document.createElement('div');
    fmt.className = 'ed-fmt';
    fmt.innerHTML = (rich
      ? '<button data-f="bold" aria-label="Bold"><b>B</b></button>' +
        '<button data-f="italic" aria-label="Italic"><i>I</i></button>' +
        '<button data-f="underline" aria-label="Underline"><u>U</u></button>' +
        '<button data-f="link" aria-label="Link">' + ic('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1') + '</button>' +
        '<button data-f="clear" aria-label="' + T('Hapus format', 'Clear formatting') + '">' + ic('M5 5h12M11 5l-3 14M15 13l5 5M20 13l-5 5') + '</button>'
      : '') +
      (item ? '<button data-f="del">' + T('Hapus item', 'Remove item') + '</button>' : '');
    fmt.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button');
      if (!b || e.target.closest('.ed-fmt-link')) return;
      e.preventDefault();
      var f = b.dataset.f;
      if (f === 'bold' || f === 'italic' || f === 'underline') {
        document.execCommand('styleWithCSS', false, false);
        document.execCommand(f);
        return;
      }
      if (f === 'clear') {
        document.execCommand('removeFormat');
        document.execCommand('unlink');
        return;
      }
      if (f === 'link') { linkMode(nd); return; }
      // blur dulu supaya suntingan tersimpan ke index yang masih benar, baru dihapus
      var path = item.box.dataset.arr, i = item.i;
      nd.blur();
      fmtHide();
      pget(BC.data(), path).splice(i, 1);
      saveDraft();
      BC.render();
    });
    document.body.appendChild(fmt);
    fmtPlace(nd);
  }
  function linkMode(nd) {
    var s = window.getSelection();
    var rng = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    var a = rng && (rng.startContainer.parentElement || {}).closest ? rng.startContainer.parentElement.closest('a') : null;
    fmtLock = true;
    fmt.innerHTML = '<div class="ed-fmt-link"><input type="url" placeholder="https://" value="' + esc(a ? a.getAttribute('href') : '') + '">' +
      '<button data-f="ok">OK</button>' + (a ? '<button data-f="unlink">' + T('Lepas', 'Remove') + '</button>' : '') +
      '<button data-f="x" aria-label="' + T('Batal', 'Cancel') + '">&times;</button></div>';
    var inp = fmt.querySelector('input');
    function back() {
      nd.focus();
      if (rng) { var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rng); }
    }
    function finish(action) {
      fmtLock = false;
      back();
      if (action === 'unlink') document.execCommand('unlink');
      if (action === 'ok') {
        var url = safeUrl(inp.value);
        if (!url) { fmtLock = true; inp.focus(); inp.classList.add('bad'); return; }
        if (rng && !rng.collapsed) document.execCommand('createLink', false, url);
        else document.execCommand('insertHTML', false, '<a href="' + esc(url) + '">' + esc(inp.value.trim()) + '</a>');
      }
      fmtShow(nd);
    }
    fmt.querySelector('.ed-fmt-link').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) finish(b.dataset.f);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish('ok'); }
      if (e.key === 'Escape') finish('x');
    });
    fmtPlace(nd);
    setTimeout(function () { inp.focus(); }, 30);
  }

  function blankItem(kind, arr) {
    if (kind === 'text') return T('Baru', 'New');
    if (kind === 'ml') return { id: 'Item baru', en: 'New item' };
    if (kind === 'fact') {
      var n = String(arr.length + 1);
      return { n: n.length < 2 ? '0' + n : n, id: 'Fakta baru', en: 'New fact' };
    }
    if (kind === 'row') return { label_id: 'Label', label_en: 'Label', value_id: '', value_en: '' };
    if (kind === 'acc') {
      return { k: rid(), badge: String.fromCharCode(65 + (arr.length % 26)), title_id: 'Judul baru', title_en: 'New title', body_id: '', body_en: '' };
    }
    return null;
  }

  /* Baris tabel dan item accordion terlalu besar untuk digoyang dan mengunci scroll,
     jadi digeser lewat pegangan saja. Hapusnya lewat tombol Hapus item di toolbar teks. */
  var HANDLE = { row: '.ed-grip-h', acc: '.acc-l' };
  function wireArrays(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-arr]'), function (box) {
      var path = box.dataset.arr;
      var kind = box.dataset.kind || 'fixed';
      var sel = CHILD[kind] || '*';
      var arr = pget(BC.data(), path);
      if (!Array.isArray(arr)) return;

      Array.prototype.forEach.call(box.querySelectorAll(sel), function (child, i) {
        if (child.parentNode !== box) return;
        child.style.setProperty('--i', i);
        if (kind === 'fixed' || kind === 'acc') return;
        if (kind === 'row') {
          var g = document.createElement('span');
          g.className = 'ed-grip-h';
          g.setAttribute('contenteditable', 'false');
          g.setAttribute('aria-hidden', 'true');
          child.appendChild(g);
          return;
        }
        var x = document.createElement('button');
        x.className = 'ed-x';
        x.setAttribute('contenteditable', 'false');
        x.setAttribute('aria-label', T('Hapus', 'Remove'));
        x.textContent = '×';
        x.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          pget(BC.data(), path).splice(i, 1);
          saveDraft();
          BC.render();
        });
        child.appendChild(x);
      });

      if (kind !== 'fixed') {
        var add = document.createElement('button');
        add.className = 'ed-add';
        add.type = 'button';
        add.textContent = '+ ' + (kind === 'row' ? T('Baris', 'Row') : kind === 'acc' ? T('Item', 'Item') : T('Tambah', 'Add'));
        add.addEventListener('click', function (e) {
          e.stopPropagation();
          // pin selalu berupa gambar, jadi langsung minta berkasnya, bukan item kosong
          if (kind === 'pin') {
            chooseImage(function (url) { pget(BC.data(), path).push({ src: url, alt: '' }); });
            return;
          }
          pget(BC.data(), path).push(blankItem(kind, arr));
          saveDraft();
          BC.render();
        });
        var ph = kind === 'row' && box.querySelector(':scope > .bs-photos');
        if (ph) box.insertBefore(add, ph); else box.appendChild(add);
      }

      sortable(box, sel, function () {
        var order = Array.prototype.map.call(box.querySelectorAll(':scope > ' + sel), function (c) {
          return +c.dataset.idx;
        });
        var src = pget(BC.data(), path);
        pset(BC.data(), path, order.map(function (i) { return src[i]; }));
        saveDraft();
        BC.render();
      }, HANDLE[kind] || null);

      Array.prototype.forEach.call(box.querySelectorAll(':scope > ' + sel), function (c, i) { c.dataset.idx = i; });
    });
  }

  /* Pembungkus widget: label jenis, geser seluruh widget lewat pegangan, tombol tambahan
     di accordion (poin, chip), dan kotak huruf yang bisa diketuk. */
  function wireWidgets(root) {
    var step = root.querySelector('.step[data-wl]');
    if (!step) return;
    Array.prototype.forEach.call(step.children, function (nd) {
      if (!nd.classList.contains('w')) return;
      var ty = TYPES[nd.dataset.wt];
      nd.setAttribute('data-label', ty ? TN(ty.name) : nd.dataset.wt);
    });
    sortable(step, '.w', function () {
      var l = pageWidgets();
      var order = Array.prototype.map.call(step.querySelectorAll(':scope > .w'), function (c) { return l[+c.dataset.w]; });
      pageWidgets().length = 0;
      order.forEach(function (w) { l.push(w); });
      saveDraft();
      BC.render();
    }, '.ed-wgrip');
    Array.prototype.forEach.call(step.querySelectorAll('[data-more]'), function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        e.stopPropagation();
        var g = pget(BC.data(), box.dataset.more);
        if (b.dataset.m === 'list') g.list = [{ id: 'Poin baru', en: 'New point' }];
        else g.chips = [T('Baru', 'New')];
        saveDraft();
        BC.render();
      });
    });
    Array.prototype.forEach.call(step.querySelectorAll('[data-badge]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (Date.now() < suppressUntil) return;
        openBadge(b.dataset.badge);
      });
    });
  }

  // memilih widget: ketukan di mana pun di dalam pembungkusnya, termasuk saat mulai mengetik
  document.addEventListener('click', function (e) {
    if (!editing || !unlocked || !e.target.closest) return;
    if (e.target.closest('.ed-bar, .ed-sheet, .ed-panel, .ed-fmt, .ed-toast')) return;
    var nd = e.target.closest('.step[data-wl] > .w');
    if (nd) {
      var w = (pageWidgets() || [])[+nd.dataset.w];
      if (w) select(w.id);
      return;
    }
    if (e.target.closest('#stage')) select(null);
  });
  document.addEventListener('focusin', function (e) {
    if (!editing || !e.target.closest) return;
    var nd = e.target.closest('.step[data-wl] > .w');
    var w = nd && (pageWidgets() || [])[+nd.dataset.w];
    if (w && w.id !== selId) select(w.id);
  });

  /* ---------- gambar ---------- */
  var MAX_SIDE = 1600;
  var MAX_UPLOAD = 4 * 1024 * 1024;   // di bawah batas body 4,5 MB function Vercel

  function pickImage(cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (f) cb(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  /* Foto HP dikecilkan dulu di browser: sisi terpanjang 1600px, WebP, atau JPEG
     kalau browser tidak bisa membuat WebP. GIF dan gambar yang sudah kecil dikirim apa adanya. */
  function shrink(file) {
    if (file.type === 'image/gif') return Promise.resolve(file);
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(w, h));
        if (k === 1 && file.size <= 900 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return ok(file);
        var c = document.createElement('canvas');
        c.width = Math.round(w * k);
        c.height = Math.round(h * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (b && b.type === 'image/webp') return ok(b);
          // JPEG tidak punya transparansi, alasnya diberi putih supaya tidak jadi hitam
          var j = document.createElement('canvas');
          j.width = c.width;
          j.height = c.height;
          var x = j.getContext('2d');
          x.fillStyle = '#fff';
          x.fillRect(0, 0, j.width, j.height);
          x.drawImage(c, 0, 0);
          j.toBlob(function (jb) {
            jb ? ok(jb) : no(new Error(T('Gambar gagal diproses.', 'Could not process the image.')));
          }, 'image/jpeg', 0.85);
        }, 'image/webp', 0.85);
      };
      im.onerror = function () {
        URL.revokeObjectURL(url);
        no(new Error(T('Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.', 'Unsupported image. Use JPG, PNG or WebP.')));
      };
      im.src = url;
    });
  }

  function upload(blob) {
    if (blob.size > MAX_UPLOAD) {
      return Promise.reject(new Error(T('Gambar terlalu besar, maksimal 4 MB.', 'Image too large, 4 MB max.')));
    }
    return fetch(API + '/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Card': CARD, Authorization: 'Bearer ' + token },
      body: blob
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.url) return j.url;
        if (r.status === 401) logout();
        throw new Error(j.error || T('Gagal mengunggah gambar.', 'Upload failed.'));
      });
    }, function () {
      throw new Error(T('Gagal menghubungi server.', 'Cannot reach the server.'));
    });
  }

  /* Video dikirim langsung dari browser ke Vercel Blob. /api/upload-video hanya
     membagikan token sekali pakai setelah sesi editor diperiksa. Pustaka klien Blob
     dimuat saat dibutuhkan saja, jadi pengunjung biasa tidak ikut mengunduhnya. */
  var MAX_VIDEO = 50 * 1024 * 1024;
  var BLOB_CLIENT = 'https://esm.sh/@vercel/blob@2.8.0/client?target=es2020';
  function pickVideo(cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'video/mp4,video/quicktime,video/webm';
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (f) cb(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }
  function uploadVideo(file, progress) {
    if (file.size > MAX_VIDEO) {
      return Promise.reject(new Error(T('Video terlalu besar, maksimal 50 MB.', 'Video too large, 50 MB max.')));
    }
    var ext = /quicktime/.test(file.type) ? 'mov' : /webm/.test(file.type) ? 'webm' : 'mp4';
    return import(BLOB_CLIENT).then(function (blob) {
      return blob.upload('cards/' + CARD + '/video.' + ext, file, {
        access: 'public',
        handleUploadUrl: API + '/upload-video',
        headers: { 'X-Card': CARD, Authorization: 'Bearer ' + token },
        contentType: file.type || 'video/mp4',
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: function (e) { if (progress) progress(e.percentage); }
      });
    }, function () {
      throw new Error(T('Gagal memuat pengunggah video.', 'Could not load the video uploader.'));
    }).then(function (r) { return r.url; }, function (err) {
      var msg = String((err && err.message) || '');
      if (/401|sesi/i.test(msg)) logout();
      throw new Error(msg || T('Gagal mengunggah video.', 'Video upload failed.'));
    });
  }
  function chooseVideo(apply, after) {
    if (busy) return;
    pickVideo(function (file) {
      if (busy) return;
      busy = true;
      var t = toast(T('Mengunggah video...', 'Uploading video...'), 'wait');
      uploadVideo(file, function (pct) {
        t.textContent = T('Mengunggah video... ', 'Uploading video... ') + Math.round(pct) + '%';
      }).then(function (url) {
        busy = false;
        if (t.parentNode) t.remove();
        apply(url);
        saveDraft();
        BC.render();
        if (after) after();
      }).catch(function (err) {
        busy = false;
        if (t.parentNode) t.remove();
        toast((err && err.message) || T('Gagal mengunggah video.', 'Video upload failed.'), 'bad');
      });
    });
  }

  function chooseImage(apply, after) {
    if (busy) return;
    pickImage(function (file) {
      if (busy) return;
      busy = true;
      var t = toast(T('Mengunggah gambar...', 'Uploading image...'), 'wait');
      shrink(file).then(upload).then(function (url) {
        busy = false;
        if (t.parentNode) t.remove();
        apply(url);
        saveDraft();
        BC.render();
        if (after) after();
      }).catch(function (err) {
        busy = false;
        if (t.parentNode) t.remove();
        toast((err && err.message) || T('Gagal mengunggah gambar.', 'Upload failed.'), 'bad');
      });
    });
  }

  /* Tombol Ganti gambar di bawah setiap elemen yang punya data-img (foto cover,
     foto profil, blok gambar). Nilai data-img adalah alamat field-nya. */
  function wireMedia(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-img]'), function (nd) {
      var b = document.createElement('button');
      b.className = 'ed-add ed-img-btn';
      b.type = 'button';
      b.textContent = T('Ganti gambar', 'Change image');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var path = nd.dataset.img;
        chooseImage(function (url) { pset(BC.data(), path, url); });
      });
      nd.parentNode.insertBefore(b, nd.nextSibling);
    });
  }

  /* Tombol Atur slide di bawah carousel yang punya data-slides. */
  function wireSlides(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-slides]'), function (nd) {
      var b = document.createElement('button');
      b.className = 'ed-add ed-img-btn';
      b.type = 'button';
      b.textContent = T('Atur foto dan video', 'Manage photos and videos');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openSlides(nd.dataset.slides);
      });
      nd.parentNode.insertBefore(b, nd.nextSibling);
    });
  }

  /* ================= gambar ulang lapisan editor ================= */
  function paint() {
    fmtHide();   // teksnya baru ditulis ulang, toolbar lama tidak menunjuk ke apa-apa lagi
    var a = app();
    if (!a) return;
    a.classList.toggle('editing', editing && unlocked);
    var old = a.querySelector('.ed-bar');
    if (old) old.remove();
    if (!unlocked || !editing) { panelClose(); return; }
    if (selIndex() < 0) { selId = null; panelClose(); }
    wireText(a);
    wireArrays(a);
    wireMedia(a);
    wireSlides(a);
    wireHide(a);
    wireWidgets(a);
    markSel();
    a.appendChild(buildBar());
  }

  /* Tombol mata di baris Bio Sheet: sembunyikan dari kartu tanpa menghapus isinya.
     Cukup ubah data dan kelas, tanpa BC.render(), supaya tidak ada yang melompat. */
  function wireHide(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-hide]'), function (row) {
      var b = document.createElement('button');
      b.className = 'ed-hide';
      b.setAttribute('contenteditable', 'false');
      function paintEye() {
        var off = row.classList.contains('ed-off');
        b.innerHTML = off ? EYE_OFF : EYE_ON;
        b.setAttribute('aria-pressed', off ? 'true' : 'false');
        b.setAttribute('aria-label', off ? T('Tampilkan di kartu', 'Show on card') : T('Sembunyikan dari kartu', 'Hide from card'));
      }
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var r = pget(BC.data(), row.dataset.hide);
        if (!r) return;
        if (r.hidden) delete r.hidden; else r.hidden = true;
        row.classList.toggle('ed-off', !!r.hidden);
        paintEye();
        saveDraft();
      });
      paintEye();
      row.appendChild(b);
    });
  }

  /* ================= penjaga interaksi saat menyunting ================= */
  document.addEventListener('click', function (e) {
    if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
    if (!editing) return;
    // tautan kontak dan tombol WhatsApp jangan aktif sambil menyunting
    if (e.target.closest('a')) e.preventDefault();
    var blocked = e.target.closest('#wa, [data-share]');
    if (blocked) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ================= mulai ================= */
  BC.onRender.push(paint);

  (function boot() {
    var raw = ls(K_TOK);
    if (raw) {
      try {
        var t = JSON.parse(raw);
        if (t && t.token && t.exp > Date.now() + 30000) { token = t.token; unlocked = true; }
        else lsSet(K_TOK, null);
      } catch (e) { lsSet(K_TOK, null); }
    }
    paint();
  })();
})();
