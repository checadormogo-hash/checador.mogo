import { get, put } from '@vercel/blob';

const KEY = 'data/records.json';
const token = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {

    // ===== GET =====
    if (req.method === 'GET') {
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

      // 1️⃣ Cargar archivo o crear estructura base
      let data;
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        data = { records: [] };
      }

      // 2️⃣ Buscar registro del día
      let record = data.records.find(
        r => r.workerId === workerId && r.date === date
      );

      // 3️⃣ Crear registro si no existe
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

      // 4️⃣ Guardar paso correspondiente
      if (step === 0) record.entrada = time;
      if (step === 1) record.salidaComida = time;
      if (step === 2) record.entradaComida = time;
      if (step === 3) record.salida = time;

      // 5️⃣ Guardar en Blob
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
    res.status(405).end();

  } catch (err) {
    console.error('API records error:', err);
    res.status(500).json({ error: err.message });
  }
}