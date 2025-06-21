// /api/binance-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url || !url.startsWith("https://fapi.binance.com/")) {
    res.status(400).json({ error: "Bad request" });
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "Proxy error", details: String(e) });
  }
}
