const {
  getXrpPrice,
  getXrpMarketData,
  getTopXrpNews,
  getPadTokenData,
  getXrplNetworkStats,
  getXrpVsBtcEth,
} = require('./data');

function fmt(n, decimals = 4) {
  if (n == null) return '—';
  return parseFloat(n).toFixed(decimals);
}

function fmtBig(n) {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function arrow(change) {
  if (change == null) return '';
  return change >= 0 ? '▲' : '▼';
}

function pct(n) {
  if (n == null) return '—';
  return `${arrow(n)} ${Math.abs(n).toFixed(2)}%`;
}

// ── Tweet builders ────────────────────────────────────────────────────────────

async function morningPriceUpdate() {
  const d = await getXrpPrice();
  if (!d) return null;
  const mood = d.change24h >= 0 ? '📈' : '📉';
  return [
    `${mood} Good morning! #XRP price check`,
    ``,
    `💰 Price: $${fmt(d.price, 4)}`,
    `📊 24h: ${pct(d.change24h)}`,
    `💎 Market Cap: ${fmtBig(d.marketCap)}`,
    `📦 Volume (24h): ${fmtBig(d.volume24h)}`,
    ``,
    `#Ripple #Crypto #LedgerPad $PAD`,
  ].join('\n');
}

async function marketCompare() {
  const d = await getXrpVsBtcEth();
  if (!d) return null;
  const xrpArrow = d.xrp.change >= 0 ? '🟢' : '🔴';
  const btcArrow = d.btc.change >= 0 ? '🟢' : '🔴';
  const ethArrow = d.eth.change >= 0 ? '🟢' : '🔴';
  return [
    `⚡ Market snapshot — how is $XRP doing vs the rest?`,
    ``,
    `${xrpArrow} #XRP   $${fmt(d.xrp.price, 4)}  ${pct(d.xrp.change)}`,
    `${btcArrow} #BTC   $${fmtBig(d.btc.price).replace('$', '')}  ${pct(d.btc.change)}`,
    `${ethArrow} #ETH   $${fmtBig(d.eth.price).replace('$', '')}  ${pct(d.eth.change)}`,
    ``,
    `#XRPArmy #Ripple #LedgerPad`,
  ].join('\n');
}

async function padTokenUpdate() {
  const d = await getPadTokenData();
  if (!d) {
    return [
      `🌊 $PAD — the LedgerPad token on the #XRPL`,
      ``,
      `Track it, stake it, use it.`,
      `LedgerPad is building the future of DeFi on XRP Ledger.`,
      ``,
      `🔗 ledgerpad.net`,
      ``,
      `#XRP #XRPL #LedgerPad #PAD`,
    ].join('\n');
  }
  const mood = d.change24h >= 0 ? '📈' : '📉';
  const bullBear = d.buys24h > d.sells24h ? '🟢 Buy pressure' : '🔴 Sell pressure';
  return [
    `${mood} $PAD token update — #XRPL`,
    ``,
    `💰 Price: $${fmt(d.price, 6)}`,
    `📊 24h: ${pct(d.change24h)}`,
    `💧 Liquidity: ${fmtBig(d.liquidity)}`,
    `📦 Volume (24h): ${fmtBig(d.volume24h)}`,
    `🔄 Txns: ${d.txns24h.toLocaleString()} | ${bullBear}`,
    ``,
    `🔗 ledgerpad.net | #LedgerPad #XRP #DeFi`,
  ].join('\n');
}

async function xrpNewsFlash() {
  const news = await getTopXrpNews();
  if (!news.length) {
    return [
      `📰 Stay up to date with all things #XRP`,
      ``,
      `Follow for daily price updates, token news, and #XRPL ecosystem highlights.`,
      ``,
      `Built on the #XRPLedger — LedgerPad is your home for on-chain DeFi.`,
      `🔗 ledgerpad.net`,
      ``,
      `#Ripple #XRPArmy #LedgerPad`,
    ].join('\n');
  }
  const top = news[0];
  return [
    `📰 #XRP News Flash`,
    ``,
    `"${top.title}"`,
    ``,
    `🔗 ${top.url}`,
    ``,
    `#Ripple #XRPArmy #Crypto #LedgerPad`,
  ].join('\n');
}

async function volumeCheck() {
  const d = await getXrpPrice();
  if (!d) return null;
  const volBillion = (d.volume24h / 1e9).toFixed(2);
  const highVolume = d.volume24h > 1e9;
  const emoji = highVolume ? '🔥' : '💤';
  return [
    `${emoji} #XRP 24h volume check`,
    ``,
    `📦 Volume: ${fmtBig(d.volume24h)}`,
    `💰 Price: $${fmt(d.price, 4)}`,
    `📊 Change: ${pct(d.change24h)}`,
    ``,
    highVolume
      ? `Volume is HOT — the market is moving!`
      : `Volume is cooling — accumulate wisely.`,
    ``,
    `#XRPArmy #Ripple #LedgerPad $PAD`,
  ].join('\n');
}

async function xrplNetworkTweet() {
  const net = await getXrplNetworkStats();
  const xrp = await getXrpPrice();
  if (!net && !xrp) return null;
  const lines = [
    `⚡ #XRPL Network Status`,
    ``,
  ];
  if (net?.ledgerIndex) lines.push(`📦 Latest ledger: #${net.ledgerIndex.toLocaleString()}`);
  if (xrp) {
    lines.push(`💰 $XRP: $${fmt(xrp.price, 4)} (${pct(xrp.change24h)})`);
  }
  lines.push(
    ``,
    `The XRP Ledger — fast, cheap, and carbon neutral.`,
    `LedgerPad builds on it so you can trade smarter.`,
    ``,
    `#XRP #Ripple #DeFi #LedgerPad`
  );
  return lines.join('\n');
}

async function marketCapRank() {
  const d = await getXrpMarketData();
  if (!d) return null;
  const week = d.change7d >= 0 ? '📈' : '📉';
  return [
    `🏆 #XRP market cap ranking`,
    ``,
    `📍 Rank: #${d.rank} globally`,
    `💰 Price: $${fmt(d.price, 4)}`,
    `${week} 7d: ${pct(d.change7d)}`,
    `📅 30d: ${pct(d.change30d)}`,
    `💎 ATH: $${fmt(d.ath, 4)}`,
    ``,
    `Still early. Still #XRPArmy.`,
    ``,
    `#Ripple #Crypto #LedgerPad $PAD`,
  ].join('\n');
}

async function padSpotlight() {
  const d = await getPadTokenData();
  const lines = [
    `🌊 #LedgerPad $PAD Spotlight`,
    ``,
    `The native token powering LedgerPad DeFi on #XRPL`,
    ``,
  ];
  if (d) {
    lines.push(
      `💰 Price: $${fmt(d.price, 6)}`,
      `📊 6h: ${pct(d.change6h)}`,
      `💧 Liquidity: ${fmtBig(d.liquidity)}`,
      ``
    );
  }
  lines.push(
    `✅ Low fees`,
    `✅ Fast settlements`,
    `✅ Built on XRP Ledger`,
    ``,
    `🔗 ledgerpad.net | #XRP #DeFi #PAD`
  );
  return lines.join('\n');
}

async function eveningWrapUp() {
  const d = await getXrpPrice();
  if (!d) return null;
  const dayEmoji = d.change24h >= 0 ? '✅ Green day' : '🔴 Red day';
  return [
    `🌙 #XRP evening wrap-up`,
    ``,
    `${dayEmoji} for $XRP`,
    ``,
    `💰 Price: $${fmt(d.price, 4)}`,
    `📊 24h: ${pct(d.change24h)}`,
    `💎 Market Cap: ${fmtBig(d.marketCap)}`,
    ``,
    `Tomorrow is another day. Stack sats — or stack XRP 😄`,
    ``,
    `#Ripple #XRPArmy #LedgerPad $PAD`,
  ].join('\n');
}

async function communityEngagement() {
  const d = await getXrpPrice();
  const price = d ? `$${fmt(d.price, 4)}` : 'flying';
  const prompts = [
    `What's your #XRP price target for end of year? Drop it below 👇`,
    `Are you bullish or bearish on $XRP right now? Vote in the comments 🗳️`,
    `How long have you been holding #XRP? Let us know below! 🙌`,
    `If #XRP hits $10, what's the first thing you do? 👇`,
    `What's your favorite #XRPL project right now? Reply with your picks!`,
  ];
  const prompt = prompts[new Date().getDate() % prompts.length];
  return [
    `💬 Community Check-in`,
    ``,
    `$XRP is currently at ${price}`,
    ``,
    prompt,
    ``,
    `#XRPArmy #Ripple #LedgerPad #PAD`,
  ].join('\n');
}

// Ordered schedule of tweet builders (10 per day, every ~2.4 hours)
const TWEET_SCHEDULE = [
  morningPriceUpdate,   // 06:00
  marketCompare,        // 08:00
  padTokenUpdate,       // 10:00
  xrpNewsFlash,         // 12:00
  volumeCheck,          // 13:30
  xrplNetworkTweet,     // 15:00
  marketCapRank,        // 16:30
  padSpotlight,         // 18:00
  eveningWrapUp,        // 20:00
  communityEngagement,  // 22:00
];

module.exports = { TWEET_SCHEDULE };
