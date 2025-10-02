import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, "..", "public")));

const DATA_PATH = path.join(__dirname, "..", "src", "data.json");
function getDB() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); }
  catch { return {}; }
}

function recognitionClass(rec = "") {
  const r = rec.toLowerCase();
  if (r.includes("empleado del mes")) return "rec-rojo";
  if (r.includes("trayectoria")) return "rec-verde";
  if (r.includes("especial")) return "rec-azul";
  return "";
}

app.get("/buscar", (req, res) => {
  const cedula = String(req.query.cedula || "").trim();
  const db = getDB();
  const item = db[cedula];
  if (!item) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true, data: { cedula, ...item } });
});

app.get("/empleado/:cedula", (req, res) => {
  const { cedula } = req.params;
  const db = getDB();
  const item = db[cedula];

  const imgUrl = `/images/${cedula}.webp`;
  const siteOrigin = "https://leyendas-del-tiempo.vercel.app";

  if (!item) {
    return res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Leyendas del Tiempo – ${cedula}</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body class="layout">
  <header class="header">
    <img src="/brand/logo-cencosud.webp" alt="Leyendas del Tiempo" class="logo" />
    <h1 class="title">No encontramos datos para la cédula ${cedula}</h1>
  </header>
  <main class="panel">
    <p>Verifica el número o regresa al <a href="/">buscador</a>.</p>
  </main>
</body>
</html>`);
  }

  const clase = recognitionClass(item.reconocimiento || "");
  const qrTarget = `${siteOrigin}/empleado/${cedula}`;

  res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Leyendas del Tiempo – ${item.nombre}</title>
<link rel="stylesheet" href="/style.css" />
<meta name="theme-color" content="#004B8D" />
</head>
<body class="layout">
  <div class="container">
    <div class="frame ${clase}">
      <div class="frame__header">
        <img src="/brand/logo-cencosud.webp" alt="Leyendas del Tiempo" class="frame__logo" />
        <h2 class="frame__title">Reconocimiento</h2>
      </div>

      <div class="photo">
        <img src="${imgUrl}" alt="Foto de ${item.nombre}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 600%22><rect width=%22400%22 height=%22600%22 fill=%22%2300213f%22/><text x=%2220%22 y=%22320%22 fill=%22%23fff%22 font-size=%2232%22>Sin foto</text></svg>'" />
      </div>

      <div class="info">
        <div><strong>${item.nombre}</strong></div>
        <div>Antigüedad: ${item.antiguedad || "—"}</div>
        <div>${item.reconocimiento || ""}</div>
      </div>

      <div class="ribbon"></div>
    </div>

    <div class="qr">
      <img src="/api/qr?text=${encodeURIComponent(qrTarget)}" alt="QR para abrir en tu celular" />
    </div>

    <div class="actions">
      <a class="btn" href="${imgUrl}" download="${cedula}.webp">Descargar solo la foto</a>
      <a class="btn btn--ghost" href="/">Volver al buscador</a>
    </div>
  </div>
</body>
</html>`);
});

// ================== VALIDADOR DETALLADO ==================
import os from "os";

// Utilidad: verifica si existe la imagen en /public/images/<cedula>.webp
function hasImage(cedula) {
  const imgPath = path.join(__dirname, "..", "public", "images", `${cedula}.webp`);
  try { return fs.existsSync(imgPath); } catch { return false; }
}

app.get("/validador", (req, res) => {
  const db = getDB();
  const items = Object.entries(db).map(([cedula, data]) => {
    const exists = hasImage(cedula);
    return {
      cedula,
      nombre: data?.nombre || "",
      antiguedad: data?.antiguedad || "",
      cargo: data?.cargo || "",
      tieneImagen: exists
    };
  });

  const total = items.length;
  const conImagen = items.filter(i => i.tieneImagen).length;
  const sinImagen = total - conImagen;

  const rowsHTML = items
    .map(
      it => `
      <tr class="${it.tieneImagen ? "row-ok" : "row-bad"}" 
          data-row="${[it.cedula, it.nombre, it.antiguedad, it.cargo].join(" ").toLowerCase()}" 
          data-hasimg="${it.tieneImagen}">
        <td><strong>${it.cedula}</strong></td>
        <td>${it.nombre || "<span class='small'>—</span>"}</td>
        <td>${it.antiguedad || "<span class='small'>—</span>"}</td>
        <td>${it.cargo || "<span class='small'>—</span>"}</td>
        <td>${it.tieneImagen ? `<span class="badge ok">✅ Con imagen</span>` : `<span class="badge bad">❌ Falta imagen</span>`}</td>
        <td class="right">
          <a class="btn btn--ghost" href="/empleado/${it.cedula}" target="_blank">Ver tarjeta</a>
          ${it.tieneImagen ? `<a class="btn" href="/images/${it.cedula}.webp" target="_blank" download="${it.cedula}.webp">Abrir foto</a>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const templatePath = path.join(__dirname, "..", "public", "validador-template.html");
  let html = fs.readFileSync(templatePath, "utf8");

  html = html.replace("{{TOTAL}}", total);
  html = html.replace("{{CON_IMAGEN}}", conImagen);
  html = html.replace("{{SIN_IMAGEN}}", sinImagen);
  html = html.replace("{{ROWS}}", rowsHTML);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});

export default app;

// 👉 Fallback para la página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
