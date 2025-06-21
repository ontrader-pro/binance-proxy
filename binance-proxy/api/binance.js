// api/binance.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    console.log("[1] Solicitando tickers a Binance...");
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const text = await tickerResp.text();
    console.log("[2] Respuesta cruda recibida (primeros 400 chars):", text.slice(0,400));
    let tickers;
    try {
      tickers = JSON.parse(text);
      console.log("[3] JSON.parse correcto, tipo:", typeof tickers, "Es array:", Array.isArray(tickers), "Total:", Array.isArray(tickers) ? tickers.length : "-");
    } catch (e) {
      console.error("[ERROR] JSON parse error:", e, "\n[DATA]:", text.slice(0,400));
      return res.status(500).json({success: false, error: "Binance returned invalid JSON", body: text});
    }
    if (!Array.isArray(tickers)) {
      // log and return what Binance sent
      console.error("[ERROR] BINANCE RAW, NO ARRAY:", tickers);
      return res.status(500).json({success: false, error: "Binance did not return an array", body: tickers});
    }
    const stables = ['USDT', 'BUSD', 'TUSD', 'USDC', 'DAI', 'USDP', 'GUSD', 'USDN'];
    let filtered;
    try {
      console.log("[4] Filtrando y ordenando tickers...");
      filtered = tickers
        .filter(t => t.symbol && t.symbol.endsWith('USDT') && !stables.some(s => t.symbol.startsWith(s)))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 50);
      console.log("[5] Filtrados:", filtered.length, filtered.slice(0,3).map(t=>t.symbol).join(", "));
    } catch (e) {
      console.error("[ERROR] Filtrado/orden de tickers:", e, tickers.slice ? tickers.slice(0,3) : tickers);
      return res.status(500).json({success: false, error: "Filtrado/ordenación falló", detail: e.message});
    }

    filtered = filtered.map(t => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      quoteVolume: t.quoteVolume
    }));
    console.log("[6] Enviando respuesta OK:", filtered.length, "símbolos.");

    res.status(200).json({success: true, data: filtered});
  } catch (e) {
    console.error("[ERROR GLOBAL]", e);
    res.status(500).json({success: false, error: e.message, stack: e.stack});
  }
}
