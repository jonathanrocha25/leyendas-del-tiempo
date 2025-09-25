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

process.on("uncaughtException", err => {
  console.error("❌ Error no capturado:", err);
});
process.on("unhandledRejection", err => {
  console.error("❌ Promesa no manejada:", err);
});


// API JSON (útil si quieres consumir los datos desde otra página o script)
app.get("/validador.json", (req, res) => {
  const db = getDB();
  const items = Object.entries(db).map(([cedula, data]) => {
    const exists = hasImage(cedula);
    return {
      cedula,
      nombre: data?.nombre || "",
      antiguedad: data?.antiguedad || "",
      reconocimiento: data?.reconocimiento || "",
      tieneImagen: exists
    };
  });

  const conImagen = items.filter(i => i.tieneImagen).length;
  const sinImagen = items.length - conImagen;

  res.json({
    ok: true,
    totales: { registros: items.length, conImagen, sinImagen },
    items
  });
});

// Página visual (bonita) del validador
res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Validador de Imágenes – Leyendas del Tiempo</title>
<style>
  :root{
    --bg:#0b2f5b; --card:#0e3a6d; --ok:#16a34a; --bad:#dc2626; --muted:#93c5fd; --text:#ffffff; --accent:#F7A600;
  }
  *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial;background:var(--bg);color:var(--text)}
  .wrap{max-width:1200px;margin:0 auto;padding:24px}
  h1{margin:0 0 8px 0;font-size:28px}
  .subtitle{opacity:.85;margin:0 0 16px 0}
  .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0 20px}
  .card{background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:14px;text-align:center}
  .card h3{margin:6px 0 4px 0;font-size:14px;opacity:.9}
  .card .n{font-size:26px;font-weight:800}
  .ok{color:var(--ok)} .bad{color:var(--bad)} .muted{color:var(--muted)}
  .tools{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 18px;align-items:center}
  .input{flex:1;min-width:250px;background:#0a2a52;border:1px solid rgba(255,255,255,.2);color:#fff;padding:12px 14px;border-radius:10px;outline:none}
  .btn{background:#fff;color:#0e2a4a;border:0;padding:12px 16px;border-radius:10px;font-weight:700;cursor:pointer}
  .btn--ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
  .toggle{background:var(--bad);color:#fff;font-weight:700;padding:12px 16px;border:0;border-radius:10px;cursor:pointer}
  .toggle.active{background:var(--ok)}
  table{width:100%;border-collapse:separate;border-spacing:0 8px}
  thead th{font-size:12px;text-transform:uppercase;opacity:.8;text-align:left;padding:6px 10px}
  tbody tr{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12)}
  tbody td{padding:12px 10px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12)}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;font-weight:700}
  .badge.ok{background:rgba(22,163,74,.15);color:var(--ok);border:1px solid rgba(22,163,74,.35)}
  .badge.bad{background:rgba(220,38,38,.15);color:var(--bad);border:1px solid rgba(220,38,38,.35)}
  .sticky{position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:5}
  .row-ok{outline:1px solid rgba(22,163,74,.25)}
  .row-bad{outline:1px solid rgba(220,38,38,.25)}
  .small{font-size:12px;opacity:.8}
  .right{display:flex;justify-content:flex-end;gap:8px}
  @media (max-width: 900px){ .cards{grid-template-columns:1fr 1fr} .right{justify-content:flex-start} }
  @media (max-width: 600px){ .cards{grid-template-columns:1fr} table{font-size:14px} td,th{padding:8px} }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Validador de Imágenes</h1>
    <p class="subtitle">Revisa qué registros del <strong>data.json</strong> tienen foto en <code>/public/images/&lt;cedula&gt;.webp</code>.</p>

    <div class="cards">
      <div class="card"><h3>Registros totales</h3><div class="n">${total}</div></div>
      <div class="card"><h3 class="ok">Con imagen</h3><div class="n ok">${conImagen}</div></div>
      <div class="card"><h3 class="bad">Faltantes</h3><div class="n bad">${sinImagen}</div></div>
    </div>

    <div class="tools sticky">
      <input id="q" type="search" class="input" placeholder="Buscar por cédula, nombre o reconocimiento..." />
      <button id="toggle" class="toggle">👀 Ver solo faltantes</button>
      <a class="btn btn--ghost" href="/">Volver al buscador</a>
      <a class="btn" href="/validador.json" target="_blank" rel="noopener">Ver JSON</a>
    </div>

    <table id="tbl">
      <thead>
        <tr>
          <th>Cédula</th>
          <th>Nombre</th>
          <th>Antigüedad</th>
          <th>Reconocimiento</th>
          <th>Estado</th>
          <th class="right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(it => `
          <tr class="${it.tieneImagen ? "row-ok" : "row-bad"}" data-row="${[
            it.cedula, it.nombre, it.antiguedad, it.reconocimiento
          ].join(" ").toLowerCase()}" data-hasimg="${it.tieneImagen}">
            <td><strong>${it.cedula}</strong></td>
            <td>${it.nombre || "<span class='small'>—</span>"}</td>
            <td>${it.antiguedad || "<span class='small'>—</span>"}</td>
            <td>${it.reconocimiento || "<span class='small'>—</span>"}</td>
            <td>
              ${it.tieneImagen
                ? `<span class="badge ok">✅ Con imagen</span>`
                : `<span class="badge bad">❌ Falta imagen</span>`
              }
            </td>
            <td class="right">
              <a class="btn btn--ghost" href="/empleado/${it.cedula}" target="_blank">Ver tarjeta</a>
              ${it.tieneImagen ? `<a class="btn" href="/images/${it.cedula}.webp" target="_blank" download="${it.cedula}.webp">Abrir foto</a>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

<script>
// 🔎 Filtro por texto
const q = document.getElementById("q");
const rows = Array.from(document.querySelectorAll("tbody tr"));
q.addEventListener("input", () => {
  const v = q.value.trim().toLowerCase();
  rows.forEach(tr => {
    const ok = tr.getAttribute("data-row").includes(v);
    tr.style.display = ok ? "" : "none";
  });
});

// 👁️‍🗨️ Toggle: mostrar solo faltantes
const toggleBtn = document.getElementById("toggle");
let showOnlyMissing = false;

toggleBtn.addEventListener("click", () => {
  showOnlyMissing = !showOnlyMissing;
  toggleBtn.classList.toggle("active", showOnlyMissing);
  toggleBtn.textContent = showOnlyMissing ? "👀 Ver todos" : "👀 Ver solo faltantes";

  rows.forEach(tr => {
    const hasImg = tr.getAttribute("data-hasimg") === "true";
    if (showOnlyMissing && hasImg) {
      tr.style.display = "none";
    } else {
      const textMatch = tr.getAttribute("data-row").includes(q.value.trim().toLowerCase());
      tr.style.display = textMatch ? "" : "none";
    }
  });
});
</script>
</body>
</html>`);


export default app;

// 👉 Fallback para la página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
