import { get, put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

/* ===============================
   FECHA Y HORA
================================ */
function getISODate() {
  return new Date().toISOString().slice(0, 10); // yyyy-mm-dd
}

function getLocalTime12h() {
  return new Date().toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
}

/* ===============================
   NORMALIZAR FECHA ANTIGUA
================================ */
function normalizeDate(dateStr) {
  // yyyy-mm-dd → ok
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // dd-mm-yyyy → convertir
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }

  return dateStr;
}

/* ===============================
   API
================================ */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Método no permitido' });
    }

    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { workerId, step } = body;
    if (!workerId) {
      return res.status(400).json({ error: 'workerId requerido' });
    }

    const KEY = `data/records/${workerId}.json`;
    const today = getISODate();
    const time = getLocalTime12h();

    // ===== CARGAR ARCHIVO =====
    let data;
    try {
      const file = await get(KEY, { token, cacheControl: 'no-store' });
      data = await file.json();
    } catch {
      data = { records: [] };
    }

    // ===== NORMALIZAR FECHAS EXISTENTES =====
    data.records.forEach(r => {
      r.date = normalizeDate(r.date);
    });

    // ===== BUSCAR REGISTRO DEL DÍA =====
    let dayRecord = data.records.find(r => r.date === today);

    if (!dayRecord) {
      dayRecord = {
        date: today,
        entrada: null,
        salidaComida: null,
        entradaComida: null,
        salida: null
      };
      data.records.push(dayRecord);
    }

    // ===== ACTUALIZAR SOLO EL CAMPO =====
    const fields = ['entrada', 'salidaComida', 'entradaComida', 'salida'];
    const field = fields[step];

    if (field && !dayRecord[field]) {
      dayRecord[field] = time;
    }

    // ===== GUARDAR =====
    await put(KEY, JSON.stringify(data, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Error al guardar asistencia',
      details: err.message
    });
  }
}
