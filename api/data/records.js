import { get, put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

/* ===============================
   UTILIDADES DE FECHA Y HORA
================================ */
function getLocalDateDMY() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function getLocalTime12h() {
  return new Date().toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
}

/* ===============================
   API HANDLER
================================ */
export default async function handler(req, res) {
  try {
    /* ===== POST → REGISTRAR CHECADA ===== */
    if (req.method === 'POST') {
      let body = req.body;

      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }

      const { workerId, step } = body;

      if (!workerId && workerId !== '') {
        return res.status(400).json({ error: 'workerId requerido' });
      }

      const KEY = `data/records/${workerId}.json`;
      const today = getLocalDateDMY();
      const time = getLocalTime12h();

      // ===== CARGAR ARCHIVO DEL TRABAJADOR =====
      let data;
      try {
        const file = await get(KEY, { token, cacheControl: 'no-store' });
        data = await file.json();
      } catch {
        data = { records: [] };
      }

      // ===== BUSCAR REGISTRO DEL DÍA =====
      let dayRecord = data.records.find(r => r.date === today);

      // SI NO EXISTE EL DÍA → CREARLO
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

      // ===== EDITAR SOLO EL CAMPO CORRESPONDIENTE =====
      switch (step) {
        case 0:
          if (!dayRecord.entrada) dayRecord.entrada = time;
          break;
        case 1:
          if (!dayRecord.salidaComida) dayRecord.salidaComida = time;
          break;
        case 2:
          if (!dayRecord.entradaComida) dayRecord.entradaComida = time;
          break;
        case 3:
          if (!dayRecord.salida) dayRecord.salida = time;
          break;
      }

      // ===== GUARDAR ARCHIVO COMPLETO (SIN PERDER DATOS) =====
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

    /* ===== MÉTODO NO PERMITIDO ===== */
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('API records error:', err);
    return res.status(500).json({
      error: 'Error al guardar asistencia',
      details: err.message
    });
  }
}