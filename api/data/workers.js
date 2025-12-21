import { put, head } from '@vercel/blob';

const KEY = 'data/workers.json';
const token = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {
    // ===== GET =====
    if (req.method === 'GET') {
      try {
        const meta = await head(KEY, { token });
        const r = await fetch(meta.url, { cache: 'no-store' });
        const json = await r.json();

        const workers = Array.isArray(json)
          ? json
          : Array.isArray(json?.workers)
          ? json.workers
          : [];

        return res.status(200).json({ workers });
      } catch {
        // si el archivo no existe todavía
        return res.status(200).json({ workers: [] });
      }
    }

    // ===== PUT =====
    if (req.method === 'PUT') {
      let body = req.body;

      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }

      const workers = Array.isArray(body)
        ? body
        : Array.isArray(body?.workers)
        ? body.workers
        : [];

      await put(
        KEY,
        JSON.stringify({ workers }, null, 2),
        {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          token
        }
      );

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).end();

  } catch (err) {
    console.error('API workers error:', err);
    return res.status(500).json({ error: err.message });
  }
}