/* POST /api/publish  { card, data, message }  ->  { ok, commit, url }
   Menulis <card>/data.js ke GitHub memakai token yang hanya ada di env server.
   Isi file dibentuk di sini, bukan dikirim mentah dari browser, supaya tidak ada
   jalan menyisipkan JavaScript sembarangan ke dalam kartu. */
import { verifyToken, requireEnv } from './_lib.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_BYTES = 512 * 1024;

const SEP = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');   // pemisah baris yang ilegal di dalam string JS

/* Gambar hanya boleh dari folder img/ kartu sendiri atau dari Vercel Blob.
   MEDIA_ORIGINS (opsional, dipisah koma) untuk asal tambahan, dipakai dev server lokal. */
const BLOCK_TYPES = new Set(['row', 'text', 'image']);
const BLOB_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

function okSrc(s) {
  s = String(s || '');
  if (/^img\/[\w./-]+$/.test(s) && s.indexOf('..') < 0) return true;
  if (BLOB_URL.test(s)) return true;
  return String(process.env.MEDIA_ORIGINS || '').split(',')
    .map((o) => o.trim()).filter(Boolean)
    .some((o) => s.startsWith(o + '/'));
}

function checkMedia(data) {
  const imgs = data.images || {};
  for (const k of Object.keys(imgs)) {
    if (imgs[k] && !okSrc(imgs[k])) return 'Alamat gambar tidak diizinkan (' + k + ').';
  }
  if (data.intro_slides != null) {
    if (!Array.isArray(data.intro_slides)) return 'Slide tidak valid.';
    for (const s of data.intro_slides) {
      if (!s || typeof s !== 'object' || (s.type !== 'image' && s.type !== 'video') ||
          !okSrc(s.src) || (s.poster && !okSrc(s.poster))) return 'Slide tidak valid.';
    }
  }
  if (data.blocks == null) return null;
  if (typeof data.blocks !== 'object' || Array.isArray(data.blocks)) return 'Blok tidak valid.';
  for (const key of Object.keys(data.blocks)) {
    const list = data.blocks[key];
    if (!Array.isArray(list)) return 'Blok tidak valid.';
    for (const b of list) {
      if (!b || typeof b !== 'object' || !BLOCK_TYPES.has(b.type)) return 'Jenis blok tidak dikenal.';
      if (b.type === 'image' && !okSrc(b.src)) return 'Alamat gambar tidak diizinkan.';
    }
  }
  return null;
}

function toDataJs(card, data) {
  // JSON.stringify aman, tapi "</script>" di dalam sebuah string bisa menutup
  // tag lebih awal saat file dimuat sebagai <script>. Escape kurung siku dan
  // dua pemisah baris Unicode yang bisa memecah parser.
  const json = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(SEP, (c) => '\\u' + c.charCodeAt(0).toString(16));
  return '/* Bio GAINS data: ' + card + '. Disunting lewat editor kartu, jangan diformat ulang. */\n' +
    'var DATA = ' + json + ';\n';
}

async function gh(path, token, init) {
  const r = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'increasink-biocard',
      ...(init && init.headers)
    }
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireEnv(res, ['SESSION_SECRET', 'GITHUB_TOKEN', 'GITHUB_REPO'])) return;

  if (!verifyToken(req.headers.authorization, process.env.SESSION_SECRET)) {
    return res.status(401).json({ error: 'Sesi habis. Silakan login lagi.' });
  }

  const { card, data, message } = req.body || {};
  // slot "default" menulis patokan ke <card>/default.json, bukan menimpa kartu yang tayang
  const slot = String((req.body || {}).slot || 'data');
  if (slot !== 'data' && slot !== 'default') return res.status(400).json({ error: 'Slot tidak valid.' });
  if (!SLUG.test(String(card || ''))) return res.status(400).json({ error: 'Nama kartu tidak valid.' });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Data kartu tidak valid.' });
  }
  const bad = checkMedia(data);
  if (bad) return res.status(400).json({ error: bad });

  const file = slot === 'default' ? JSON.stringify(data, null, 2) : toDataJs(card, data);
  if (Buffer.byteLength(file, 'utf8') > MAX_BYTES) {
    return res.status(413).json({ error: 'Isi kartu terlalu besar.' });
  }

  const repo = process.env.GITHUB_REPO;               // "owner/nama-repo"
  const branch = process.env.GITHUB_BRANCH || 'main';
  const path = card + (slot === 'default' ? '/default.json' : '/data.js');
  const base = '/repos/' + repo + '/contents/' + path;

  // sha versi sekarang wajib disertakan, supaya GitHub menolak kalau file sudah
  // berubah dari sisi lain sejak halaman ini dimuat.
  const cur = await gh(base + '?ref=' + encodeURIComponent(branch), process.env.GITHUB_TOKEN);
  if (!cur.ok && cur.status !== 404) {
    return res.status(502).json({ error: 'Gagal membaca file di GitHub (' + cur.status + ').' });
  }

  const put = await gh(base, process.env.GITHUB_TOKEN, {
    method: 'PUT',
    body: JSON.stringify({
      message: String(message || '').slice(0, 120) ||
        (slot === 'default' ? 'Simpan patokan kartu ' + card : 'Perbarui kartu ' + card + ' lewat editor'),
      content: Buffer.from(file, 'utf8').toString('base64'),
      branch,
      ...(cur.ok && cur.body.sha ? { sha: cur.body.sha } : {})
    })
  });

  if (!put.ok) {
    const detail = put.body && put.body.message ? ' ' + put.body.message + '.' : '';
    const msg = put.status === 409
      ? 'Kartu sudah berubah di GitHub sejak halaman ini dibuka. Muat ulang dulu.'
      : 'GitHub menolak perubahan (' + put.status + ').' + detail +
        ' Target: ' + repo + ' cabang ' + branch + ', berkas ' + path + '.';
    return res.status(502).json({ error: msg });
  }

  res.status(200).json({
    ok: true,
    commit: put.body.commit && put.body.commit.sha,
    url: put.body.commit && put.body.commit.html_url
  });
}
