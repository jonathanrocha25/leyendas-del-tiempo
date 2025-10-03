import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default async function handler(req, res) {
  console.log("👉 Nueva solicitud recibida:", req.method, req.url);

  // 🔑 Variables de conexión a Redis
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("❌ Variables de entorno KV no configuradas");
    return res.status(500).json({ ok: false, error: "KV no configurado" });
  }

  // 🔧 Funciones para interactuar con Redis
  async function redisGET(path) {
    const r = await fetch(`${url}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
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

  const HASH = "attendance";

  // 📁 Cargar base de empleados desde src/data.json
  let db = {};
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const DATA_PATH = path.join(__dirname, "..", "src", "data.json");
    db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    console.log("📁 data.json cargado correctamente. Total registros:", Object.keys(db).length);
  } catch (e) {
    console.error("❌ Error leyendo data.json:", e.message);
    return res.status(500).json({ ok: false, error: "No se pudo leer data.json" });
  }

  // 📌 Registrar asistencia
  if (req.method === "POST") {
    try {
      let raw = "";
      await new Promise((resolve) => {
        req.on("data", (c) => (raw += c));
        req.on("end", resolve);
      });

      const { cedula } = JSON.parse(raw || "{}");
      console.log("📨 Datos recibidos:", { cedula });

      if (!cedula) return res.status(400).json({ ok: false, error: "Cédula requerida" });

      const item = db[cedula];
      if (!item) {
        console.warn("⚠️ Cédula no encontrada en data.json:", cedula);
        return res.status(404).json({ ok: false, error: "Cédula no encontrada en data.json" });
      }

      const existente = await redisGET(`hget/${HASH}/${cedula}`);
      if (existente) {
        console.log("ℹ️ Ya registrado anteriormente:", cedula);
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
      console.log("✅ Asistencia registrada:", record);
      return res.json({ ok: true, data: record });
    } catch (e) {
      console.error("❌ Error registrando asistencia:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // 📜 Obtener lista de asistencia
  if (req.method === "GET" && req.url.includes("list")) {
    try {
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const map = {};
      for (let i = 0; i < arr.length; i += 2) {
        map[arr[i]] = JSON.parse(arr[i + 1]);
      }
      return res.json({ ok: true, items: map });
    } catch (e) {
      console.error("❌ Error obteniendo lista:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // 📤 Exportar asistencia en CSV
  if (req.method === "GET" && req.url.includes("export")) {
    try {
      const arr = await redisGET(`hgetall/${HASH}`) || [];
      const rows = [["cedula", "nombre", "cargo", "antiguedad", "hora"]];
      for (let i = 0; i < arr.length; i += 2) {
        const obj = JSON.parse(arr[i + 1]);
        rows.push([arr[i], obj.nombre || "", obj.cargo || "", obj.antiguedad || "", obj.hora || ""]);
      }
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=asistencia.csv");
      return res.end(csv);
    } catch (e) {
      console.error("❌ Error exportando CSV:", e.message);
      return res.status(500).send("Error exportando CSV");
    }
  }

  return res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}
