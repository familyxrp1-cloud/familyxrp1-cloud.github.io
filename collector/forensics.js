'use strict';
const fetch = require('node-fetch');
const { addCredits, budgetOk, saveForensics, getDeployerPriorRugs } = require('./db');

const DAILY_BUDGET = parseInt(process.env.HELIUS_DAILY_BUDGET || '28000', 10);
const HELIUS_KEY = process.env.HELIUS_KEY || '';
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : (process.env.RPC_URL || 'https://rpc.ankr.com/solana');
const TOTAL_SUPPLY = 1_000_000_000;
const MAX_RPS = HELIUS_KEY ? 8 : 3;
const SLOT_MS = 1000 / MAX_RPS;

const _queue = [];
let _inflight = 0;
function rateLimit(fn) { return new Promise((res, rej) => { _queue.push({ fn, resolve: res, reject: rej }); _drain(); }); }
setInterval(_drain, SLOT_MS);
function _drain() {
  if (_queue.length === 0 || _inflight >= MAX_RPS) return;
  const { fn, resolve, reject } = _queue.shift();
  _inflight++;
  fn().then(resolve, reject).finally(() => { _inflight--; });
}

async function rpc(method, params, credits = 1) {
  if (!budgetOk(DAILY_BUDGET)) throw new Error('daily budget exhausted');
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const res = await rateLimit(() => fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeout: 15000 }));
  addCredits(credits);
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

async function getWalletAgeDays(address) {
  const sigs = await rpc('getSignaturesForAddress', [address, { limit: 1000 }], 1);
  if (!sigs || !sigs.length) return 0;
  const oldest = sigs[sigs.length - 1];
  if (!oldest.blockTime) return 0;
  return Math.floor((Date.now() / 1000 - oldest.blockTime) / 86400);
}

async function getTop10Pct(mint) {
  const result = await rpc('getTokenLargestAccounts', [mint, 'finalized'], 1);
  if (!result || !result.value || !result.value.length) return null;
  const sum = result.value.slice(0, 10).reduce((s, a) => s + (a.uiAmount || a.amount / 1e6), 0);
  return Math.round((sum / TOTAL_SUPPLY) * 100);
}

async function getHolderCount(mint) {
  const result = await rpc('getTokenLargestAccounts', [mint, 'finalized'], 1);
  if (!result || !result.value) return 0;
  return result.value.filter(a => (a.uiAmount || 0) > 0).length;
}

async function getDeployBlockStats(mint, deployer) {
  const sigs = await rpc('getSignaturesForAddress', [mint, { limit: 5 }], 1);
  if (!sigs || !sigs.length) return { bundlePct: null, sameBlockSnipes: 0 };
  const tx = await rpc('getTransaction', [sigs[sigs.length-1].signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], 2);
  if (!tx || !tx.meta) return { bundlePct: null, sameBlockSnipes: 0 };
  const preMap = {};
  (tx.meta.preTokenBalances||[]).forEach(b => { if (b.mint===mint) preMap[b.accountIndex] = b.uiTokenAmount?.uiAmount||0; });
  let bundledTokens = 0, sameBlockSnipes = 0;
  for (const b of (tx.meta.postTokenBalances||[])) {
    if (b.mint !== mint) continue;
    const gained = (b.uiTokenAmount?.uiAmount||0) - (preMap[b.accountIndex]||0);
    if (gained <= 0 || b.owner === deployer) continue;
    bundledTokens += gained;
    const idx = (tx.transaction?.message?.accountKeys||[]).findIndex(k => (k.pubkey||k) === b.owner);
    if (idx >= 0 && (tx.meta.preBalances[idx]-tx.meta.postBalances[idx])/1e9 > 0.01) sameBlockSnipes++;
  }
  return { bundlePct: Math.round(bundledTokens/TOTAL_SUPPLY*1000)/10, sameBlockSnipes };
}

async function checkDevSoldEarly(deployer, mint, graduatedAt) {
  const sigs = await rpc('getSignaturesForAddress', [deployer, { limit: 50 }], 1);
  if (!sigs) return false;
  for (const sig of sigs.filter(s => s.blockTime && s.blockTime*1000 < graduatedAt).slice(0, 5)) {
    if (sig.err) continue;
    const tx = await rpc('getTransaction', [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], 2);
    if (!tx || !tx.meta) continue;
    const pre = (tx.meta.preTokenBalances||[]).find(b => b.mint===mint && b.owner===deployer)?.uiTokenAmount?.uiAmount||0;
    const post = (tx.meta.postTokenBalances||[]).find(b => b.mint===mint && b.owner===deployer)?.uiTokenAmount?.uiAmount||0;
    if (pre > 0 && post < pre * 0.5) return true;
  }
  return false;
}

async function checkSocials(uri) {
  if (!uri) return false;
  try {
    const res = await fetch(uri, { timeout: 8000 });
    if (!res.ok) return false;
    const m = await res.json();
    return !!(m.twitter || m.website || m.telegram || m.discord);
  } catch { return false; }
}

function _deployerId(deployer, insiderCount) {
  const s = deployer ? deployer.slice(0,6)+'..'+deployer.slice(-4) : 'unknown';
  return insiderCount >= 3 ? `RNG-${s}` : `DEP-${s}`;
}

async function runForensics(launch) {
  const { mint, deployer, uri, created_at, graduated_at } = launch;
  console.log(`[forensics] ${mint} via ${HELIUS_KEY ? 'Helius' : 'Ankr'}`);
  try {
    const [ageR, top10R, blockR, soldR, socialsR] = await Promise.allSettled([
      getWalletAgeDays(deployer),
      getTop10Pct(mint),
      getDeployBlockStats(mint, deployer),
      checkDevSoldEarly(deployer, mint, graduated_at||Date.now()),
      checkSocials(uri),
    ]);
    saveForensics(mint, {
      bundle_pct: blockR.value?.bundlePct ?? null,
      dev_age_days: ageR.value ?? null,
      dev_prior_rugs: getDeployerPriorRugs(deployer, mint),
      top10_pct: top10R.value ?? null,
      dev_sold_early: soldR.value ? 1 : 0,
      has_socials: socialsR.value ? 1 : 0,
      organic_buyers: 0,
      insider_cluster_pct: 0,
      deployer_id: _deployerId(deployer, 0),
      same_block_snipes: blockR.value?.sameBlockSnipes ?? 0,
    });
    console.log(`[forensics] done ${mint}`);
  } catch (err) {
    console.error(`[forensics] error ${mint}:`, err.message);
    saveForensics(mint, { bundle_pct:null, dev_age_days:null, dev_prior_rugs:getDeployerPriorRugs(deployer,mint), top10_pct:null, dev_sold_early:0, has_socials:0, organic_buyers:0, insider_cluster_pct:0, deployer_id:_deployerId(deployer,0), same_block_snipes:0 });
  }
}

module.exports = { runForensics, getTop10Pct, getHolderCount };
