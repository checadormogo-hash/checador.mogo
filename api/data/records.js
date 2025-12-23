import { get, put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
}

export default async function handler(req, res) {
  try {

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const { workerId, step, time } = body;
    if (!workerId || step === undefined || !time) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const date = getLocalDate();
    const KEY = `data/records/${workerId}.json`;

    /* ===== LEER ARCHIVO ===== */
    let data;
    try {
      const file = await get(KEY, { token, cacheControl: 'no-store' });
      data = await file.json();
    } catch {
      data = { workerId, records: [] };
    }

    /* ===== BUSCAR FECHA ===== */
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

    /* ===== ASIGNAR SIN BORRAR ===== */
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

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al guardar asistencia' });
  }
}
