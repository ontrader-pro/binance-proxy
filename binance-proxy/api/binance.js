// binance.js (ESM - usa export/import)
// Soporta Vercel proxy: https://binance-proxy-swart.vercel.app/api/binance-proxy?url=URL_AQUI
// y filtra los datos de Futuros, excluye stablecoins

const STABLES = ["USDT", "USDC", "BUSD", "TUSD", "FDUSD", "DAI", "PAX", "GUSD"];
const SYMBOL_LIMIT = 100;

// Cambia aquí tu proxy base si lo deseas
const PROXY_BASE = "https://binance-proxy-swart.vercel.app/api/binance-proxy?url=";
const BINANCE_API = "https://fapi.binance.com";

function isStable(symbol) {
  return STABLES.some(st => symbol.endsWith(st));
}

export async function fetchJson(url) {
  // Aplica proxy a la url completa
  const resp = await fetch(PROXY_BASE + encodeURIComponent(url));
  if (!resp.ok) throw new Error("Status " + resp.status);
  return resp.json();
}

export async function getTopSymbols() {
  // Solo contratos perpetuos y mayor open interest, sin stablecoins
  const data = await fetchJson(BINANCE_API + "/fapi/v1/ticker/24hr");
  return data.filter(d => !isStable(d.symbol) && d.contractType === "PERPETUAL")
    .sort((a, b) => parseFloat(b.openInterest) - parseFloat(a.openInterest))
    .slice(0, SYMBOL_LIMIT)
    .map(d => d.symbol);
}

export async function getKlines(symbol, interval, limit) {
  const url = `${BINANCE_API}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const arr = await fetchJson(url);
  return arr.map(a => ({
    time: +a[0],
    open: +a[1],
    high: +a[2],
    low: +a[3],
    close: +a[4],
    volume: +a[5]
  }));
}

export function getSundayMinMax(daily) {
  for (let i = daily.length - 1; i >= 0; i--) {
    const dt = new Date(daily[i].time);
    if (dt.getUTCDay() === 0) return { min: daily[i].low, max: daily[i].high };
  }
  // Si no hay domingo, retorna el último día disponible
  return { min: daily[0].low, max: daily[0].high };
}

export function calcEMA(prices, period = 28) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

export function calcRSI(prices, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (gains + losses === 0) return 50;
  const avgGain = gains / period, avgLoss = losses / period || 1e-8;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Score y fase - misma lógica que tienes, se puede modularizar más si quieres
export function calcScorePhases({ lastPrice, minSun, maxSun, ema15, rsi15, ema5, rsi5, rsi4 }) {
  let score = 1;
  if (lastPrice > minSun) score += 3;
  if (lastPrice > maxSun) score += 2;
  if (rsi15 > 50 && lastPrice > ema15) score += 2;
  if (rsi15 < 50 && lastPrice < ema15) score -= 2;
  if (rsi5 > 70 && lastPrice > ema5) score += 1;
  if (rsi5 < 30 && lastPrice < ema5) score -= 1;
  if (rsi4 < 15) score += 0.5;
  if (rsi4 > 85) score -= 0.5;
  score = Math.max(1, Math.min(10, score));

  let phase = '';
  if (score <= 3.0) phase = '🔴 Oversold';
  else if (score < 4.9) phase = '🔴 Bearish Incline';
  else if (score < 6.0) phase = '🟠 Accumulation';
  else if (score < 8.1) phase = '🟡 Bullish Incline';
  else phase = '🟢 Overbought';

  return { score, phase };
}
