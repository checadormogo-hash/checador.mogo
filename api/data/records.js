import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { workerId, date, time } = req.body;

    if (!workerId || !date || !time) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const basePath = path.join(process.cwd(), 'public/data/records');
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });

    const filePath = path.join(basePath, `${workerId}.json`);

    let data = { records: [] };

    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    // 🔍 Buscar fecha
    let dayRecord = data.records.find(r => r.date === date);

    if (!dayRecord) {
      dayRecord = {
        date,
        entradaTrabajo: null,
        salidaComida: null,
        entradaComida: null,
        salidaTrabajo: null
      };
      data.records.push(dayRecord);
    }

    // 🧠 Decidir campo
    let field = null;

    if (!dayRecord.entradaTrabajo) field = 'entradaTrabajo';
    else if (!dayRecord.salidaComida) field = 'salidaComida';
    else if (!dayRecord.entradaComida) field = 'entradaComida';
    else if (!dayRecord.salidaTrabajo) field = 'salidaTrabajo';
    else {
      return res.status(409).json({ error: 'Checadas completas' });
    }

    // ✍️ Guardar SOLO ese campo
    dayRecord[field] = time;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return res.status(200).json({
      success: true,
      fieldRegistered: field
    });

  } catch (err) {
    console.error('ERROR RECORDS:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
