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
        try { body = JSON.parse(body); } catch {}
      }

      const { workerId, step, time, date } = body;

      // 🔥 OBTENER REGISTROS EXISTENTES
      let data;
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        data = { records: [] };
      }

      // 🔎 BUSCAR SI YA HAY REGISTRO DEL TRABAJADOR PARA EL DÍA
      let record = data.records.find(
        r => r.workerId === workerId && r.date === date
      );

      // 🆕 CREAR SI NO EXISTE
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

      // ⏱ GUARDAR SEGÚN EL PASO
      switch (step) {
        case 0: record.entrada = time; break;
        case 1: record.salidaComida = time; break;
        case 2: record.entradaComida = time; break;
        case 3: record.salida = time; break;
      }

      // 💾 GUARDAR TODO EL ARRAY, SIN SOBRESCRIBIR
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