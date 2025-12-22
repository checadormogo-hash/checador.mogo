import { put, head } from '@vercel/blob';

const KEY = 'data/records.json';
const WORKERS_KEY = 'data/workers.json';
const token = process.env.BLOB_READ_WRITE_TOKEN;

async function readBlob(key) {
  const meta = await head(key, { token });
  const r = await fetch(meta.url, { cache: 'no-store' });
  return await r.json();
}

export default async function handler(req, res) {
  try {

    // ===== POST (registrar checada) =====
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }

      const { id, pin } = body;
      if (!id || !pin) {
        return res.status(400).json({ status: 'invalid_data' });
      }

      // === leer workers ===
      const workersData = await readBlob(WORKERS_KEY);
      const workers = workersData.workers || [];
      const worker = workers.find(w => w.id === id);

      if (!worker) {
        return res.status(404).json({ status: 'not_found' });
      }

      if (worker.pin !== pin) {
        return res.status(401).json({ status: 'wrong_pin' });
      }

      // === leer records ===
      let recordsData;
      try {
        recordsData = await readBlob(KEY);
      } catch {
        recordsData = { records: [] };
      }

      const records = recordsData.records || [];

      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });

      let record = records.find(
        r => r.workerId === id && r.date === today
      );

      let action = '';

      if (!record) {
        record = {
          workerId: id,
          date: today,
          entrada: time,
          salidaComida: null,
          entradaComida: null,
          salida: null
        };
        records.push(record);
        action = 'entrada';

      } else if (!record.salidaComida) {
        record.salidaComida = time;
        action = 'salida_comida';

      } else if (!record.entradaComida) {
        record.entradaComida = time;
        action = 'entrada_comida';

      } else if (!record.salida) {
        record.salida = time;
        action = 'salida';

      } else {
        return res.json({ status: 'completed' });
      }

      await put(
        KEY,
        JSON.stringify({ records }, null, 2),
        {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          token
        }
      );

      return res.json({
        status: 'ok',
        action,
        workerName: worker.name
      });
    }

    res.setHeader('Allow', 'POST');
    return res.status(405).end();

  } catch (err) {
    console.error('API records error:', err);
    return res.status(500).json({ error: err.message });
  }
}
