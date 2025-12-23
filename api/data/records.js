import { get, put } from '@vercel/blob';

const KEY = 'data/records.json';

export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {

    // ================= GET =================
    if (req.method === 'GET') {
      try {
        const file = await get(KEY, {
          token,
          cacheControl: 'no-store'
        });
        const data = await file.json();
        return res.status(200).json(data);
      } catch {
        return res.status(200).json({ records: [] });
      }
    }

    // ================= POST =================
    if (req.method === 'POST') {
      let body = req.body;

      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const { workerId, step, time, date } = body;

      // Leer archivo actual
      let data = { records: [] };

      try {
        const file = await get(KEY, {
          token,
          cacheControl: 'no-store'
        });
        data = await file.json();
      } catch {
        // si no existe, usamos el vacío
      }

      // Buscar registro por trabajador + fecha
      let record = data.records.find(
        r => r.workerId === workerId && r.date === date
      );

      // Crear nuevo si no existe
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

      // Asignar checada
      if (step === 0) record.entrada = time;
      if (step === 1) record.salidaComida = time;
      if (step === 2) record.entradaComida = time;
      if (step === 3) record.salida = time;

      // 🔥 GUARDADO FORZADO (AQUÍ ESTABA EL PROBLEMA)
      await put(
        KEY,
        JSON.stringify(data, null, 2),
        {
          token,
          contentType: 'application/json',
          access: 'public',
          allowOverwrite: true   // 👈 ahora sí, sin ambigüedad
        }
      );

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();

  } catch (err) {
    console.error('API records error:', err);
    return res.status(500).json({
      error: 'Error al guardar asistencia',
      details: err.message
    });
  }
}
