// tools/csv-to-json.js
import fs from "fs";
import path from "path";

const INPUT_CSV = path.join(process.cwd(), "empleados.csv");
const OUTPUT_JSON = path.join(process.cwd(), "src", "data.json");

function csvToJson(csv) {
  const [headerLine, ...lines] = csv.trim().split("\n");
  const headers = headerLine.split(",").map(h => h.trim());

  const data = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = line.split(",").map(v => v.trim());
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    if (!row.cedula) continue;
    data[row.cedula] = {
      nombre: row.nombre || "",
      antiguedad: row.antiguedad || "",
      cargo: row.cargo || ""
    };
  }
  return data;
}

try {
  const csv = fs.readFileSync(INPUT_CSV, "utf8");
  const json = csvToJson(csv);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2), "utf8");
  console.log(`✅ Archivo convertido con éxito: ${OUTPUT_JSON}`);
  console.log(`ℹ️ Total registros: ${Object.keys(json).length}`);
} catch (err) {
  console.error("❌ Error al convertir CSV:", err.message);
  process.exit(1);
}
