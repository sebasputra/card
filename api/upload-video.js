/* POST /api/upload-video  (dipanggil oleh upload() dari @vercel/blob/client)
   Video terlalu besar untuk body function Vercel (4,5 MB), jadi browser mengunggah
   langsung ke Blob. Endpoint ini hanya membagikan token sekali pakai, setelah sesi
   editor diperiksa, dan membatasi jenis, ukuran, serta folder tujuan. */
import { verifyToken, requireEnv } from './_lib.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireEnv(res, ['SESSION_SECRET', 'BLOB_READ_WRITE_TOKEN'])) return;

  if (!verifyToken(req.headers.authorization, process.env.SESSION_SECRET)) {
    return res.status(401).json({ error: 'Sesi habis. Silakan login lagi.' });
  }
  const card = String(req.headers['x-card'] || '');
  if (!SLUG.test(card)) return res.status(400).json({ error: 'Nama kartu tidak valid.' });

  try {
    // diimpor di sini, supaya dev server lokal tanpa node_modules tetap bisa memuat file ini
    const { handleUpload } = await import('@vercel/blob/client');
    const json = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^cards\/[a-z0-9-]+\/video\.(mp4|mov|webm)$/.test(pathname) ||
            !pathname.startsWith('cards/' + card + '/')) {
          throw new Error('Tujuan unggahan tidak valid.');
        }
        return {
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true
        };
      }
    });
    res.status(200).json(json);
  } catch (e) {
    res.status(400).json({ error: (e && e.message) || 'Gagal menyiapkan unggahan video.' });
  }
}
