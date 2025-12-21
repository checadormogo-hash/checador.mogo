import { put } from '@vercel/blob';

const FILE_NAME = 'workers.json';
const FILE_URL = `https://blob.vercel-storage.com/${FILE_NAME}`;

export default async function handler(req, res) {
  try {

    // 🔹 GET
    if (req.method === 'GET') {
      try {
        const response = await fetch(FILE_URL);
        const data = await response.json();
        return res.status(200).json(data);
      } catch {
        return res.status(200).json([]);
      }
    }

    // 🔹 POST
    if (req.method === 'POST') {
      const worker = req.body;

      let workers = [];
      try {
        const response = await fetch(FILE_URL);
        workers = await response.json();
      } catch {}

      workers.push(worker);

      await put(FILE_NAME, JSON.stringify(workers), {
        access: 'public',
        contentType: 'application/json',
        overwrite: true
      });

      return res.status(200).json({ status: 'ok' });
    }

    // 🔹 DELETE
    if (req.method === 'DELETE') {
      const { id } = req.query;

      const response = await fetch(FILE_URL);
      const workers = await response.json();

      const newWorkers = workers.filter(w => w.id !== id);

      await put(FILE_NAME, JSON.stringify(newWorkers), {
        access: 'public',
        contentType: 'application/json',
        overwrite: true
      });

      return res.status(200).json({ status: 'deleted' });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR API:', err);
    return res.status(500).json({ error: 'Error interno real' });
  }
}
