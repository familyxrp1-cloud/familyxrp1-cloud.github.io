require('dotenv').config();
const fetch = require('node-fetch');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/v1';
const XRPL_WS_HTTP = 'https://xrplcluster.com';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, { timeout: 10000, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[data] fetch failed ${url}: ${err.message}`);
    return null;
  }
}

async function getXrpPrice() {
  const data = await safeFetch(
    `${COINGECKO_BASE}/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
  );
  if (!data?.ripple) return null;
  const r = data.ripple;
  return {
    price: r.usd,
    change24h: r.usd_24h_change,
    marketCap: r.usd_market_cap,
    volume24h: r.usd_24h_vol,
  };
}

async function getXrpMarketData() {
  const data = await safeFetch(
    `${COINGECKO_BASE}/coins/ripple?localization=false&tickers=false&community_data=false&developer_data=false`
  );
  if (!data) return null;
  const m = data.market_data;
  return {
    price: m.current_price.usd,
    ath: m.ath.usd,
    athDate: m.ath_date.usd,
    change7d: m.price_change_percentage_7d,
    change30d: m.price_change_percentage_30d,
    rank: data.market_cap_rank,
    circulatingSupply: m.circulating_supply,
    totalSupply: m.total_supply,
  };
}

async function getTopXrpNews() {
  const key = process.env.CRYPTOPANIC_API_KEY;
  if (!key) {
    // Fall back to public CryptoPanic endpoint (no auth, limited)
    const data = await safeFetch(
      `${CRYPTOPANIC_BASE}/posts/?currencies=XRP&filter=news&public=true`
    );
    return data?.results?.slice(0, 3) ?? [];
  }
  const data = await safeFetch(
    `${CRYPTOPANIC_BASE}/posts/?auth_token=${key}&currencies=XRP&filter=news&kind=news`
  );
  return data?.results?.slice(0, 3) ?? [];
}

async function getPadTokenData() {
  // $PAD on XRPL — search Dexscreener for PAD/XRP pairs
  const data = await safeFetch(`${DEXSCREENER_BASE}/search?q=PAD%20XRP`);
  if (!data?.pairs) return null;

  // Find the most liquid PAD pair on XRPL
  const padPairs = data.pairs.filter(
    (p) =>
      p.chainId === 'xrpl' &&
      (p.baseToken.symbol === 'PAD' || p.quoteToken.symbol === 'PAD')
  );
  if (!padPairs.length) return null;

  const best = padPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  return {
    price: parseFloat(best.priceUsd ?? 0),
    priceNative: best.priceNative,
    volume24h: best.volume?.h24 ?? 0,
    change24h: best.priceChange?.h24 ?? 0,
    change6h: best.priceChange?.h6 ?? 0,
    liquidity: best.liquidity?.usd ?? 0,
    txns24h: (best.txns?.h24?.buys ?? 0) + (best.txns?.h24?.sells ?? 0),
    buys24h: best.txns?.h24?.buys ?? 0,
    sells24h: best.txns?.h24?.sells ?? 0,
    dexUrl: best.url ?? '',
    pairAddress: best.pairAddress,
  };
}

async function getXrplNetworkStats() {
  // Query XRPL ledger info via HTTP JSON-RPC
  const data = await safeFetch(XRPL_WS_HTTP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'server_info', params: [{}] }),
  });
  if (!data?.result?.info) return null;
  const info = data.result.info;
  return {
    ledgerIndex: info.validated_ledger?.seq,
    txPerSecond: info.load_factor,
    completeLedgers: info.complete_ledgers,
    serverState: info.server_state,
  };
}

async function getXrpVsBtcEth() {
  const data = await safeFetch(
    `${COINGECKO_BASE}/simple/price?ids=ripple,bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`
  );
  if (!data) return null;
  return {
    xrp: { price: data.ripple?.usd, change: data.ripple?.usd_24h_change },
    btc: { price: data.bitcoin?.usd, change: data.bitcoin?.usd_24h_change },
    eth: { price: data.ethereum?.usd, change: data.ethereum?.usd_24h_change },
  };
}

module.exports = {
  getXrpPrice,
  getXrpMarketData,
  getTopXrpNews,
  getPadTokenData,
  getXrplNetworkStats,
  getXrpVsBtcEth,
};
