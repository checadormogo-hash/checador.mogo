import { get, put } from '@vercel/blob';

const KEY = 'data/records.json';
const token = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {

    /* ================== GET ================== */
    if (req.method === 'GET') {
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        const data = await file.json();

        // seguridad extra
        if (!Array.isArray(data.records)) {
          return res.status(200).json({ records: [] });
        }

        return res.status(200).json(data);

      } catch {
        // si aún no existe el archivo
        return res.status(200).json({ records: [] });
      }
    }

    /* ================== POST ================== */
    if (req.method === 'POST') {
      let body = req.body;

      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }

      const { workerId, step, time, date } = body;

      if (!workerId || step === undefined || !time || !date) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      let data = { records: [] };

      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        // archivo no existe todavía
        data = { records: [] };
      }

      let record = data.records.find(
        r => r.workerId === workerId && r.date === date
      );

      if (!record) {
        record = {
          workerId,
          date,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null
        };
        data.records.push(record);
      }

      // guardar según paso
      if (step === 0) record.entrada = time;
      if (step === 1) record.salidaComida = time;
      if (step === 2) record.entradaComida = time;
      if (step === 3) record.salida = time;

      await put(
        KEY,
        JSON.stringify(data, null, 2),
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

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();

  } catch (err) {
    console.error('API records error:', err);
    return res.status(500).json({ error: err.message });
  }
}