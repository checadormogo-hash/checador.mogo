import { get, put } from '@vercel/blob';

const RECORDS_PATH = 'records.json';

export default async function handler(req, res) {
  // ===== GET (leer registros) =====
  if (req.method === 'GET') {
    try {
      const file = await get(RECORDS_PATH, { cacheControl: 'no-store' });
      const data = await file.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(200).json({ records: [] });
    }
  }

  // ===== POST (guardar checada) =====
  if (req.method === 'POST') {
    try {
      const { workerId, step, time, date } = req.body;

      const file = await get(RECORDS_PATH, { cacheControl: 'no-store' });
      const data = await file.json();

      let record = data.records.find(
        r => r.workerId === workerId && r.date === date
      );

      // Si no existe registro del día → crear
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

      // Guardar según paso
      if (step === 0) record.entrada = time;
      if (step === 1) record.salidaComida = time;
      if (step === 2) record.entradaComida = time;
      if (step === 3) record.salida = time;

      await put(RECORDS_PATH, JSON.stringify(data, null, 2), {
        access: 'private',
        contentType: 'application/json'
      });

      return res.status(200).json({ ok: true });

    } catch (error) {
      return res.status(500).json({ error: 'Error al guardar registro' });
    }
  }

  res.status(405).end();
}