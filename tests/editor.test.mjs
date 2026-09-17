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
w.Element.prototype.scrollTo = function () {};

// ---- server palsu, mencatat setiap panggilan
const calls = [];
let baseline = null;
w.fetch = function (url, opt) {
  const body = opt && opt.body ? JSON.parse(opt.body) : null;
  calls.push({ url: String(url), body });
  const json = (o, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(o) });
  if (String(url).includes('/login')) return json({ token: 'tok-palsu', exp: Date.now() + 6e5 });
  if (String(url).includes('/publish')) {
    if (body.slot === 'default') baseline = body.data;
    return json({ ok: true, commit: 'abc123' });
  }
  if (String(url).includes('default.json')) {
    return baseline ? json(baseline) : json({ error: 'not found' }, false);
  }
  return json({}, false);
};

w.eval(read('stephen-bni/data.js'));
w.eval(read('assets/app.js'));
w.eval(read('assets/editor.js'));

const doc = w.document;
const $ = (s) => doc.querySelector(s);
const click = (n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fail = [], ok = [];
const check = (name, cond, extra) => (cond ? ok : fail).push(name + (extra ? ' -> ' + extra : ''));

// ---- buka gerbang tersembunyi: tiga ketukan di pojok kanan atas
for (let i = 0; i < 3; i++) {
  doc.body.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 1000, clientY: 20 }));
}
check('lembar login muncul', !!$('#edpw'));

$('#edpw').value = 'apa saja';
click($('.ed-sheet [data-a="go"]'));
await sleep(30);
check('masuk mode sunting', doc.getElementById('app').classList.contains('editing'));
check('strip editor tampil', !!$('.ed-bar [data-a="order"]'));

// ---- lembar Atur
click($('.ed-bar [data-a="order"]'));
check('lembar Atur terbuka', !!$('#edtiles'));
check('ada pintu ke slide', !!$('.ed-sheet [data-a="slides"]'));
check('ada Jadikan patokan', !!$('.ed-sheet [data-a="setdef"]'));
check('ada Kembalikan ke patokan', !!$('.ed-sheet [data-a="getdef"]'));
check('ada Hapus semua perubahan', !!$('.ed-sheet [data-a="revert"]'));

// ---- lembar slide
click($('.ed-sheet [data-a="slides"]'));
check('lembar slide terbuka', !!$('#edslides'));
let tiles = [...doc.querySelectorAll('#edslides .ed-tile')];
check('5 kartu slide', tiles.length === 5, String(tiles.length));
check('kartu menyebut nama berkas', tiles[0].textContent.includes('gold-v2.mp4'), tiles[0].textContent.trim());
check('kartu gambar dilabeli Image', tiles[2].textContent.includes('Image'), tiles[2].textContent.trim());

// hapus slide ke-2 (intro.mp4)
click(tiles[1].querySelector('.ed-del'));
const after = w.DATA.intro_slides.map((s) => s.src);
check('slide terhapus dari data', after.length === 4 && !after.includes('img/intro.mp4'), after.join(', '));
check('kartu ikut hilang dari lembar', doc.querySelectorAll('#edslides .ed-tile').length === 4);
check('sisa kartu diberi nomor ulang',
  [...doc.querySelectorAll('#edslides .ed-tile')].every((t, i) => +t.dataset.i === i));
check('draft tersimpan', !!w.localStorage.getItem('bc.draft.stephen-bni'));

// lembar tidak boleh hancur sendiri (BC.render menulis ulang #app)
check('lembar slide masih hidup setelah hapus', !!$('#edslides'));

// ---- Selesai: kartu ikut berubah
click($('.ed-sheet [data-a="ok"]'));
check('lembar tertutup', !$('.ed-sheet'));

// ---- slide My Ministry: daftar dibuat saat pertama dibuka, ada tombol tambah video
click($('.ed-bar [data-a="order"]'));
check('ada pintu ke slide My Ministry', !!$('.ed-sheet [data-a="minslides"]'));
click($('.ed-sheet [data-a="minslides"]'));
check('lembar slide ministry terbuka', !!$('#edslides') && $('.ed-sheet .ed-h').textContent.includes('Ministry'),
  $('.ed-sheet .ed-h') && $('.ed-sheet .ed-h').textContent);
check('lembar ministry berisi 2 foto', doc.querySelectorAll('#edslides .ed-tile').length === 2);
check('ada tombol tambah video', !!$('.ed-sheet [data-a="addvid"]'));
check('slide Kenalan tidak tercampur', w.DATA.intro_slides.length === 4);
click($('.ed-sheet [data-a="ok"]'));
// carousel ministry punya tombol Atur foto dan video
w.BioCard.go(w.BioCard.steps().map((s) => s.key).indexOf('personal'));
check('carousel ministry tampil saat menyunting', !!$('.mincar'));
const mb = $('.mincar') && $('.mincar').nextElementSibling;
check('tombol Atur foto dan video di bawahnya', !!mb && mb.classList.contains('ed-img-btn'), mb && mb.className);
click(mb);
check('tombol itu membuka lembar ministry', !!$('#edslides') && $('.ed-sheet .ed-h').textContent.includes('Ministry'));
click($('.ed-sheet [data-a="ok"]'));
w.BioCard.go(0);

// ---- Jadikan patokan
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="setdef"]'));
check('konfirmasi patokan muncul', !!$('.ed-sheet [data-a="go"]'));
click($('.ed-sheet [data-a="go"]'));
await sleep(30);
const pub = calls.filter((c) => c.url.includes('/publish'));
check('publish dipanggil dengan slot default', pub.length === 1 && pub[0].body.slot === 'default',
  pub.map((c) => c.body.slot).join(','));
check('patokan berisi 4 slide', baseline && baseline.intro_slides.length === 4,
  baseline && String(baseline.intro_slides.length));

// ---- ubah lagi, lalu kembalikan ke patokan
w.DATA.intro_slides.length = 1;
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="getdef"]'));
await sleep(30);
check('konfirmasi pemulihan muncul', !!$('.ed-sheet [data-a="go"]'));
click($('.ed-sheet [data-a="go"]'));
check('data kembali ke patokan', w.DATA.intro_slides.length === 4,
  String(w.DATA.intro_slides.length));

// ---- tanpa patokan tersimpan, harus bilang belum ada
baseline = null;
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="getdef"]'));
await sleep(30);
check('patokan kosong ditolak dengan pesan',
  !!$('.ed-toast.bad') && $('.ed-toast.bad').textContent.includes('No baseline saved yet'),
  $('.ed-toast') && $('.ed-toast').textContent);

// ---- pin: hapus dan geser lewat mesin array yang sama
w.BioCard.go(0);
const pinBoxes = [...doc.querySelectorAll('.pins .pin')];
check('pin dapat tombol hapus di mode sunting',
  pinBoxes.length === 4 && pinBoxes.every((n) => n.querySelector('.ed-x')),
  String(pinBoxes.length));
check('deret pin dapat tombol tambah', !!doc.querySelector('.pins .ed-add'));
click(pinBoxes[1].querySelector('.ed-x'));
check('pin terhapus dari data', w.DATA.pins.length === 3 &&
  !w.DATA.pins.some((x) => x.src.includes('connector')),
  w.DATA.pins.map((x) => x.src).join(', '));
check('pin ikut hilang dari layar', doc.querySelectorAll('.pins .pin').length === 3,
  String(doc.querySelectorAll('.pins .pin').length));

// ---- toolbar Bold dan Hapus item pada daftar Accomplishment
w.BioCard.go(w.BioCard.steps().map((s) => s.key).indexOf('gains'));
let accLis = [...doc.querySelectorAll('[data-arr="gains.accomplishment.items"] > li')];
check('accomplishment berisi 8 item', accLis.length === 8, String(accLis.length));
accLis[1].dispatchEvent(new w.FocusEvent('focus'));
check('toolbar muncul dengan Bold dan Hapus item',
  !!$('.ed-fmt [data-f="bold"]') && !!$('.ed-fmt [data-f="del"]'));
const n0 = w.DATA.gains.accomplishment.items.length;
$('.ed-fmt [data-f="del"]').dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
check('item kedua terhapus dari data', w.DATA.gains.accomplishment.items.length === n0 - 1 &&
  !w.DATA.gains.accomplishment.items.some((x) => x.en.includes('Titanium Chapter')));
check('toolbar hilang setelah hapus', !$('.ed-fmt'));
w.BioCard.go(w.BioCard.steps().map((s) => s.key).indexOf('connect'));
check('kontak LinkedIn tampil', !!doc.querySelector('.contact a[href="https://www.linkedin.com/in/stephen-septian/"]'));

console.log('LULUS (' + ok.length + ')');
ok.forEach((x) => console.log('  + ' + x));
if (fail.length) {
  console.log('\nGAGAL (' + fail.length + ')');
  fail.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
