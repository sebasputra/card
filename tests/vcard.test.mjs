import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import handler from '../api/vcard.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// server palsu: /<card>/<berkas> dibaca dari folder lokal
globalThis.fetch = async (url) => {
  const p = new URL(url).pathname.slice(1);
  try {
    const buf = readFileSync(ROOT + p);
    return { ok: true, text: async () => buf.toString('utf8'), arrayBuffer: async () => buf };
  } catch (e) {
    return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  }
};

function call(query) {
  return new Promise((done) => {
    const res = { code: 0, headers: {}, body: '' };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.code = c; return res; };
    res.send = (b) => { res.body = b; done(res); };
    handler({ query, headers: { host: 'x.test' } }, res);
  });
}

const fail = [], ok = [];
const check = (name, cond, extra) => (cond ? ok : fail).push(name + (extra ? ' -> ' + extra : ''));

const r = await call({ card: 'stephen-bni', u: 'https://x.test/bni/?ref=wa#top' });
const txt = r.body.replace(/\r\n /g, '');   // buka lipatan baris
check('status 200 dan tipe vcard', r.code === 200 && r.headers['Content-Type'].startsWith('text/vcard'));
check('nama lengkap', txt.includes('FN:Stephen Septian') && txt.includes('N:Septian;Stephen;;;'));
check('jabatan dan perusahaan', txt.includes('TITLE:Founder & Creative Director') && txt.includes('ORG:Increasink'));
check('nomor WhatsApp', txt.includes('TEL;TYPE=CELL,VOICE:+62817714647'));
check('email', txt.includes('stephen@increasink.co.id'));
check('link kartu tanpa query', txt.includes('item1.URL:https://x.test/bni/\r\n'));
check('dua alamat kantor', (txt.match(/^ADR;/gm) || []).length === 2);
check('koma di alamat di-escape', txt.includes('Jl. TB. Simatupang No. 5\\, Ragunan'));
check('foto tertanam', /PHOTO;ENCODING=b;TYPE=JPEG:\/9j\//.test(txt));
check('baris dilipat maks 75', r.body.split('\r\n').every((l) => l.length <= 75));

const bad = await call({ card: '../etc', u: '' });
check('card aneh ditolak', bad.code === 400);
const foreign = await call({ card: 'stephen-bni', u: 'https://evil.test/x' });
check('link domain lain tidak ikut', !foreign.body.replace(/\r\n /g, '').includes('evil.test'));

console.log('LULUS (' + ok.length + ')');
ok.forEach((x) => console.log('  + ' + x));
if (fail.length) {
  console.log('\nGAGAL (' + fail.length + ')');
  fail.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
