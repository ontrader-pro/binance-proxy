// api/binance.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    // 1. Petición principal a Binance
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const text = await tickerResp.text();

    // 2. Si la respuesta es vacía
    if (!text || text.length < 2) {
      return res.status(502).json({
        success: false,
        error: "Binance empty response",
        binance_body: text
      });
    }

    // 3. Si la respuesta NO es un JSON array
    if (text[0] !== '[') {
      // Prueba si es JSON de error (objeto)
      try {
        const maybeObj = JSON.parse(text);
        return res.status(502).json({
          success: false,
          error: "Binance returned JSON, but not an array",
          binance_body: maybeObj
        });
      } catch {
        // Es HTML, string raro o error 5xx
        return res.status(502).json({
          success: false,
          error: "Binance did not return JSON array",
          binance_body: text
        });
      }
    }

    // 4. Parseo seguro (ya es array)
    let tickers;
    try {
      tickers = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Binance returned invalid JSON (array expected)",
        binance_body: text,
        parseError: e.message
      });
    }
    if (!Array.isArray(tickers)) {
      return res.status(502).json({
        success: false,
        error: "Binance did not return an array (after parse)",
        binance_body: tickers
      });
    }

    // 5. Filtro robusto de stablecoins y que tengan campos requeridos
    const stables = ['USDT', 'BUSD', 'TUSD', 'USDC', 'DAI', 'USDP', 'GUSD', 'USDN'];
    const isStable = sym => stables.some(st => sym === st || sym.endsWith(st));
    let filtered = tickers.filter(t =>
      t.symbol &&
      typeof t.symbol === "string" &&
      t.symbol.endsWith('USDT') &&
      !isStable(t.symbol.replace('USDT','')) // Ej: BTCUSDT -> BTC
    );

    // Si se vacía, alerta
    if (!filtered.length) {
      return res.status(502).json({
        success: false,
        error: "No USDT pairs found after filtering",
        tickers_count: tickers.length,
        sample: tickers.slice(0, 3)
      });
    }

    // 6. Ordena y deja top 50
    filtered = filtered
      .sort((a, b) => parseFloat(b.quoteVolume || 0) - parseFloat(a.quoteVolume || 0))
      .slice(0, 50)
      .map(t => ({
        symbol: t.symbol,
        lastPrice: t.lastPrice,
        priceChangePercent: t.priceChangePercent,
        quoteVolume: t.quoteVolume
      }));

    // 7. Respuesta final
    res.status(200).json({ success: true, data: filtered });

  } catch (e) {
    // Error JS/fetch/timeout
    res.status(500).json({
      success: false,
      error: e.message,
      stack: e.stack
    });
  }
};
