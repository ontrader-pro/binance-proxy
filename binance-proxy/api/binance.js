// api/binance.js (para Vercel serverless backend)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    // Petición a la API de Binance
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const tickers = await tickerResp.json();
    console.log("BINANCE RAW:", Array.isArray(tickers) ? `OK, length: ${tickers.length}` : tickers);

    // Valida si recibiste una lista, sino devuelve error
    if (!Array.isArray(tickers)) {
      return res.status(500).json({success: false, error: 'Binance no devolvió una lista', raw: tickers});
    }

    // Stablecoins a excluir
    const stables = ['USDT', 'BUSD', 'TUSD', 'USDC', 'DAI', 'USDP', 'GUSD', 'USDN'];
    // Solo pares USDT y que NO empiecen por nombre de stablecoin
    let filtered = tickers
      .filter(t =>
        t.symbol.endsWith('USDT') &&
        !stables.some(s => t.symbol.startsWith(s) && t.symbol !== 'BTCUSDT')
      )
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);

    // Formatea los campos
    filtered = filtered.map(t => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      quoteVolume: t.quoteVolume
    }));

    res.status(200).json({success: true, data: filtered});
  } catch (e) {
    res.status(500).json({success: false, error: e.message});
  }
}
