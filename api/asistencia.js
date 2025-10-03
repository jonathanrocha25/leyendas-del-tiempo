import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default async function handler(req, res) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const DATA_PATH = path.join(__dirname, "..", "src", "data.json");
    const db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

    console.log("✅ data.json cargado correctamente:", Object.keys(db).length, "registros");

    return res.json({ ok: true, keys: Object.keys(db).length });
  } catch (e) {
    console.error("❌ Error leyendo data.json:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
