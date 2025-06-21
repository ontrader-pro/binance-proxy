// /api/binance-proxy.js

export default async function handler(req, res) {
  // Manejo robusto de CORS (preflight + requests normales)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extraer y validar URL
  const { url } = req.query;
  if (!url || !url.startsWith("https://fapi.binance.com/")) {
    res.status(400).json({ error: "Bad request: Parámetro 'url' inválido o ausente" });
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "Proxy error", details: String(e) });
  }
}
