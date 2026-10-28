/* GET /api/vcard?card=stephen-bni&u=<link kartu>  ->  file kontak (.vcf)
   Isinya dibaca dari <card>/data.js yang sedang live, jadi ikut berubah kalau kontak
   disunting lewat editor. iPhone membuka layar "Buat Kontak Baru" yang sudah terisi,
   Android mengunduh berkasnya lalu membuka aplikasi Kontak. */

// vCard: koma, titik koma, backslash, dan baris baru harus di-escape
function v(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

// baris vCard maksimal 75 karakter, sambungannya diawali satu spasi
function fold(line) {
  let out = line.slice(0, 75);
  for (let i = 75; i < line.length; i += 74) out += '\r\n ' + line.slice(i, i + 74);
  return out;
}

export default async function handler(req, res) {
  const card = String(req.query.card || '');
  if (!/^[a-z0-9-]{1,40}$/.test(card)) return res.status(400).send('card tidak valid');
  const base = 'https://' + req.headers.host;

  let D;
  try {
    const src = await (await fetch(base + '/' + card + '/data.js')).text();
    // data.js = komentar + "var DATA = <json>;" (ditulis api/publish.js)
    D = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  } catch (e) {
    return res.status(404).send('kartu tidak ditemukan');
  }

  const hero = D.hero || {}, c = D.contact || {};
  const name = String(hero.name || '').trim();
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.pop() : '';
  // "Founder & Creative Director, Increasink" -> jabatan + perusahaan
  const role = String(hero.role_en || hero.role_id || '');
  const cut = role.lastIndexOf(', ');
  const title = cut > 0 ? role.slice(0, cut) : role;
  const org = cut > 0 ? role.slice(cut + 2) : '';

  const L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + v(family) + ';' + v(parts.join(' ')) + ';;;', 'FN:' + v(name)];
  if (org) L.push('ORG:' + v(org));
  if (title) L.push('TITLE:' + v(title));
  if (c.wa) L.push('TEL;TYPE=CELL,VOICE:+' + String(c.wa).replace(/\D/g, ''));
  if (c.email) L.push('EMAIL;TYPE=INTERNET,WORK:' + v(c.email));
  if (c.web) L.push('URL;TYPE=WORK:' + v(/^https?:/.test(c.web) ? c.web : 'https://' + c.web));

  // link kartu Bio GAINS, hanya kalau menunjuk ke domain ini sendiri
  try {
    const u = new URL(String(req.query.u || ''));
    if (u.host === req.headers.host) L.push('item1.URL:' + v(u.origin + u.pathname), 'item1.X-ABLabel:Bio GAINS');
  } catch (e) { /* tanpa link kartu */ }

  if (c.ig) L.push('X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/' + v(c.ig));
  if (c.linkedin) L.push('X-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/' + v(c.linkedin) + '/');

  // alamat kantor dari baris Location di Bio Sheet, satu alamat per baris
  const rows = ((D.biosheet || {}).groups || []).flatMap((g) => g.rows || []);
  const loc = rows.find((r) => r.label_en === 'Location' && !r.hidden);
  String((loc && (loc.value_en || loc.value_id)) || '').split('\n').map((s) => s.trim()).filter(Boolean)
    .forEach((a) => L.push('ADR;TYPE=WORK:;;' + v(a) + ';;;;Indonesia'));

  // foto profil ditanam langsung supaya muncul di kontak dan di WhatsApp
  const photo = (D.images || {}).hero;
  if (photo && /\.jpe?g$/i.test(photo)) {
    try {
      const r = await fetch(base + '/' + card + '/' + photo.replace(/^\.?\//, ''));
      if (r.ok) L.push('PHOTO;ENCODING=b;TYPE=JPEG:' + Buffer.from(await r.arrayBuffer()).toString('base64'));
    } catch (e) { /* tanpa foto */ }
  }
  L.push('END:VCARD');

  const file = (name || card).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.vcf';
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="' + file + '"');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.status(200).send(L.map(fold).join('\r\n') + '\r\n');
}
