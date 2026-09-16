import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (f) => readFileSync(ROOT + f, 'utf8');

const dom = new JSDOM(
  `<!doctype html><html><body><div id="app" class="app"></div></body></html>`,
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/stephen-bni/' }
);
const w = dom.window;
w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
w.HTMLMediaElement.prototype.pause = function () {};
w.HTMLMediaElement.prototype.load = function () {};
// jsdom tidak punya scrollTo pada elemen; di browser ini ada
w.Element.prototype.scrollTo = function () {};
// jsdom tidak punya IntersectionObserver; stub ini dipakai supaya jalur malas ikut diuji
const observers = [];
w.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; observers.push(this); }
  observe(el) { this.el = el; }
  disconnect() { this.el = null; }
  trigger() { this.cb([{ isIntersecting: true, target: this.el }]); }
};
w.eval(read('stephen-bni/data.js'));
w.eval(read('assets/app.js'));

const BC = w.BioCard;
const steps = BC.steps().map((s) => s.key);
const fail = [];
const ok = [];

function check(name, cond, extra) {
  (cond ? ok : fail).push(name + (extra ? ' -> ' + extra : ''));
}

// ---- step Kenalan: lazy loading carousel
BC.go(steps.indexOf('intro'));
// slide 2 (indeks 2) adalah gambar, jadi indeks video tidak sama dengan indeks slide
const slideEls = [...w.document.querySelectorAll('.car-slide')];
const vids = slideEls.map((s) => s.querySelector('video'));
check('5 slide dirender', w.document.querySelectorAll('.car-slide').length === 5,
  String(w.document.querySelectorAll('.car-slide').length));
check('slide 1 = gold-v2.mp4', vids[0].getAttribute('src') === 'img/gold-v2.mp4', vids[0].getAttribute('src'));
check('slide 1 preload auto', vids[0].getAttribute('preload') === 'auto');
check('semua video punya data-src cadangan', vids.filter(Boolean).every((v) => v.dataset.src));
check('slide 3 memang gambar, bukan video', !vids[2] && !!slideEls[2].querySelector('img'));

// ---- bahasa default sekarang Inggris, dan EN duduk sebelum ID
check('bahasa default Inggris', BC.lang() === 'en', BC.lang());
const langs = [...w.document.querySelectorAll('.langs button')].map((b) => b.id);
check('EN sebelum ID di topnav', langs.join(',') === 'len,lid', langs.join(','));
check('EN yang aktif', w.document.getElementById('len').className === 'on');
// carousel() dipanggil saat render, harus sudah memasang src slide 1 dan mengintip slide 2
check('slide 2 di-arm setelah render', vids[1].getAttribute('src') === 'img/intro-v2.mp4',
  vids[1].getAttribute('src'));
check('slide 2 preload metadata', vids[1].getAttribute('preload') === 'metadata',
  vids[1].getAttribute('preload'));
check('slide 4 dan 5 masih belum di-arm',
  !vids[3].getAttribute('src') && !vids[4].getAttribute('src'),
  (vids[3].getAttribute('src') || 'kosong') + ' / ' + (vids[4].getAttribute('src') || 'kosong'));

// slide 1 selesai -> maju ke slide 2. Slide 3 gambar, jadi tidak ada yang di-arm.
vids[0].dispatchEvent(new w.Event('ended'));
check('setelah maju ke slide 2, slide 4 masih diam', !vids[3].getAttribute('src'),
  vids[3].getAttribute('src') || 'kosong');
// slide 2 selesai -> maju ke slide 3 (gambar), yang diintip slide 4
vids[1].dispatchEvent(new w.Event('ended'));
check('sampai slide 3, slide 4 baru di-arm', vids[3].getAttribute('src') === 'img/slide3.mp4',
  vids[3].getAttribute('src') || 'kosong');
check('slide 5 tetap belum di-arm sampai gilirannya', !vids[4].getAttribute('src'),
  vids[4].getAttribute('src') || 'kosong');

// ---- tombol maju mundur, penolong untuk pengguna browser yang tidak bisa menggeser
const cnav = w.document.querySelectorAll('.carousel .car-nav');
check('carousel punya tombol maju dan mundur', cnav.length === 2,
  [...cnav].map((b) => b.className).join(' | '));
const dotOn = () => [...w.document.querySelectorAll('.car-dots i')].findIndex((d) => d.classList.contains('on'));
const klik = (sel) => w.document.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const mulai = dotOn();
klik('.car-nav.prev');
check('tombol mundur memundurkan satu slide', dotOn() === (mulai - 1 + 5) % 5,
  `dari ${mulai} ke ${dotOn()}`);
klik('.car-nav.next');
check('tombol maju mengembalikannya', dotOn() === mulai, `kembali ke ${dotOn()}`);
// dari slide pertama, mundur harus melingkar ke slide terakhir, bukan mentok
while (dotOn() !== 0) klik('.car-nav.prev');
klik('.car-nav.prev');
check('mundur dari slide pertama melingkar ke slide terakhir', dotOn() === 4, String(dotOn()));

// suara hanya dari dua slide pertama: slide 4 (video bersuara) tetap senyap walau suara dinyalakan
const cv = [...w.document.querySelectorAll('.car-slide video')];
check('hanya video ke-3 dan ke-4 ditandai senyap',
  cv.map((v) => v.dataset.mute === '1').join(',') === 'false,false,true,true',
  cv.map((v) => v.dataset.mute || '-').join(','));
klik('#vsound');
check('slide terakhir tetap muted setelah suara dinyalakan', cv[3].muted === true);
check('tombol suara disembunyikan di slide senyap', w.document.querySelector('#vsound').hidden === true);
while (dotOn() !== 0) klik('.car-nav.next');
check('slide pertama bersuara', cv[0].muted === false);
klik('#vsound');

// ---- cover: foto hi-res + deret pin
BC.go(0);
const ringImg = w.document.querySelector('.ring-img');
check('cover pakai foto hi-res', ringImg.getAttribute('src') === 'img/stephen-hd.jpg',
  ringImg.getAttribute('src'));
const coverPins = [...w.document.querySelectorAll('.cover .pins .pin img')];
check('4 pin di cover', coverPins.length === 4, String(coverPins.length));
check('urutan pin benar',
  coverPins.map((i) => i.getAttribute('src').split('/').pop()).join(',') ===
  'pin-leadership.png,pin-connector.png,pin-gold.png,pin-green.png',
  coverPins.map((i) => i.getAttribute('src').split('/').pop()).join(','));
check('pin titanium sudah tidak dipakai',
  !coverPins.some((i) => i.getAttribute('src').includes('titanium')));
check('pin tepat di bawah foto',
  w.document.querySelector('.ring').nextElementSibling.className === 'pins',
  w.document.querySelector('.ring').nextElementSibling.className);
check('pin punya alt', coverPins.every((i) => i.getAttribute('alt')),
  coverPins.map((i) => i.getAttribute('alt')).join(' | '));

// ---- step BNI: deret pin yang sama
BC.go(steps.indexOf('bni'));
check('pin ikut tampil di step BNI', w.document.querySelectorAll('.pins .pin').length === 4,
  String(w.document.querySelectorAll('.pins .pin').length));

// ---- QR BNI Connect, di bawah deskripsi usaha
const qb = w.document.querySelector('.qrbox');
check('kotak QR ada di step BNI', !!qb);
if (qb) {
  const qi = qb.querySelector('.qrimg');
  check('gambar QR terpasang', qi && qi.getAttribute('src') === 'img/bni-qr.png', qi && qi.getAttribute('src'));
  check('QR bisa diketuk, bukan cuma gambar',
    qb.querySelector('a.qrtap') && qb.querySelector('a.qrtap').getAttribute('href').includes('bnijakartautara.com'),
    qb.querySelector('a.qrtap') && qb.querySelector('a.qrtap').getAttribute('href'));
  check('tautan dibuka di tab baru dengan rel aman',
    qb.querySelector('a.qrtap').getAttribute('target') === '_blank' &&
    qb.querySelector('a.qrtap').getAttribute('rel') === 'noopener');
  check('berlabel BNI Connect', qb.querySelector('.qrlab').textContent.trim() === 'BNI Connect',
    qb.querySelector('.qrlab').textContent.trim());
  // harus sesudah deskripsi usaha, bukan di atasnya
  const par = [...w.document.querySelectorAll('.step > *')].map((n) => n.className);
  check('QR diletakkan sesudah deskripsi usaha',
    par.indexOf('qrbox') > par.findIndex((c) => c === 'p'), par.join(' > '));
  check('gambar QR dimuat malas', qi.getAttribute('loading') === 'lazy');
}

// ---- step Connect: tombol showreel
BC.go(steps.indexOf('connect'));
const reel = w.document.getElementById('reel');
check('tombol showreel ada', !!reel);
if (reel) {
  const rbg = reel.querySelector('.reel-bg');
  check('tombol memuat video sungguhan, bukan gambar', !!rbg && rbg.tagName === 'VIDEO');
  // videonya keping di kanan, jadi harus jadi anak terakhir, bukan latar di belakang teks
  check('video duduk sesudah teks, bukan di belakangnya',
    reel.lastElementChild === rbg, reel.lastElementChild.className);
  check('video tombol pakai klip pendek, bukan film penuh',
    rbg.getAttribute('src') === 'img/ourworks-loop.mp4', rbg.getAttribute('src'));
  check('video tombol muted dan looping',
    rbg.hasAttribute('muted') && rbg.hasAttribute('loop') && rbg.hasAttribute('playsinline'));
  check('video tombol disembunyikan dari pembaca layar',
    rbg.getAttribute('aria-hidden') === 'true' && rbg.getAttribute('tabindex') === '-1');
  // video tombol baru dimuat saat tombolnya mendekat layar
  const rbo = observers.find((o) => o.el === rbg);
  check('video tombol diawasi IntersectionObserver', !!rbo);
  if (rbo) rbo.trigger();
  // dibatasi 15 detik supaya pengunjung yang loncat langsung ke Contact tidak menarik film penuh
  rbg.currentTime = 16;
  rbg.dispatchEvent(new w.Event('timeupdate'));
  check('video tombol berputar ulang di detik 15', rbg.currentTime === 0, String(rbg.currentTime));
  rbg.currentTime = 9;
  rbg.dispatchEvent(new w.Event('timeupdate'));
  check('sebelum 15 detik dibiarkan jalan', rbg.currentTime === 9, String(rbg.currentTime));
  check('label Our Showreel', reel.textContent.includes('Our Showreel'), reel.textContent.trim());
  check('bisa difokus keyboard', reel.getAttribute('role') === 'button' && reel.getAttribute('tabindex') === '0');
  check('ada di akhir, setelah Bagikan',
    !!reel.previousElementSibling && reel.previousElementSibling.id === 'share',
    reel.previousElementSibling && reel.previousElementSibling.id);

  // buka overlay
  reel.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const m = w.document.getElementById('modal');
  check('overlay terbuka', m.className === 'modal full show', m.className);
  const ocar = m.querySelector('#car');
  check('overlay berisi carousel, bukan satu video', !!ocar && ocar.classList.contains('reelcar'));
  check('overlay = Our Works ditambah 5 slide Kenalan', m.querySelectorAll('.car-slide').length === 6,
    String(m.querySelectorAll('.car-slide').length));
  check('mulai dari Our Works',
    m.querySelector('.car-slide video').getAttribute('src') === 'img/ourworks.mp4',
    m.querySelector('.car-slide video').getAttribute('src'));
  check('slide kedua overlay = Gold',
    m.querySelectorAll('.car-slide video')[1].getAttribute('src') === 'img/gold-v2.mp4',
    m.querySelectorAll('.car-slide video')[1].getAttribute('src'));
  check('titik indikator ikut ada', m.querySelectorAll('.car-dots i').length === 6);
  check('overlay juga punya tombol maju mundur',
    m.querySelectorAll('.reelcar .car-nav').length === 2);
  check('tombol suara ikut ada', !!m.querySelector('#vsound'));
  check('tidak ada lagi .reelv tunggal', !m.querySelector('.reelv'));
  check('video tombol dihentikan selagi overlay terbuka', rbg.paused);

  // tutup lewat tombol silang
  m.querySelector('#reelx').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('overlay tertutup bersih', w.document.getElementById('modal').className === 'modal' &&
    !w.document.getElementById('modal').innerHTML, w.document.getElementById('modal').className);
}

// ---- panah tombol Lanjut dibungkus supaya bisa dianimasikan
BC.go(steps.indexOf('bni'));
const nx = w.document.getElementById('next');
check('tombol Lanjut ada', !!nx);
if (nx) check('panahnya dibungkus .ar2', !!nx.querySelector('span .ar2'), nx.innerHTML.slice(-60));

// ---- embed Instagram di step Kenalan, di bawah carousel
BC.go(steps.indexOf('intro'));
const igf = w.document.querySelector('.igframe');
check('embed Instagram ada di step Kenalan', !!igf);
check('poster dan gambar slide sudah webp',
  [...w.document.querySelectorAll('.car-slide video, .car-slide img')]
    .every((n) => !/\.jpg$/.test(n.getAttribute('poster') || n.getAttribute('src') || '')),
  [...w.document.querySelectorAll('.car-slide video, .car-slide img')]
    .map((n) => (n.getAttribute('poster') || n.getAttribute('src'))).join(', '));
if (igf) {
  check('belum punya src sebelum mendekat layar',
    !igf.getAttribute('src') && igf.dataset.src === 'https://www.instagram.com/stephenseptian/embed/',
    (igf.getAttribute('src') || 'kosong') + ' | ' + igf.dataset.src);
  check('tetap diberi loading=lazy sebagai lapis kedua', igf.getAttribute('loading') === 'lazy');
  const igo = observers.find((o) => o.el === igf);
  check('diawasi IntersectionObserver', !!igo);
  if (igo) {
    igo.trigger();
    check('src baru dipasang saat mendekat layar',
      igf.getAttribute('src') === 'https://www.instagram.com/stephenseptian/embed/',
      igf.getAttribute('src'));
  }
  check('di bawah carousel, bukan di dalamnya',
    !igf.closest('.carousel') && !!w.document.querySelector('.step > .igbox'));
  // tinggi diatur dari pesan MEASURE milik Instagram, bukan angka tebakan
  w.dispatchEvent(new w.MessageEvent('message', {
    origin: 'https://www.instagram.com',
    data: { type: 'MEASURE', details: { height: 437 } }
  }));
  check('tinggi iframe ikut pesan MEASURE', igf.style.height === '437px', igf.style.height);
  w.dispatchEvent(new w.MessageEvent('message', {
    origin: 'https://jahat.example', data: { type: 'MEASURE', details: { height: 9 } }
  }));
  check('pesan dari origin lain diabaikan', igf.style.height === '437px', igf.style.height);
  check('ada tautan buka profil',
    w.document.querySelector('.igbox-a').getAttribute('href') === 'https://instagram.com/stephenseptian',
    w.document.querySelector('.igbox-a').getAttribute('href'));
}

// ---- logo Increasink di kaki Let's Connect
BC.go(steps.indexOf('connect'));      // pemeriksaan Instagram di atas pindah ke step Kenalan
const flogo = w.document.querySelector('.foot-logo');
check('logo Increasink ada di Let\'s Connect', !!flogo);
if (flogo) {
  check('logo memakai berkas yang sudah dipakai modal WA',
    flogo.getAttribute('src') === 'img/increasink.png', flogo.getAttribute('src'));
  check('logo sesudah tombol showreel',
    flogo.previousElementSibling && flogo.previousElementSibling.id === 'reel',
    flogo.previousElementSibling && flogo.previousElementSibling.id);
}

// ---- layar lebar: permukaan penuh, isi tetap selebar kolom
const css2 = read('assets/app.css');
check('ada blok layar lebar yang melepas max-width',
  /@media\(min-width:560px\)\{\s*body\{display:block\}/.test(css2.replace(/\n\s*/g, '')));
check('crop avatar lewat variabel', css2.includes('--ava-scale:1.25') &&
  css2.includes('transform:scale(var(--ava-scale))'));
check('ring dan avatar WA pakai variabel yang sama',
  (css2.match(/transform:scale\(var\(--ava-scale\)\)/g) || []).length === 2);

// ---- bug GAINS: teks setelah <b> tidak boleh jadi grid item
const css = read('assets/app.css');
const liRule = css.split('\n').find((l) => l.startsWith('.list li{'));
check('.list li bukan grid lagi', !liRule.includes('display:grid'), liRule);
check('bullet diposisikan absolut',
  css.includes('.list li::before{content:"";position:absolute'));

console.log('LULUS (' + ok.length + ')');
ok.forEach((x) => console.log('  + ' + x));
if (fail.length) {
  console.log('\nGAGAL (' + fail.length + ')');
  fail.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
