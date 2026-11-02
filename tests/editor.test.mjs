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
w.Element.prototype.scrollIntoView = function () {};
// jsdom tidak punya execCommand; dicatat saja supaya toolbar teks bisa diuji
const cmds = [];
w.document.execCommand = (c, ui, v) => { cmds.push(v == null ? c : c + ':' + v); return true; };

// ---- server palsu, mencatat setiap panggilan
const calls = [];
let baseline = null;
w.fetch = function (url, opt) {
  const body = opt && opt.body && typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
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

const BC = w.BioCard;
const D = w.DATA;
const doc = w.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => [...doc.querySelectorAll(s)];
const missing = [];
const click = (n) => {
  if (!n) { missing.push(new Error().stack.split('\n')[2].trim()); return; }
  n.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = (key) => D.pages.find((p) => p.key === key);
const widget = (key, type) => page(key).widgets.find((x) => x.type === type);
const goKey = (key) => BC.go(BC.steps().findIndex((s) => s.key === key));
const sel = () => $('.step[data-wl] > .w.sel');

const fail = [], ok = [];
const check = (name, cond, extra) => (cond ? ok : fail).push(name + (extra ? ' -> ' + extra : ''));

// ---- data lama dikonversi jadi halaman berisi widget
check('data jadi versi 2', D.version === 2 && Array.isArray(D.pages) && D.pages.length === 6, String(D.pages && D.pages.length));
check('urutan halaman sama', D.pages.map((p) => p.key).join() === 'intro,bni,gains,personal,refer,connect');
check('kunci lama dibuang', !D.gains && !D.biosheet && !D.intro_slides && !D.order);
check('cover tetap punya baris chapter', D.hero.meta === 'BNI Magnify, Titanium Chapter, North Region', D.hero.meta);

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
check('draft belum ada, tidak ada yang berubah', !w.localStorage.getItem('bc.draft.stephen-bni'));

// ---- widget dibungkus dan bisa dipilih
goKey('personal');
const wraps = $$('.step[data-wl] > .w');
check('widget Personal dibungkus .w', wraps.length === page('personal').widgets.length, wraps.length + ' vs ' + page('personal').widgets.length);
check('pembungkus diberi label jenis', wraps[0].getAttribute('data-label') === 'Heading', wraps[0].getAttribute('data-label'));
click(wraps[0]);
check('widget terpilih', !!sel() && +sel().dataset.w === 0);
check('strip berganti aksi widget', !!$('.ed-bar [data-a="w-set"]') && !!$('.ed-bar [data-a="w-del"]'));
check('tombol Naik mati di widget pertama', $('.ed-bar [data-a="w-up"]').disabled);
check('pegangan geser muncul', !!sel().querySelector('.ed-wgrip'));

// ---- turun, duplikat, sembunyi, hapus lalu urungkan
const firstId = page('personal').widgets[0].id;
click($('.ed-bar [data-a="w-down"]'));
check('widget turun satu', page('personal').widgets[1].id === firstId);
check('pilihan ikut pindah', +sel().dataset.w === 1);
click($('.ed-bar [data-a="w-up"]'));
check('naik lagi ke posisi awal', page('personal').widgets[0].id === firstId);
const n0 = page('personal').widgets.length;
click($('.ed-bar [data-a="w-dup"]'));
check('duplikat menambah satu widget', page('personal').widgets.length === n0 + 1);
check('duplikat punya id baru', page('personal').widgets[1].id !== firstId && page('personal').widgets[1].type === 'heading');
click($('.ed-bar [data-a="w-hide"]'));
check('widget disembunyikan', page('personal').widgets[1].hidden === true);
check('widget tersembunyi tetap tampil redup saat menyunting', !!$('.step[data-wl] > .w.w-off'));
click($('.ed-bar [data-a="w-del"]'));
check('widget terhapus', page('personal').widgets.length === n0);
check('toast hapus punya Urungkan', !!$('.ed-toast .ed-toast-a'));
click($('.ed-toast .ed-toast-a'));
check('urungkan mengembalikan widget', page('personal').widgets.length === n0 + 1 && page('personal').widgets[1].hidden === true);
// urungkan empat langkah lagi (sembunyi, duplikat, naik, turun) sampai kembali ke keadaan semula
check('tidak ada widget terpilih setelah hapus', !$('.ed-bar [data-a="w-x"]'));
for (let i = 0; i < 4; i++) click($('.ed-bar [data-a="undo"]'));
check('tombol urungkan mati saat tumpukan habis', $('.ed-bar [data-a="undo"]').disabled);
check('urungkan bertumpuk kembali ke awal', page('personal').widgets.length === n0 && page('personal').widgets[0].id === firstId,
  page('personal').widgets.length + ' / ' + page('personal').widgets[0].id);

// ---- menu Tambah: disisipkan di bawah widget terpilih
goKey('bni');
click($$('.step[data-wl] > .w')[0]);
click($('.ed-bar [data-a="add"]'));
check('menu Tambah terbuka', !!$('.ed-pk [data-t="text"]'));
check('ada 18 jenis widget', $$('.ed-pk [data-t]').length === 18, String($$('.ed-pk [data-t]').length));
check('tumpukan Bread/Cheese/Meat tidak bisa ditambah dua kali', $('.ed-pk [data-t="tiers"]').disabled);
click($('.ed-pk [data-t="text"]'));
check('teks baru tepat di bawah judul', page('bni').widgets[1].type === 'text', page('bni').widgets[1].type);
check('teks baru langsung terpilih', +sel().dataset.w === 1);

// ---- toolbar teks: Bold, Italic, Underline, Link
const tnode = sel().querySelector('[data-e]');
tnode.dispatchEvent(new w.FocusEvent('focus'));
check('toolbar punya B, I, U, Link', ['bold', 'italic', 'underline', 'link', 'clear'].every((f) => !!$('.ed-fmt [data-f="' + f + '"]')));
const down = (n) => n.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
down($('.ed-fmt [data-f="italic"]'));
down($('.ed-fmt [data-f="underline"]'));
check('italic dan underline dijalankan', cmds.includes('italic') && cmds.includes('underline'), cmds.join());
down($('.ed-fmt [data-f="link"]'));
check('kolom link muncul', !!$('.ed-fmt-link input'));
$('.ed-fmt-link input').value = 'increasink.co.id';
click($('.ed-fmt-link [data-f="ok"]'));
check('link dilengkapi https', cmds.some((c) => c.includes('https://increasink.co.id')), cmds.slice(-1).join());
tnode.innerHTML = 'Halo <i>miring</i> <a href="javascript:alert(1)" onclick="x()">jahat</a> <script>1</script>';
tnode.dispatchEvent(new w.FocusEvent('blur'));
BC.editing = false; BC.render();
const shown = $$('.step .p').map((p) => p.innerHTML).find((h) => h.includes('miring')) || '';
check('italic tampil ke pengunjung', shown.includes('<i>miring</i>'), shown);
check('link berbahaya dan script dibuang', !/javascript|onclick|script/.test(shown), shown);
BC.editing = true; BC.render();

// ---- panel Atur: gambar dengan lebar yang bisa diatur
click($$('.step[data-wl] > .w')[1]);
click($('.ed-bar [data-a="add"]'));
click($('.ed-pk [data-t="image"]'));     // membuka pemilih berkas, jsdom diam saja
const imgW = page('bni').widgets[2];
check('widget gambar ditambahkan', imgW.type === 'image' && imgW.w === 100);
imgW.src = 'img/slide2.webp';
BC.render();
click($('.ed-bar [data-a="w-set"]'));
check('panel Atur terbuka di body', !!$('body > .ed-panel') && doc.body.classList.contains('ed-panel-on'));
const range = $('.ed-panel input[type="range"]');
check('ada slider lebar', !!range);
range.value = '60';
range.dispatchEvent(new w.Event('change'));
check('lebar tersimpan di data', imgW.w === 60, String(imgW.w));
check('lebar tampil di kartu', (sel().querySelector('figure.wimg').getAttribute('style') || '').includes('width:60%'),
  sel().querySelector('figure.wimg').getAttribute('style'));
check('panel tetap hidup setelah render ulang', !!$('body > .ed-panel'));
check('pegangan ubah ukuran di gambar terpilih', !!sel().querySelector('.ed-rs'));
click([...$$('.ed-panel .ed-seg button')].find((b) => b.textContent === 'Right'));
check('posisi kanan tersimpan', imgW.align === 'right');
click([...$$('.ed-panel .ed-seg button')].find((b) => b.textContent === 'Logo'));
check('ganti ke logo menampilkan slider tinggi', !!$('.ed-panel') && $('.ed-panel').textContent.includes('Logo height'));
click($('.ed-panel .ed-px'));
check('panel tertutup', !$('.ed-panel') && !doc.body.classList.contains('ed-panel-on'));

// ---- pindahkan widget ke halaman lain lewat panel
click($('.ed-bar [data-a="w-set"]'));
const mv = $('.ed-panel [data-move]');
mv.value = String(D.pages.indexOf(page('connect')));
mv.dispatchEvent(new w.Event('change'));
check('gambar pindah ke halaman Kontak', page('connect').widgets.slice(-1)[0] === imgW && !page('bni').widgets.includes(imgW));

// ---- accordion: kotak huruf bisa diganti ikon
goKey('gains');
const acc = widget('gains', 'accordion');
const badge = $('.acc-l[data-badge]');
check('kotak huruf bisa diketuk', !!badge && badge.textContent === 'G');
click(badge);
check('lembar kotak huruf terbuka', !!$('#edbadge') && $$('.ed-icons [data-ic]').length > 20);
click($('.ed-icons [data-ic="star"]'));
check('ikon tersimpan', acc.items[0].icon === 'star');
check('ikon tampil di kotak', !!$('.acc-l.ico svg'));
check('item tanpa poin dapat tombol + Poin', !!$('.ed-more [data-m="list"]'));

// ---- daftar Accomplishment: Hapus item lewat toolbar
const accItems = acc.items.find((x) => x.k === 'accomplishment').list;
const lis = $$('.acc-i[data-pil$=":accomplishment"] ul.list > li');
check('accomplishment tampil sesuai data', lis.length === accItems.length && lis.length > 0, lis.length + ' vs ' + accItems.length);
const second = accItems[1].en;
lis[1].dispatchEvent(new w.FocusEvent('focus'));
down($('.ed-fmt [data-f="del"]'));
check('item kedua terhapus dari data', accItems.length === lis.length - 1 && !accItems.some((x) => x.en === second));
check('toolbar hilang setelah hapus', !$('.ed-fmt'));

// ---- halaman: tambah halaman baru, atur ikon dan nama
click($('.ed-bar [data-a="order"]'));
check('lembar Halaman terbuka', !!$('#edtiles') && $$('#edtiles .ed-tile').length === 6);
check('ada Jadikan patokan dan Hapus semua perubahan', !!$('.ed-sheet [data-a="setdef"]') && !!$('.ed-sheet [data-a="revert"]'));
click($('.ed-sheet [data-a="newpage"]'));
check('halaman baru dibuat dan dibuka', D.pages.length === 7 && BC.steps()[BC.at()].page === 6);
check('halaman baru langsung punya judul', D.pages[6].widgets.length === 1 && D.pages[6].widgets[0].type === 'heading');
check('tab baru muncul', BC.steps().length === 8);
click($('.ed-bar [data-a="order"]'));
click($$('#edtiles .ed-tile')[6].querySelector('.ed-pset'));
const tabEn = $('.ed-sheet input[data-k="tab_en"]');
tabEn.value = 'Awards';
tabEn.dispatchEvent(new w.Event('change'));
click($('.ed-sheet [data-ic="trophy"]'));
check('nama tab dan ikon tersimpan', D.pages[6].tab_en === 'Awards' && D.pages[6].icon === 'trophy');
click($('.ed-sheet [data-a="del"]'));
click($('.ed-sheet [data-a="go"]'));
check('halaman bisa dihapus', D.pages.length === 6);

// ---- slide carousel lewat panel widget
goKey('intro');
click($$('.step[data-wl] > .w')[0]);
click($('.ed-bar [data-a="w-set"]'));
click([...$$('.ed-panel [data-act]')].find((b) => b.textContent.includes('photos')));
check('lembar slide terbuka', !!$('#edslides'));
let tiles = $$('#edslides .ed-tile');
check('5 kartu slide', tiles.length === 5, String(tiles.length));
check('kartu menyebut nama berkas', tiles[0].textContent.includes('gold-v2.mp4'), tiles[0].textContent.trim());
click(tiles[1].querySelector('.ed-del'));
const slides = widget('intro', 'carousel').slides;
check('slide terhapus dari data', slides.length === 4 && !slides.some((x) => x.src === 'img/intro-v2.mp4'));
check('lembar slide masih hidup setelah hapus', !!$('#edslides'));
check('draft tersimpan', !!w.localStorage.getItem('bc.draft.stephen-bni'));
click($('.ed-sheet [data-a="ok"]'));
check('lembar tertutup', !$('.ed-sheet'));
// carousel ministry punya tombol Atur foto dan video di bawahnya
goKey('personal');
const mb = $('.mincar') && $('.mincar').nextElementSibling;
check('tombol Atur foto dan video di bawah carousel ministry', !!mb && mb.classList.contains('ed-img-btn'), mb && mb.className);
click(mb);
check('lembar ministry berisi 2 foto', $$('#edslides .ed-tile').length === 2);
click($('.ed-sheet [data-a="ok"]'));

// ---- Jadikan patokan, lalu kembalikan
BC.go(0);
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="setdef"]'));
click($('.ed-sheet [data-a="go"]'));
await sleep(30);
const pub = calls.filter((c) => c.url.includes('/publish'));
check('publish dipanggil dengan slot default', pub.length === 1 && pub[0].body.slot === 'default');
check('patokan berformat widget', baseline && Array.isArray(baseline.pages));
widget('intro', 'carousel').slides.length = 1;
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="getdef"]'));
await sleep(30);
click($('.ed-sheet [data-a="go"]'));
check('data kembali ke patokan', widget('intro', 'carousel').slides.length === 4, String(widget('intro', 'carousel').slides.length));
// patokan lama (format sebelum widget) tetap bisa dipulihkan
baseline = JSON.parse(read('stephen-bni/data.js').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="getdef"]'));
await sleep(30);
click($('.ed-sheet [data-a="go"]'));
check('patokan format lama dikonversi', Array.isArray(D.pages) && !D.biosheet && widget('intro', 'carousel').slides.length === 5);
baseline = null;
click($('.ed-bar [data-a="order"]'));
click($('.ed-sheet [data-a="getdef"]'));
await sleep(30);
check('patokan kosong ditolak dengan pesan', !!$('.ed-toast.bad') && $('.ed-toast.bad').textContent.includes('No baseline saved yet'));

// ---- pin di cover: hapus lewat tombol x
BC.go(0);
const pinBoxes = $$('.pins .pin');
check('pin dapat tombol hapus', pinBoxes.length === 4 && pinBoxes.every((n) => n.querySelector('.ed-x')), String(pinBoxes.length));
check('deret pin dapat tombol tambah', !!$('.pins .ed-add'));
click(pinBoxes[1].querySelector('.ed-x'));
check('pin terhapus dari data', D.pins.length === 3 && !D.pins.some((x) => x.src.includes('connector')));
goKey('bni');
check('pin BNI ikut (pakai pin yang sama)', $$('.pins .pin').length === 3);

// ---- tabel Bio Sheet: hide baris, tambah baris, alamat dua baris
goKey('personal');
const rowOf = (lbl) => $$('[data-hide]').find((r) => r.querySelector('.meta-k').textContent === lbl);
check('baris tabel dapat tombol mata', !!rowOf('Hobbies') && !!rowOf('Hobbies').querySelector('.ed-hide'));
check('baris tabel dapat pegangan geser', !!rowOf('Hobbies').querySelector('.ed-grip-h'));
click(rowOf('Hobbies').querySelector('.ed-hide'));
const tables = page('personal').widgets.filter((x) => x.type === 'table');
const hobRow = tables[1].rows.find((r) => r.label_en === 'Hobbies');
check('hide tersimpan di data', hobRow.hidden === true);
BC.editing = false; BC.render();
check('baris yang di-hide tidak tampil di kartu', !$('.step').textContent.includes('Badminton'));
BC.editing = true; BC.render();
click(rowOf('Hobbies').querySelector('.ed-hide'));
check('tampilkan lagi menghapus tanda hide', !('hidden' in hobRow));
const addRow = $$('.meta[data-arr] > .ed-add')[1];
check('tombol + Baris ada sebelum strip foto', !!addRow && addRow.nextElementSibling && addRow.nextElementSibling.classList.contains('bs-photos'));
const r0 = tables[1].rows.length;
click(addRow);
check('baris baru ditambahkan', tables[1].rows.length === r0 + 1);
const loc = rowOf('Location').querySelector('.meta-v');
loc.dispatchEvent(new w.FocusEvent('focus'));
loc.textContent = loc.textContent.replace('Lantai 9', 'Lantai 10');
loc.dispatchEvent(new w.FocusEvent('blur'));
const lv = tables[0].rows[2].value_en;
check('baris baru alamat tetap ada', lv.includes('Lantai 10') && lv.split('\n').length === 7 && lv.split('\n\n').length === 2, JSON.stringify(lv.slice(0, 80)));

// ---- kontak tetap bisa disunting
goKey('connect');
check('kontak LinkedIn tampil', !!$('.contact a[href="https://www.linkedin.com/in/stephen-septian/"]'));

// ---- publish mengirim format widget
click($('.ed-bar [data-a="pub"]'));
await sleep(30);
const last = calls.filter((c) => c.url.includes('/publish')).pop();
check('publish mengirim pages', last && !last.body.slot && Array.isArray(last.body.data.pages));
check('setelah publish draft dibersihkan', !w.localStorage.getItem('bc.draft.stephen-bni'));

// ---- render ulang saat menyunting tidak loncat ke atas
goKey('personal');
doc.getElementById('stage').scrollTop = 240;
BC.render();
check('posisi gulir dipertahankan', doc.getElementById('stage').scrollTop === 240, String(doc.getElementById('stage').scrollTop));
check('kelas calm dipasang', doc.getElementById('app').classList.contains('calm'));
BC.go(0);
check('pindah step tetap animasi masuk', !doc.getElementById('app').classList.contains('calm'));

if (missing.length) fail.push('elemen tidak ditemukan: ' + missing.join(' | '));
console.log('LULUS (' + ok.length + ')');
ok.forEach((x) => console.log('  + ' + x));
if (fail.length) {
  console.log('\nGAGAL (' + fail.length + ')');
  fail.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
