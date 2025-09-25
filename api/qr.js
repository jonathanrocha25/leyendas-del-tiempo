import QRCode from "qrcode";

export default async function handler(req, res) {
  try {
    const text = String(req.query.text || "");
    if (!text) {
      res.status(400).send("Falta parámetro 'text'");
      return;
    }
    res.setHeader("Content-Type", "image/png");
    await QRCode.toFileStream(res, text, {
      type: "png",
      width: 512,
      errorCorrectionLevel: "M",
      margin: 1
    });
  } catch (e) {
    res.status(500).send("Error generando QR");
  }
}
