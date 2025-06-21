// api/binance.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const STABLES = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USDP', 'GUSD', 'USDN'];
const TOP_LIMIT = 50;
const INTERVAL = "5m";
const EMA_PERIOD = 28;
const RSI_PERIOD = 14;

function ema(arr, period) {
  let k = 2 / (period + 1);
  return arr.reduce((a, v, i) => i ? v * k + a * (1 - k) : v, 0);
}
function rsi(arr, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i < arr.length; i++) {
    let diff = arr[i] - arr[i-1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period || 1e-6, rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function getPhase(score) {
  if (score <= 3) return '🔴 Oversold';
  if (score < 4.9) return '🔴 Bearish Incline';
  if (score < 6) return '🟠 Accumulation';
  if (score < 8.1) return '🟡 Bullish Incline';
  return '🟢 Overbought';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const tickerResp = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    let tickers = await tickerResp.json();

    // Filtra y ordena
    tickers = tickers.filter(t => 
      !STABLES.some(s => t.symbol.endsWith(s) && t.symbol !== "BTCUSDT") && 
      t.symbol.endsWith('USDT')
    );
    tickers = tickers.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, TOP_LIMIT);

    let results = [];
    for (let t of tickers) {
      let symbol = t.symbol;
      try {
        let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${INTERVAL}&limit=100`;
        let klineRes = await fetch(url);
        let klines = await klineRes.json();
        if (!Array.isArray(klines) || klines.length < EMA_PERIOD + 2) continue;
        let closes = klines.map(x => parseFloat(x[4]));
        let ema28 = ema(closes.slice(-EMA_PERIOD-1), EMA_PERIOD);
        let rsi14 = rsi(closes.slice(-RSI_PERIOD-1), RSI_PERIOD);
        let lastPrice = parseFloat(t.lastPrice);

        // Domingo
        let minSunday = Infinity, maxSunday = -Infinity, latestSunday = 0;
        klines.forEach(arr => {
          let ts = arr[0]; let date = new Date(ts);
          if (date.getUTCDay() === 0 && date.getTime() > latestSunday) latestSunday = date.setUTCHours(0,0,0,0);
        });
        klines.forEach(arr => {
          let ts = arr[0]; let date = new Date(ts);
          if (date.getUTCDay() === 0 && date.setUTCHours(0,0,0,0) === latestSunday) {
            let low = parseFloat(arr[3]), high = parseFloat(arr[2]);
            if (low < minSunday) minSunday = low;
            if (high > maxSunday) maxSunday = high;
          }
        });
        if (minSunday === Infinity) minSunday = Math.min(...klines.map(a => parseFloat(a[3])));
        if (maxSunday === -Infinity) maxSunday = Math.max(...klines.map(a => parseFloat(a[2])));

        // Score
        let score = 1;
        if (lastPrice > minSunday) score += 3;
        if (lastPrice > ema28) score += 2;
        if (rsi14 > 55) score += 2;
        if (lastPrice < ema28) score -= 2;
        if (rsi14 < 45) score -= 2;
        if (lastPrice > maxSunday) score += 2;
        if (lastPrice < minSunday) score -= 2;
        if (lastPrice <= minSunday && score > 5) score = 5;
        score = Math.max(1, Math.min(10, score));
        let phase = getPhase(score);

        results.push({
          symbol,
          lastPrice: lastPrice.toFixed(6),
          score,
          phase
        });
      } catch(e) {
        // Error individual de símbolo, ignora y sigue con los demás
        continue;
      }
    }
    res.status(200).json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
