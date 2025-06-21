const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const tickers = await tickerResp.json();

    // NUEVO: LOG Y CHEQUEO
    console.log("BINANCE RAW:", tickers);

    if (!Array.isArray(tickers)) {
      return res.status(500).json({success: false, error: 'Binance API did not return an array', raw: tickers });
    }

    // Tu código normal aquí...
    // ...

  } catch (e) {
    res.status(500).json({success: false, error: e.message});
  }
}
