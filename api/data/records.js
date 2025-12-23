import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const newRecord = req.body;

    // 📌 1. LEER ARCHIVO EXISTENTE
    let currentData = { records: [] };

    try {
      const blob = await get('records.json', { cacheControl: 'no-store' });
      const text = await blob.text();
      currentData = JSON.parse(text);
    } catch (err) {
      // Si no existe, se crea desde cero
      currentData = { records: [] };
    }

    // 📌 2. AGREGAR (NO REEMPLAZAR)
    currentData.records.push(newRecord);

    // 📌 3. GUARDAR TODO OTRA VEZ
    await put(
      'records.json',
      JSON.stringify(currentData, null, 2),
      {
        access: 'public',
        contentType: 'application/json'
      }
    );

    return res.status(200).json({ success: true });

  } catch (err) {
  console.error('API records error:', err);
  return res.status(500).json({
    error: 'Error al guardar asistencia',
    details: err.message
  });
}
}
