import { put, list, del } from '@vercel/blob';

const FILE_NAME = 'workers.json';

export default async function handler(req, res) {
  try {
    // 🔹 OBTENER DATOS
    if (req.method === 'GET') {
      const files = await list();

      const file = files.blobs.find(b => b.pathname === FILE_NAME);

      if (!file) {
        return res.status(200).json([]);
      }

      const response = await fetch(file.url);
      const data = await response.json();

      return res.status(200).json(data);
    }

    // 🔹 GUARDAR / ACTUALIZAR
    if (req.method === 'POST') {
      const worker = req.body;

      const files = await list();
      const file = files.blobs.find(b => b.pathname === FILE_NAME);

      let workers = [];

      if (file) {
        const response = await fetch(file.url);
        workers = await response.json();
      }

      workers.push(worker);

      await put(FILE_NAME, JSON.stringify(workers), {
        access: 'public',
        contentType: 'application/json'
      });

      return res.status(200).json({ status: 'ok' });
    }

    // 🔹 ELIMINAR
if (req.method === 'DELETE') {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ status: 'missing_id' });
  }

  const files = await list();
  const file = files.blobs.find(b => b.pathname === FILE_NAME);

  if (!file) {
    return res.status(200).json({ status: 'deleted' });
  }

  const response = await fetch(file.url);
  const text = await response.text();
  const workers = text ? JSON.parse(text) : [];

  const newWorkers = workers.filter(w => w.id !== id);

  await put(FILE_NAME, JSON.stringify(newWorkers), {
    access: 'public',
    contentType: 'application/json'
  });

  return res.status(200).json({ status: 'deleted' });
}

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}