// api/asistencia.js
export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;          // p.ej. https://tolerant-seahorse-17195.upstash.io
  const token = process.env.KV_REST_API_TOKEN;      // token DE ESCRITURA (no el read-only)

  if (!url || !token) {
    res.status(500).json({ ok: false, error: "KV no configurado (variables de entorno faltantes)" });
    return;
  }

  // Helpers REST Upstash (forma oficial)
  async function redisGET(path) {
    const r = await fetch(`${url}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  async function redisPOST(path, body) {
    const r = await fetch(`${url}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      // En Upstash, el body se añade como último argumento del comando.
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }

  // Hash donde guardamos todo
  const HASH = "attendance";

  // Node utils para leer data.json
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_PATH = path.join(__dirname, "..", "src", "data.json");

  function getDB() {
    try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); }
    catch { return {}; }
  }

  // ---- Rutas ----

  // POST /api/asistencia  { cedula, pin }
  if (req.method === "POST" && req.url === "/api/asistencia") {
    try {
      let raw = "";
      await new Promise((resolve) => {
        req.on("data", (c) => (raw += c));
        req.on("end", resolve);
      });
      const { cedula, pin } = JSON.parse(raw || "{}");

      if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });
      if (!/^\d{5,}$/.test(String(cedula || ""))) return res.status(400).json({ ok: false, error: "Cédula inválida" });

      const db = getDB();
      const item = db[cedula];
      if (!item) return res.status(404).json({ ok: false, error: "Cédula no encontrada en data.json" });

      // ¿Ya existe?
      const existente = await redisGET(`hget/${HASH}/${cedula}`);
      if (existente) {
        return res.json({ ok: true, yaRegistrado: true, data: JSON.parse(existente) });
      }

      const record = {
        cedula,
        nombre: item.nombre || "",
        cargo: item.cargo || "",
        antiguedad: item.antiguedad || "",
        hora: new Date().toISOString(),
      };

      // HSET attendance <cedula> <JSON>
      await redisPOST(`hset/${HASH}/${cedula}`, JSON.stringify(record));

      res.json({ ok: true, data: record });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || "Error registrando asistencia" });
    }
    return;
  }

  // GET /api/asistencia/list?pin=0808
  if (req.method === "GET" && req.url.startsWith("/api/asistencia/list")) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pin = urlObj.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });

    try {
      // HGETALL attendance -> devuelve array [field, value, field, value ...]
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const map = {};
      for (let i = 0; i < arr.length; i += 2) {
        const cedula = arr[i];
        const val = arr[i + 1];
        map[cedula] = JSON.parse(val);
      }
      res.json({ ok: true, items: map });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
    return;
  }

  // GET /api/asistencia/export?pin=0808 -> CSV
  if (req.method === "GET" && req.url.startsWith("/api/asistencia/export")) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pin = urlObj.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).send("PIN inválido");

    try {
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const rows = [["cedula","nombre","cargo","antiguedad","hora"]];
      for (let i = 0; i < arr.length; i += 2) {
        const cedula = arr[i];
        const obj = JSON.parse(arr[i+1]);
        rows.push([cedula, obj.nombre||"", obj.cargo||"", obj.antiguedad||"", obj.hora||""]);
      }
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=asistencia.csv");
      res.end(csv);
    } catch (e) {
      res.status(500).send("Error exportando CSV");
    }
    return;
  }

  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}
