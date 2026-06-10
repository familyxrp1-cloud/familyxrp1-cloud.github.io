'use strict';
const fetch = require('node-fetch');
const { saveOutcome, updateLabel12, updateLabel24, updateSeries, getPendingLabels, getPendingLabel12, getPendingLabel24, getPendingSnapshots } = require('./db');
const { getHolderCount } = require('./forensics');

const DEX = 'https://api.dexscreener.com/latest/dex/tokens';

async function getDex(mint) {
  try {
    const res = await fetch(`${DEX}/${mint}`, { timeout: 12000 });
    if (!res.ok) return null;
    const j = await res.json();
    const p = (j.pairs||[]);
    return p.find(x=>x.dexId==='pumpswap') || p.find(x=>x.dexId==='raydium') || p[0] || null;
  } catch { return null; }
}

function classify(launch, pair) {
  const mp = launch.migration_price_usd;
  const cp = pair ? parseFloat(pair.priceUsd||0) : 0;
  const hours = launch.graduated_at ? (Date.now()-launch.graduated_at)/3600000 : 0;
  if (!pair || !cp || !mp) return { outcome:'fade', peakX:null, hoursAlive:hours };
  const ratio = cp/mp;
  const h24 = parseFloat(pair.priceChange?.h24||0)/100;
  const h6 = parseFloat(pair.priceChange?.h6||0)/100;
  const peakX = mp > 0 ? cp*Math.max(1,1+h6,1+h24)/mp : null;
  if (ratio < 0.05) return { outcome:'rug', peakX, hoursAlive:hours };
  if (ratio >= 0.8 && parseFloat(pair.liquidity?.usd||0) > 5000) return { outcome:'win', peakX, hoursAlive:hours };
  return { outcome:'fade', peakX, hoursAlive:hours };
}

async function tick() {
  const now = Date.now();
  for (const l of getPendingLabel12(now)) { const p=await getDex(l.mint); updateLabel12(l.mint, p?parseFloat(p.priceUsd||0):null); await sleep(400); }
  for (const l of getPendingLabel24(now)) { const p=await getDex(l.mint); updateLabel24(l.mint, p?parseFloat(p.priceUsd||0):null); await sleep(400); }
  for (const l of getPendingLabels(now)) {
    const p=await getDex(l.mint);
    const { outcome, peakX, hoursAlive } = classify(l, p);
    const cp=p?parseFloat(p.priceUsd||0):0;
    saveOutcome(l.mint, { outcome, peak_x:peakX, migration_price_usd:l.migration_price_usd, peak_price_usd:Math.max(cp,l.peak_price_usd||0,l.migration_price_usd||0)||null, hours_alive:Math.round(hoursAlive*10)/10 });
    console.log(`[label 48h] ${l.mint} → ${outcome}`);
    await sleep(400);
  }
  for (const l of getPendingSnapshots(now)) {
    try {
      const count=await getHolderCount(l.mint);
      const series=[...(l.series?JSON.parse(l.series):[]),count];
      updateSeries(l.mint, series, series.length<13 ? l.graduated_at+series.length*4*3600000 : null);
    } catch(e) { console.warn('[snapshot]',l.mint,e.message); }
    await sleep(300);
  }
}

function start() {
  tick();
  setInterval(tick, 5*60*1000);
  console.log('[labeler] started');
}

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
module.exports = { start, tick };
