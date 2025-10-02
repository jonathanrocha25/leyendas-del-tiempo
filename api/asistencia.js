export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "✅ La función asistencia.js está funcionando",
    method: req.method,
    url: req.url
  });
}
