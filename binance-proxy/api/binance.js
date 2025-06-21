const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const text = await tickerResp.text();
    let tickers;
    try {
      tickers = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error:", text);
      return res.status(500).json({success: false, error: "Binance returned invalid JSON", body: text});
    }
    if (!Array.isArray(tickers)) {
      // log and return what Binance sent
      console.error("BINANCE RAW:", tickers);
      return res.status(500).json({success: false, error: "Binance did not return an array", body: tickers});
    }
    // ...tu código de filtrado...
    const stables = ['USDT', 'BUSD', 'TUSD', 'USDC', 'DAI', 'USDP', 'GUSD', 'USDN'];
    let filtered = tickers
      .filter(t => t.symbol.endsWith('USDT') && !stables.some(s => t.symbol.startsWith(s)))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);

    filtered = filtered.map(t => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      quoteVolume: t.quoteVolume
    }));

    res.status(200).json({success: true, data: filtered});
  } catch (e) {
    console.error("MAIN ERROR:", e);
    res.status(500).json({success: false, error: e.message});
  }
}
