export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    ok: true,
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString(),
  });
}
