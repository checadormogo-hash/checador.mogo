import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // ===== GET =====
    if (req.method === 'GET') {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ error: 'date requerida' });
      }

      const KEY = `data/records-${date}.json`;

      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        const data = await file.json();
        return res.status(200).json(data);
      } catch {
        return res.status(200).json({ records: [] });
      }
    }

    // ===== POST =====
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const { workerId, step, time, date } = body;
      const KEY = `data/records-${date}.json`;

      let data;
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        data = { records: [] };
      }

      let record = data.records.find(
        r => r.workerId === workerId
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

      if (step === 0 && !record.entrada) record.entrada = time;
      if (step === 1 && !record.salidaComida) record.salidaComida = time;
      if (step === 2 && !record.entradaComida) record.entradaComida = time;
      if (step === 3 && !record.salida) record.salida = time;

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
