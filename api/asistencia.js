import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default async function handler(req, res) {
  console.log("👉 Nueva solicitud:", req.method, req.url);

  // 🔑 Variables Redis
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return res.status(500).json({ ok: false, error: "KV no configurado" });
  }

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
  async function redisDEL(path, method = "POST") {
  const r = await fetch(`${url}/${path}`, {
    method: method,
    headers: { Authorization: `Bearer ${token}` }
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}


  const HASH = "attendance";

  // 📁 Cargar base de datos
  let db = {};
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const DATA_PATH = path.join(__dirname, "..", "src", "data.json");
    db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (e) {
    console.error("❌ Error leyendo data.json:", e.message);
    return res.status(500).json({ ok: false, error: "No se pudo leer data.json" });
  }

  // 📥 Registrar asistencia
  if (req.method === "POST") {
    try {
      let raw = "";
      await new Promise(resolve => { req.on("data", c => raw += c); req.on("end", resolve); });
      const { cedula } = JSON.parse(raw || "{}");
      if (!cedula) return res.status(400).json({ ok: false, error: "Cédula requerida" });

      const item = db[cedula];
      if (!item) return res.status(404).json({ ok: false, error: "Cédula no encontrada en data.json" });

      const existente = await redisGET(`hget/${HASH}/${cedula}`);
      if (existente) return res.json({ ok: true, yaRegistrado: true, data: JSON.parse(existente) });

      const record = { cedula, nombre: item.nombre || "", cargo: item.cargo || "", antiguedad: item.antiguedad || "", hora: new Date().toISOString() };
      await redisPOST(`hset/${HASH}/${cedula}`, JSON.stringify(record));
      return res.json({ ok: true, data: record });
    } catch (e) {
      console.error("❌ Error registrando:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // 📜 Obtener lista
  if (req.method === "GET" && req.url.includes("list")) {
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

  // 📤 Exportar CSV
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
      return res.status(500).send("Error exportando CSV");
    }
  }

  // 🗑️ Eliminar TODOS los registros
if (req.method === "DELETE" && req.url.includes("clear")) {
  try {
    await redisDEL(`del/${HASH}`, "POST"); // 👈 usar POST
    return res.json({ ok: true, cleared: true });
  } catch (e) {
    console.error("❌ Error eliminando todos los registros:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}


  // 🗑️ Eliminar un registro específico
if (req.method === "DELETE" && req.url.includes("cedula=")) {
  try {
    const query = new URL(req.url, `http://${req.headers.host}`);
    const cedula = query.searchParams.get("cedula");
    if (!cedula) return res.status(400).json({ ok: false, error: "Cédula requerida" });

    await redisDEL(`hdel/${HASH}/${cedula}`, "POST"); // 👈 usar POST en lugar de DELETE
    return res.json({ ok: true, deleted: cedula });
  } catch (e) {
    console.error("❌ Error eliminando asistencia:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}


  return res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}
