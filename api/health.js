import { checkDbHealth } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const db = await checkDbHealth();

  if (!db.ok) {
    return res.status(503).json({
      ok: false,
      status: 'error',
      message: db.error || 'Base de données indisponible',
      code: db.code || 'db_error',
      backend: db.backend,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    ok: true,
    status: 'ok',
    message: 'API is working',
    backend: db.backend,
    timestamp: new Date().toISOString(),
  });
}
