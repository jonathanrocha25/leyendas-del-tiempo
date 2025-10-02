// api/asistencia.js
export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    res.status(500).json({ ok: false, error: "KV no configurado (variables de entorno faltantes)" });
    return;
  }

  // Helpers para hablar con KV (Hash "attendance")
  async function kv(cmd, ...args) {
    const body = { cmd, args };
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`KV error: ${r.status} ${await r.text()}`);
    return r.json();
  }
  const HSET = (...a) => kv("HSET", "attendance", ...a);
  const HGET = (field) => kv("HGET", "attendance", field);
  const HGETALL = () => kv("HGETALL", "attendance"); // devuelve [field, value, field, value, ...]

  // Lee data.json (para mostrar nombre/cargo/antigüedad al registrar)
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_PATH = path.join(__dirname, "..", "src", "data.json");
  function getDB() {
    try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); } catch { return {}; }
  }

  // --- Rutas ---
  // POST /api/asistencia  { cedula, pin }
  if (req.method === "POST") {
    try {
      let body = "";
      await new Promise((resolve) => {
        req.on("data", (c) => (body += c));
        req.on("end", resolve);
      });
      const payload = JSON.parse(body || "{}");
      const { cedula, pin } = payload;

      if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });
      if (!/^\d{5,}$/.test(String(cedula || ""))) return res.status(400).json({ ok: false, error: "Cédula inválida" });

      const db = getDB();
      const item = db[cedula];
      if (!item) return res.status(404).json({ ok: false, error: "Cédula no encontrada en data.json" });

      // Si ya existe, no duplicamos (idempotente)
      const existente = await HGET(cedula);
      if (existente?.result) {
        return res.json({ ok: true, yaRegistrado: true, data: JSON.parse(existente.result) });
      }

      const record = {
        cedula,
        nombre: item.nombre || "",
        cargo: item.cargo || "",
        antiguedad: item.antiguedad || "",
        hora: new Date().toISOString(),
      };

      const r = await HSET(cedula, JSON.stringify(record));
      if (r.error) throw new Error(r.error);

      res.json({ ok: true, data: record });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || "Error registrando asistencia" });
    }
    return;
  }

  // GET /api/asistencia/list?pin=0808 → JSON con asistentes (hash completo)
  if (req.method === "GET" && req.url.includes("/list")) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pin = urlObj.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });
    try {
      const all = await HGETALL();
      const arr = all?.result || [];
      const map = {};
      for (let i = 0; i < arr.length; i += 2) {
        map[arr[i]] = JSON.parse(arr[i + 1]);
      }
      res.json({ ok: true, items: map });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
    return;
  }

  // GET /api/asistencia/export?pin=0808 → CSV (solo asistentes)
  if (req.method === "GET" && req.url.includes("/export")) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pin = urlObj.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).send("PIN inválido");

    try {
      const all = await HGETALL();
      const arr = all?.result || [];
      const rows = [["cedula","nombre","cargo","antiguedad","hora"]];
      for (let i = 0; i < arr.length; i += 2) {
        const cedula = arr[i];
        const obj = JSON.parse(arr[i+1]);
        rows.push([cedula, obj.nombre || "", obj.cargo || "", obj.antiguedad || "", obj.hora || ""]);
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

