'use strict';
const fetch = require('node-fetch');
const {
  saveOutcome, updateLabel12, updateLabel24, updateSeries,
  getPendingLabels, getPendingLabel12, getPendingLabel24,
  getPendingSnapshots,
} = require('./db');
const { getHolderCount } = require('./forensics');

const DEX_URL = 'https://api.dexscreener.com/latest/dex/tokens';

// ── Dexscreener fetch (no key needed, free) ───────────────────────────
async function getDexData(mint) {
  try {
    const res = await fetch(`${DEX_URL}/${mint}`, { timeout: 12000 });
    if (!res.ok) return null;
    const json = await res.json();
    const pairs = json.pairs || [];
    // Prefer pump.fun AMM pair, then Raydium, then any
    const pair = pairs.find(p => p.dexId === 'pumpswap')
      || pairs.find(p => p.dexId === 'raydium')
      || pairs[0];
    return pair || null;
  } catch {
    return null;
  }
}

// ── Outcome rules ─────────────────────────────────────────────────────
//
// rug  = price -95%+ from migration price within 48h,
//        OR insider cluster unwinds >80% (not trackable without trade streams, so
//        we use price signal as proxy for v1)
//
// win  = alive at 48h, price >= migration price, holders still growing
//        (approximated as: current price >= 80% of migration price)
//
// fade = everything else
//
function classifyOutcome(launch, pair) {
  const migrationPrice = launch.migration_price_usd;
  const currentPrice = pair ? parseFloat(pair.priceUsd || 0) : 0;
  const hoursAlive = launch.graduated_at
    ? (Date.now() - launch.graduated_at) / 3600000
    : 0;

  // No price data → fade
  if (!pair || !currentPrice || !migrationPrice) {
    return { outcome: 'fade', peakX: null, hoursAlive };
  }

  const ratio = currentPrice / migrationPrice;

  // Calculate peak from Dexscreener price changes
  const h24Change = parseFloat(pair.priceChange?.h24 || 0) / 100;
  const h6Change = parseFloat(pair.priceChange?.h6 || 0) / 100;
  const estimatedPeak = currentPrice * Math.max(1, 1 + h6Change, 1 + h24Change);
  const peakX = migrationPrice > 0 ? estimatedPeak / migrationPrice : null;

  // Rug: down >95% from migration price
  if (ratio < 0.05) {
    return { outcome: 'rug', peakX, hoursAlive };
  }

  // Win: price ≥ 80% of migration, liquidity still present
  const liquidity = parseFloat(pair.liquidity?.usd || 0);
  if (ratio >= 0.8 && liquidity > 5000) {
    return { outcome: 'win', peakX, hoursAlive };
  }

  // Fade: somewhere in between
  return { outcome: 'fade', peakX, hoursAlive };
}

// ── label pipeline steps ─────────────────────────────────────────────

async function runLabel12(now) {
  const due = getPendingLabel12(now);
  for (const launch of due) {
    const pair = await getDexData(launch.mint);
    const price = pair ? parseFloat(pair.priceUsd || 0) : 0;
    updateLabel12(launch.mint, price || null);
    if (price) {
      console.log(`[label 12h] ${launch.mint} price=$${price.toFixed(8)}`);
    }
    await sleep(400); // polite delay between requests
  }
}

async function runLabel24(now) {
  const due = getPendingLabel24(now);
  for (const launch of due) {
    const pair = await getDexData(launch.mint);
    const price = pair ? parseFloat(pair.priceUsd || 0) : 0;
    updateLabel24(launch.mint, price || null);
    await sleep(400);
  }
}

async function runLabel48(now) {
  const due = getPendingLabels(now);
  for (const launch of due) {
    const pair = await getDexData(launch.mint);
    const { outcome, peakX, hoursAlive } = classifyOutcome(launch, pair);

    const currentPrice = pair ? parseFloat(pair.priceUsd || 0) : 0;
    const peakPrice = Math.max(
      currentPrice,
      launch.peak_price_usd || 0,
      launch.migration_price_usd || 0
    );

    saveOutcome(launch.mint, {
      outcome,
      peak_x: peakX,
      migration_price_usd: launch.migration_price_usd,
      peak_price_usd: peakPrice || null,
      hours_alive: Math.round(hoursAlive * 10) / 10,
    });

    console.log(`[label 48h] ${launch.mint} → ${outcome} (${peakX?.toFixed(1)}x)`);
    await sleep(400);
  }
}

// ── holder series snapshots ───────────────────────────────────────────
async function runSnapshots(now) {
  const due = getPendingSnapshots(now);
  for (const launch of due) {
    try {
      const count = await getHolderCount(launch.mint);
      const existing = launch.series ? JSON.parse(launch.series) : [];
      const updated = [...existing, count];
      const snapshotCount = updated.length;

      // Next snapshot: +4h, but stop after 13 points (0..48h)
      const nextAt = snapshotCount < 13
        ? launch.graduated_at + snapshotCount * 4 * 3600000
        : null;

      updateSeries(launch.mint, updated, nextAt);
      console.log(`[snapshot] ${launch.mint} point ${snapshotCount}/13 = ${count} holders`);
    } catch (err) {
      console.warn(`[snapshot] error on ${launch.mint}:`, err.message);
    }
    await sleep(300);
  }
}

// ── main labeler loop (called every 5 minutes) ────────────────────────
async function tick() {
  const now = Date.now();
  try { await runLabel12(now); } catch (e) { console.error('[labeler] label12 error:', e.message); }
  try { await runLabel24(now); } catch (e) { console.error('[labeler] label24 error:', e.message); }
  try { await runLabel48(now); } catch (e) { console.error('[labeler] label48 error:', e.message); }
  try { await runSnapshots(now); } catch (e) { console.error('[labeler] snapshots error:', e.message); }
}

function start() {
  tick(); // run immediately
  setInterval(tick, 5 * 60 * 1000); // then every 5 minutes
  console.log('[labeler] started (tick every 5min)');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { start, tick };
