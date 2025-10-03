import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default async function handler(req, res) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, "..", "src", "data.json");
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return res.json({ ok: true, keys: Object.keys(json).length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
