import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { workerId, date, time } = req.body;

  if (!workerId || !date || !time) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const baseDir = path.join(process.cwd(), 'data', 'records', workerId);
  const filePath = path.join(baseDir, `${date}.json`);

  // 1️⃣ Crear carpeta si no existe
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  let record = {
    entradaTrabajo: null,
    salidaComida: null,
    entradaComida: null,
    salidaTrabajo: null
  };

  // 2️⃣ Si existe archivo, leerlo
  if (fs.existsSync(filePath)) {
    record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // 3️⃣ Decidir qué campo toca
  const field = getNextCheckField(record);

  // ❌ Ya checó todo
  if (!field) {
    return res.status(409).json({
      error: 'Jornada ya finalizada'
    });
  }

  // ❌ Bloqueo: no permitir doble checada
  if (record[field]) {
    return res.status(409).json({
      error: 'Checada duplicada'
    });
  }

  // 4️⃣ Registrar SOLO el campo correcto
  record[field] = time;

  // 5️⃣ Guardar
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

  return res.status(200).json({
    success: true,
    fieldRegistered: field,
    record
  });
}

// ===== LÓGICA CENTRAL =====
function getNextCheckField(record) {
  if (!record.entradaTrabajo) return 'entradaTrabajo';
  if (!record.salidaComida) return 'salidaComida';
  if (!record.entradaComida) return 'entradaComida';
  if (!record.salidaTrabajo) return 'salidaTrabajo';
  return null;
}
