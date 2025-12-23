import { get, put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {

    /* =======================
       GET (opcional futuro)
    ======================= */
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true });
    }

    /* =======================
       POST → guardar checada
    ======================= */
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }

      const { workerId, step, time, date } = body;

      if (!workerId || step === undefined || !time || !date) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const KEY = `data/records/${workerId}.json`;

      /* ===== LEER ARCHIVO DEL TRABAJADOR ===== */
      let data;
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        // 🔥 Si no existe, lo creamos
        data = {
          workerId,
          records: []
        };
      }

      /* ===== BUSCAR REGISTRO POR FECHA ===== */
      let record = data.records.find(r => r.date === date);

      if (!record) {
        record = {
          date,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null
        };
        data.records.push(record);
      }

      /* ===== ASIGNAR PASO ===== */
      switch (step) {
        case 0: record.entrada = time; break;
        case 1: record.salidaComida = time; break;
        case 2: record.entradaComida = time; break;
        case 3: record.salida = time; break;
      }

      /* ===== GUARDAR ARCHIVO ===== */
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

    res.setHeader('Allow', 'POST');
    return res.status(405).end();

  } catch (err) {
    console.error('API records error:', err);
    return res.status(500).json({
      error: 'Error al guardar asistencia',
      details: err.message
    });
  }
}