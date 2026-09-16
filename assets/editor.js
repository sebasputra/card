/* Increasink Bio Card, layer editor.
   Diam sepenuhnya sampai ada yang mengetuk pojok kanan atas tiga kali dan
   memasukkan password. Password dan token GitHub tidak ada di file ini,
   keduanya hidup sebagai env var di server. Yang disimpan di browser hanya
   tiket sesi berumur 12 jam yang diterbitkan /api/login. */
(function () {
  'use strict';

  var BC = window.BioCard;
  if (!BC) return;

  var CARD = (BC.data().id || 'card').replace(/[^a-z0-9-]/g, '');
  var API = window.BIOCARD_API || '/api';
  var K_TOK = 'bc.tok.' + CARD;
  var K_DRAFT = 'bc.draft.' + CARD;

  var PUBLISHED = clone(BC.data());   // isi apa adanya dari data.js
  var token = null;
  var unlocked = false;
  var editing = false;
  var dirty = false;
  var busy = false;
  var suppressUntil = 0;

  var CHILD = { text: '.chip', ml: 'li', fact: '.fact', fixed: 'button', block: '.blk', pin: '.pin' };

  var EYE_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l16 16M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6.4 0 10.2 6.5 10.2 6.5a18 18 0 0 1-3.5 4.2M6.5 7.8A17.6 17.6 0 0 0 1.8 12S5.6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/></svg>';

  /* ================= util ================= */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function T(id, en) { return BC.lang() === 'id' ? id : en; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function app() { return document.getElementById('app'); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* mode privat */ }
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

  /* Menukar isi objek D di tempat, karena app.js memegang referensinya. */
  function replaceData(src) {
    var d = BC.data();
    Object.keys(d).forEach(function (k) { delete d[k]; });
    Object.keys(src).forEach(function (k) { d[k] = src[k]; });
  }

  function ensureOrder() {
    var d = BC.data();
    if (!d.order || typeof d.order !== 'object') d.order = {};
    var o = d.order;
    if (!Array.isArray(o.steps)) {
      o.steps = BC.steps().filter(function (s) { return s.key !== 'cover'; })
        .map(function (s) { return s.key; });
    }
    if (!Array.isArray(o.pillars)) o.pillars = BC.pillars().slice();
    if (!Array.isArray(o.hidden)) o.hidden = [];
    return o;
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
    closeSheet();
    var s = document.createElement('div');
    s.className = 'ed-sheet';
    s.innerHTML = '<div class="ed-box">' + html + '</div>';
    s.addEventListener('pointerdown', function (e) { if (e.target === s) closeSheet(); });
    app().appendChild(s);
    if (onMount) onMount(s);
    return s;
  }
  function closeSheet() {
    var s = app() && app().querySelector('.ed-sheet');
    if (s) s.remove();
  }

  function toast(msg, kind) {
    var old = app().querySelector('.ed-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'ed-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    app().appendChild(t);
    if (kind !== 'wait') setTimeout(function () { if (t.parentNode) t.remove(); }, 4200);
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
    dirty = !same(BC.data(), PUBLISHED);
    lsSet(K_DRAFT, dirty ? JSON.stringify(BC.data()) : null);
    var b = app().querySelector('.ed-btn.primary[data-a="pub"]');
    if (b) b.classList.toggle('dot', dirty);
  }

  function offerDraft() {
    var raw = ls(K_DRAFT);
    if (!raw) return;
    var draft;
    try { draft = JSON.parse(raw); } catch (e) { lsSet(K_DRAFT, null); return; }
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
    BC.rebuild();          // buildSteps ikut berubah, section tersembunyi muncul saat menyunting
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

  /* ================= strip bawah ================= */
  function buildBar() {
    var steps = BC.steps(), i = BC.at(), cur = steps[i] || {};
    var name = cur.key === 'cover' ? T('Cover', 'Cover')
      : T((cur.label || [])[0] || cur.key, (cur.label || [])[1] || cur.key);
    var bar = document.createElement('div');
    bar.className = 'ed-bar';
    bar.innerHTML =
      (cur.key !== 'cover'
        ? '<button class="ed-fab" data-a="add" aria-label="' + T('Tambah blok', 'Add block') + '">+</button>' : '') +
      '<div class="ed-nav">' +
      '<button class="ed-ico" data-a="prev"' + (i <= 0 ? ' disabled' : '') + ' aria-label="' + T('Sebelumnya', 'Previous') + '">&lsaquo;</button>' +
      '<span class="ed-cur">' + esc(name) + (cur.off ? ' · ' + T('disembunyikan', 'hidden') : '') + '</span>' +
      '<button class="ed-ico" data-a="next"' + (i >= steps.length - 1 ? ' disabled' : '') + ' aria-label="' + T('Berikutnya', 'Next') + '">&rsaquo;</button>' +
      '</div>' +
      '<div class="ed-acts">' +
      '<button class="ed-btn" data-a="order">' + T('Urutan', 'Arrange') + '</button>' +
      '<button class="ed-btn" data-a="done">' + T('Selesai', 'Done') + '</button>' +
      '<button class="ed-btn primary' + (dirty ? ' dot' : '') + '" data-a="pub">' + T('Publish', 'Publish') + '</button>' +
      '</div>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var a = b.dataset.a;
      if (a === 'prev') BC.go(BC.at() - 1);
      else if (a === 'next') BC.go(BC.at() + 1);
      else if (a === 'order') openOrder();
      else if (a === 'done') askDone();
      else if (a === 'pub') publish();
      else if (a === 'add') toggleMenu(bar);
      else if (a.indexOf('add-') === 0) { closeMenu(); addBlock(a.slice(4)); }
    });
    return bar;
  }

  /* ================= lembar urutan section ================= */
  function openOrder() {
    var o = ensureOrder();
    var keys = o.steps.slice();
    BC.stepAll.forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });

    var tiles = keys.map(function (k) {
      var d = BC.stepDef[k];
      if (!d) return '';
      var off = o.hidden.indexOf(k) >= 0;
      return '<div class="ed-tile' + (off ? ' off' : '') + '" data-k="' + esc(k) + '">' +
        '<span class="ed-grip"></span>' +
        '<span class="ed-tile-t">' + esc(T(d.label[0], d.label[1])) + '</span>' +
        '<button class="ed-eye" aria-label="' + T('Tampilkan atau sembunyikan', 'Show or hide') + '">' +
        (off ? EYE_OFF : EYE_ON) + '</button></div>';
    }).join('');

    var hasSlides = Array.isArray(BC.data().intro_slides);

    sheet(
      '<div class="ed-h">' + T('Atur Urutan', 'Arrange') + '</div>' +
      '<p class="ed-sub">' + T('Tekan agak lama lalu geser untuk memindahkan. Ikon mata menyembunyikan section dari pengunjung.',
        'Press and hold, then drag to move. The eye hides a section from visitors.') + '</p>' +
      '<div class="ed-tiles ed-live" id="edtiles">' + tiles + '</div>' +
      (hasSlides
        ? '<div class="ed-col"><button class="ed-btn" data-a="slides">' +
          T('Slide di Kenalan', 'Slides in Intro') + ' &rsaquo;</button></div>' : '') +
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
        var sl = s.querySelector('[data-a="slides"]');
        if (sl) sl.addEventListener('click', function () { closeSheet(); openSlides(); });
        s.querySelector('[data-a="setdef"]').addEventListener('click', function () { closeSheet(); askSetDefault(); });
        s.querySelector('[data-a="getdef"]').addEventListener('click', function () { closeSheet(); askGetDefault(); });
        s.querySelector('[data-a="revert"]').addEventListener('click', function () {
          if (!dirty) { toast(T('Belum ada perubahan.', 'Nothing has changed yet.')); return; }
          closeSheet();
          revert();
        });
        box.addEventListener('click', function (e) {
          var eye = e.target.closest('.ed-eye');
          if (!eye || Date.now() < suppressUntil) return;
          var tile = eye.closest('.ed-tile'), k = tile.dataset.k;
          var at = o.hidden.indexOf(k);
          if (at >= 0) o.hidden.splice(at, 1); else o.hidden.push(k);
          tile.classList.toggle('off', at < 0);
          eye.innerHTML = at < 0 ? EYE_OFF : EYE_ON;
          saveDraft();
        });
        sortable(box, '.ed-tile', function () {
          o.steps = Array.prototype.map.call(box.querySelectorAll('.ed-tile'), function (t) { return t.dataset.k; });
          saveDraft();
        });
      }
    );
  }

  /* ================= lembar slide Kenalan =================
     Urutan dan hapus saja. Menambah slide hanya untuk gambar, karena /api/upload
     memang cuma menerima gambar. Video baru tetap lewat repo. */
  function slideTile(sl, i) {
    var thumb = sl.type === 'video' ? sl.poster : sl.src;
    var name = (sl.type === 'video' ? T('Video', 'Video') : T('Gambar', 'Image')) + ' ' + (i + 1);
    var file = String(sl.src || '').split('/').pop();
    return '<div class="ed-tile" data-i="' + i + '">' +
      '<span class="ed-grip"></span>' +
      '<span class="ed-thumb"' + (thumb ? ' style="background-image:url(' + esc(thumb) + ')"' : '') + '></span>' +
      '<span class="ed-tile-t">' + esc(name) + '<em>' + esc(file) + '</em></span>' +
      '<button class="ed-eye ed-del" aria-label="' + T('Hapus slide', 'Remove slide') + '">&times;</button></div>';
  }

  function openSlides() {
    var arr = BC.data().intro_slides;
    if (!Array.isArray(arr)) return;
    var EMPTY = '<p class="ed-sub" style="margin:0">' + T('Belum ada slide.', 'No slides yet.') + '</p>';

    sheet(
      '<div class="ed-h">' + T('Slide di Kenalan', 'Slides in Intro') + '</div>' +
      '<p class="ed-sub">' + T('Tekan agak lama lalu geser untuk memindahkan. Tombol silang menghapus slide.',
        'Press and hold, then drag to move. The cross removes a slide.') + '</p>' +
      '<div class="ed-tiles ed-live" id="edslides">' + (arr.length ? arr.map(slideTile).join('') : EMPTY) + '</div>' +
      '<div class="ed-col"><button class="ed-btn" data-a="addimg">+ ' +
      T('Tambah gambar', 'Add image') + '</button></div>' +
      '<div class="ed-row">' +
      '<button class="ed-btn" data-a="back">' + T('Kembali', 'Back') + '</button>' +
      '<button class="ed-btn primary" data-a="ok">' + T('Selesai', 'Done') + '</button></div>',
      function (s) {
        var box = s.querySelector('#edslides');
        function reindex() {
          Array.prototype.forEach.call(box.querySelectorAll('.ed-tile'), function (t, i) { t.dataset.i = i; });
        }
        s.querySelector('[data-a="ok"]').addEventListener('click', function () { closeSheet(); BC.rebuild(); });
        s.querySelector('[data-a="back"]').addEventListener('click', function () { closeSheet(); openOrder(); });
        s.querySelector('[data-a="addimg"]').addEventListener('click', function () {
          closeSheet();
          chooseImage(function (url) {
            BC.data().intro_slides.push({ type: 'image', src: url });
          }, function () { openSlides(); });
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
    Array.prototype.forEach.call(c.querySelectorAll('.ed-x'), function (x) { x.remove(); });
    var v = nd.dataset.rich ? c.innerHTML : (c.textContent || '');
    v = v.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
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
        // semua field di kartu ini pendek, Enter berarti selesai
        if (e.key === 'Enter') { e.preventDefault(); nd.blur(); }
      });
      // tempel sebagai teks polos, jangan bawa gaya dari sumbernya
      nd.addEventListener('paste', function (e) {
        e.preventDefault();
        var txt = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, String(txt).replace(/\s+/g, ' '));
      });
      nd.addEventListener('blur', function () {
        var path = nd.dataset.e;
        var next = readVal(nd);
        var now = pget(BC.data(), path);
        if (String(now == null ? '' : now) === next) return;
        pset(BC.data(), path, next);
        saveDraft();
      });
    });
  }

  function blankItem(kind, arr) {
    if (kind === 'text') return T('Baru', 'New');
    if (kind === 'ml') return { id: 'Item baru', en: 'New item' };
    if (kind === 'fact') {
      var n = String(arr.length + 1);
      return { n: n.length < 2 ? '0' + n : n, id: 'Fakta baru', en: 'New fact' };
    }
    return null;
  }

  function wireArrays(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-arr]'), function (box) {
      var path = box.dataset.arr;
      var kind = box.dataset.kind || 'fixed';
      var sel = CHILD[kind] || '*';
      var arr = pget(BC.data(), path);
      if (!Array.isArray(arr)) return;

      Array.prototype.forEach.call(box.querySelectorAll(sel), function (child, i) {
        child.style.setProperty('--i', i);
        if (kind === 'fixed') return;
        if (kind === 'block') {
          var g = document.createElement('span');
          g.className = 'ed-grip-h';
          g.setAttribute('contenteditable', 'false');
          g.setAttribute('aria-hidden', 'true');
          child.appendChild(g);
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

      // blok ditambah lewat tombol + melayang, bukan tombol Tambah di tempat
      if (kind !== 'fixed' && kind !== 'block') {
        var add = document.createElement('button');
        add.className = 'ed-add';
        add.textContent = '+ ' + T('Tambah', 'Add');
        add.addEventListener('click', function () {
          // pin selalu berupa gambar, jadi langsung minta berkasnya, bukan item kosong
          if (kind === 'pin') {
            chooseImage(function (url) { pget(BC.data(), path).push({ src: url, alt: '' }); });
            return;
          }
          pget(BC.data(), path).push(blankItem(kind, arr));
          saveDraft();
          BC.render();
        });
        box.appendChild(add);
      }

      sortable(box, sel, function () {
        var order = Array.prototype.map.call(box.querySelectorAll(sel), function (c) {
          return +c.dataset.idx;
        });
        var src = pget(BC.data(), path);
        pset(BC.data(), path, order.map(function (i) { return src[i]; }));
        saveDraft();
        BC.render();
      }, kind === 'block' ? '.ed-grip-h' : null);

      Array.prototype.forEach.call(box.querySelectorAll(sel), function (c, i) { c.dataset.idx = i; });
    });

    // urutan pilar GAINS
    var pn = root.querySelector('[data-ord="pillars"]');
    if (pn) {
      var o = ensureOrder();
      Array.prototype.forEach.call(pn.querySelectorAll('.acc-i'), function (b, i) {
        b.dataset.idx = i;
        b.style.setProperty('--i', i);
      });
      sortable(pn, '.acc-i', function () {
        var cur = BC.pillars();
        o.pillars = Array.prototype.map.call(pn.querySelectorAll('.acc-i'), function (b) {
          return cur[+b.dataset.idx];
        });
        saveDraft();
        BC.rebuild();
      }, '.acc-l');
    }
  }

  /* ================= tombol + dan blok tambahan ================= */
  var ADD_ICON = {
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 6h14M5 11h14M5 16h9"/></svg>',
    row: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 12h18M9 5v14"/></svg>'
  };

  function closeMenu() {
    var a = app();
    if (!a) return;
    var m = a.querySelector('.ed-menu');
    if (m) m.remove();
    var f = a.querySelector('.ed-fab');
    if (f) f.classList.remove('on');
  }

  function toggleMenu(bar) {
    if (bar.querySelector('.ed-menu')) { closeMenu(); return; }
    var m = document.createElement('div');
    m.className = 'ed-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = [['image', T('Gambar', 'Image')], ['text', T('Teks', 'Text')], ['row', T('Kolom info', 'Info row')]]
      .map(function (x) {
        return '<button role="menuitem" data-a="add-' + x[0] + '">' + ADD_ICON[x[0]] + '<span>' + x[1] + '</span></button>';
      }).join('');
    bar.appendChild(m);
    bar.querySelector('.ed-fab').classList.add('on');
  }

  // ketukan di luar menu menutupnya
  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest || e.target.closest('.ed-menu, .ed-fab')) return;
    closeMenu();
  }, true);

  function blockList(key) {
    var d = BC.data();
    if (!d.blocks || typeof d.blocks !== 'object' || Array.isArray(d.blocks)) d.blocks = {};
    if (!Array.isArray(d.blocks[key])) d.blocks[key] = [];
    return d.blocks[key];
  }

  function addBlock(kind) {
    var key = (BC.steps()[BC.at()] || {}).key;
    if (!key || key === 'cover') return;
    if (kind === 'image') {
      chooseImage(function (url) {
        blockList(key).push({ type: 'image', src: url, caption_id: '', caption_en: '' });
      }, function () { reveal(key, blockList(key).length - 1, false); });
      return;
    }
    blockList(key).push(kind === 'row'
      ? { type: 'row', label_id: '', label_en: '', value_id: '', value_en: '' }
      : { type: 'text', body_id: '', body_en: '' });
    saveDraft();
    BC.render();
    reveal(key, blockList(key).length - 1, true);
  }

  /* Gulir ke blok baru. Fokus dipanggil langsung, masih di dalam gestur ketuk,
     karena Safari iOS tidak memunculkan keyboard dari setTimeout. */
  function reveal(key, i, focus) {
    var box = app().querySelector('.blocks[data-arr="blocks.' + key + '"]');
    var b = box && box.querySelectorAll('.blk')[i];
    if (!b) return;
    var f = focus && b.querySelector('[data-e]');
    if (f) f.focus({ preventScroll: true });
    b.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

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

  /* ================= gambar ulang lapisan editor ================= */
  function paint() {
    var a = app();
    if (!a) return;
    a.classList.toggle('editing', editing && unlocked);
    var old = a.querySelector('.ed-bar');
    if (old) old.remove();
    if (!unlocked || !editing) return;
    wireText(a);
    wireArrays(a);
    wireMedia(a);
    a.appendChild(buildBar());
  }

  /* ================= penjaga interaksi saat menyunting ================= */
  document.addEventListener('click', function (e) {
    if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
    if (!editing) return;
    // tautan kontak dan tombol WhatsApp jangan aktif sambil menyunting
    if (e.target.closest('a')) e.preventDefault();
    var blocked = e.target.closest('#wa, #share');
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
