// api/asistencia.js
export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return res.status(500).json({ ok: false, error: "KV no configurado" });
  }

  // --- Utilidades para KV REST ---
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
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }

  // --- Cargar base local ---
  const fs = await import("fs");
  const pathModule = await import("path");
  const { fileURLToPath } = await import("url");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = pathModule.dirname(__filename);
  const DATA_PATH = pathModule.join(__dirname, "..", "src", "data.json");

  function getDB() {
    try {
      return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch {
      return {};
    }
  }

  const HASH = "attendance";

  // --- HANDLERS POR MÉTODO ---

  // ✅ Registrar asistencia
  if (req.method === "POST") {
    try {
      let body = "";
      await new Promise((resolve) => {
        req.on("data", (c) => (body += c));
        req.on("end", resolve);
      });
      const { cedula, pin } = JSON.parse(body || "{}");

      if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });
      if (!cedula) return res.status(400).json({ ok: false, error: "Cédula requerida" });

      const db = getDB();
      const item = db[cedula];
      if (!item) return res.status(404).json({ ok: false, error: "Cédula no encontrada en data.json" });

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

      await redisPOST(`hset/${HASH}/${cedula}`, JSON.stringify(record));
      return res.json({ ok: true, data: record });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ✅ Obtener lista
  if (req.method === "GET" && req.url.includes("list")) {
    const query = new URL(req.url, `http://${req.headers.host}`);
    const pin = query.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).json({ ok: false, error: "PIN inválido" });

    try {
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const map = {};
      for (let i = 0; i < arr.length; i += 2) {
        map[arr[i]] = JSON.parse(arr[i + 1]);
      }
      return res.json({ ok: true, items: map });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ✅ Exportar CSV
  if (req.method === "GET" && req.url.includes("export")) {
    const query = new URL(req.url, `http://${req.headers.host}`);
    const pin = query.searchParams.get("pin");
    if (pin !== "0808") return res.status(401).send("PIN inválido");

    try {
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const rows = [["cedula", "nombre", "cargo", "antiguedad", "hora"]];
      for (let i = 0; i < arr.length; i += 2) {
        const obj = JSON.parse(arr[i + 1]);
        rows.push([
          arr[i],
          obj.nombre || "",
          obj.cargo || "",
          obj.antiguedad || "",
          obj.hora || "",
        ]);
      }
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=asistencia.csv");
      return res.end(csv);
    } catch (e) {
      return res.status(500).send("Error exportando CSV");
    }
  }

  // 👇 Si nada de lo anterior coincide
  return res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}
