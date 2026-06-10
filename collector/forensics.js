'use strict';
const fetch = require('node-fetch');
const { addCredits, budgetOk, saveForensics, getDeployerPriorRugs } = require('./db');

const DAILY_BUDGET = parseInt(process.env.HELIUS_DAILY_BUDGET || '28000', 10);
const HELIUS_KEY = process.env.HELIUS_KEY || '';
// Use Helius if key provided, otherwise fall back to Ankr's free public endpoint
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : (process.env.RPC_URL || 'https://rpc.ankr.com/solana');

// Pump.fun total supply constant
const TOTAL_SUPPLY = 1_000_000_000;

// ── rate limiter: max 8 req/s ─────────────────────────────────────────
const _queue = [];
let _inflight = 0;
const MAX_RPS = HELIUS_KEY ? 8 : 3;
const SLOT_MS = 1000 / MAX_RPS;

function rateLimit(fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ fn, resolve, reject });
    _drain();
  });
}

setInterval(_drain, SLOT_MS);

function _drain() {
  if (_queue.length === 0 || _inflight >= MAX_RPS) return;
  const { fn, resolve, reject } = _queue.shift();
  _inflight++;
  fn().then(resolve, reject).finally(() => { _inflight--; });
}

// ── core RPC helper ───────────────────────────────────────────────────
async function rpc(method, params, credits = 1) {
  if (!HELIUS_KEY) throw new Error('HELIUS_KEY not set');
  if (!budgetOk(DAILY_BUDGET)) throw new Error('daily Helius budget exhausted');

  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

  const res = await rateLimit(() =>
    fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      timeout: 15000,
    })
  );

  addCredits(credits);

  if (!res.ok) throw new Error(`Helius RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

// ── get oldest tx blockTime for a wallet (approx wallet age) ─────────
async function getWalletAgeDays(address) {
  const sigs = await rpc('getSignaturesForAddress', [address, { limit: 1000 }], 1);
  if (!sigs || sigs.length === 0) return 0;
  const oldest = sigs[sigs.length - 1];
  if (!oldest.blockTime) return 0;
  return Math.floor((Date.now() / 1000 - oldest.blockTime) / 86400);
}

// ── top-10 holder concentration ───────────────────────────────────────
async function getTop10Pct(mint) {
  const result = await rpc('getTokenLargestAccounts', [mint, 'finalized'], 1);
  if (!result || !result.value || result.value.length === 0) return null;

  const top10 = result.value.slice(0, 10);
  const sumTop10 = top10.reduce((s, a) => {
    const amt = a.uiAmount || a.amount / Math.pow(10, a.decimals || 6);
    return s + amt;
  }, 0);

  return Math.round((sumTop10 / TOTAL_SUPPLY) * 100);
}

// Returns current holder count (approximation: accounts with >0 balance in top 20)
async function getHolderCount(mint) {
  const result = await rpc('getTokenLargestAccounts', [mint, 'finalized'], 1);
  if (!result || !result.value) return 0;
  return result.value.filter(a => (a.uiAmount || 0) > 0).length;
}

// ── deploy-block analysis: bundlePct + sameBlockSnipes ───────────────
async function getDeployBlockStats(mint, deployer) {
  // Get first signature for the mint (= deploy tx)
  const sigs = await rpc('getSignaturesForAddress', [mint, { limit: 5 }], 1);
  if (!sigs || sigs.length === 0) return { bundlePct: null, sameBlockSnipes: 0 };

  const deployTx = await rpc(
    'getTransaction',
    [sigs[sigs.length - 1].signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    2
  );

  if (!deployTx || !deployTx.meta) return { bundlePct: null, sameBlockSnipes: 0 };

  const postBals = deployTx.meta.postTokenBalances || [];
  const preBals = deployTx.meta.preTokenBalances || [];

  // Find wallets that received tokens in the deploy block (excluding the bonding curve)
  const preMap = {};
  preBals.forEach(b => {
    if (b.mint === mint) preMap[b.accountIndex] = b.uiTokenAmount?.uiAmount || 0;
  });

  let bundledTokens = 0;
  let sameBlockSnipes = 0;
  const bondingCurvePatterns = /^[1-9A-HJ-NP-Za-km-z]{32,44}pump|pump/i;

  for (const b of postBals) {
    if (b.mint !== mint) continue;
    const pre = preMap[b.accountIndex] || 0;
    const post = b.uiTokenAmount?.uiAmount || 0;
    const gained = post - pre;
    if (gained <= 0) continue;

    const owner = b.owner || '';
    // Skip bonding curve and deployer's own allocation
    if (owner === deployer) continue;
    if (bondingCurvePatterns.test(owner)) continue;

    bundledTokens += gained;

    // Check if this buyer was funded by deployer (same-block snipe heuristic)
    // Simplified: if SOL balance changed significantly in same block, count as snipe
    const acctKeys = deployTx.transaction?.message?.accountKeys || [];
    const acctIdx = acctKeys.findIndex(k =>
      (k.pubkey || k) === owner
    );
    if (acctIdx >= 0) {
      const solPre = deployTx.meta.preBalances[acctIdx] || 0;
      const solPost = deployTx.meta.postBalances[acctIdx] || 0;
      const solSpent = (solPre - solPost) / 1e9;
      if (solSpent > 0.01) sameBlockSnipes++;
    }
  }

  const bundlePct = Math.round((bundledTokens / TOTAL_SUPPLY) * 100 * 10) / 10;
  return { bundlePct, sameBlockSnipes };
}

// ── check if deployer sold before graduation ──────────────────────────
async function checkDevSoldEarly(deployer, mint, graduatedAt) {
  // Get deployer's recent signatures
  const sigs = await rpc('getSignaturesForAddress', [deployer, { limit: 50 }], 1);
  if (!sigs) return false;

  const beforeGrad = sigs.filter(s => s.blockTime && s.blockTime * 1000 < graduatedAt);
  if (beforeGrad.length === 0) return false;

  // Check the first few pre-graduation txs for token outflows from deployer
  for (const sig of beforeGrad.slice(0, 5)) {
    if (sig.err) continue;
    const tx = await rpc(
      'getTransaction',
      [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      2
    );
    if (!tx || !tx.meta) continue;

    const preBals = (tx.meta.preTokenBalances || []).filter(b => b.mint === mint && b.owner === deployer);
    const postBals = (tx.meta.postTokenBalances || []).filter(b => b.mint === mint && b.owner === deployer);

    const pre = preBals[0]?.uiTokenAmount?.uiAmount || 0;
    const post = postBals[0]?.uiTokenAmount?.uiAmount || 0;

    // Dev sold >50% of their position
    if (pre > 0 && post < pre * 0.5) return true;
  }

  return false;
}

// ── organic buyers + insider cluster ────────────────────────────────
async function analyzeBuyerGraph(mint, deployer, createdAt) {
  // Get signatures for the mint in the first 30 minutes
  const cutoff = createdAt + 30 * 60 * 1000;
  const sigs = await rpc('getSignaturesForAddress', [mint, { limit: 100 }], 1);
  if (!sigs) return { organicBuyers: 0, insiderClusterPct: 0, deployerId: _deployerId(deployer, 0) };

  const inWindow = sigs.filter(s => s.blockTime && s.blockTime * 1000 <= cutoff);

  // Collect unique buyer wallets and their token amounts
  const buyers = new Map(); // wallet → tokens received
  let insiderTokens = 0;
  let checkedFunding = new Set();

  for (const sig of inWindow.slice(0, 30)) {
    if (sig.err) continue;
    const tx = await rpc(
      'getTransaction',
      [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      2
    );
    if (!tx || !tx.meta) continue;

    const postBals = tx.meta.postTokenBalances || [];
    const preBals = tx.meta.preTokenBalances || [];
    const preMap = {};
    preBals.forEach(b => { if (b.mint === mint) preMap[b.accountIndex] = b.uiTokenAmount?.uiAmount || 0; });

    for (const b of postBals) {
      if (b.mint !== mint) continue;
      const owner = b.owner;
      if (!owner || owner === deployer) continue;
      const pre = preMap[b.accountIndex] || 0;
      const gained = (b.uiTokenAmount?.uiAmount || 0) - pre;
      if (gained <= 0) continue;
      buyers.set(owner, (buyers.get(owner) || 0) + gained);
    }
  }

  // Simplified insider check: wallets that share a funding source with deployer
  // We check if the deployer's wallet appears as a sender in buyer's recent history
  let insiderCount = 0;
  for (const [wallet, tokens] of buyers) {
    if (checkedFunding.has(wallet)) continue;
    checkedFunding.add(wallet);

    if (await isInsider(wallet, deployer)) {
      insiderTokens += tokens;
      insiderCount++;
    }
  }

  const organicBuyers = buyers.size - insiderCount;
  const insiderClusterPct = Math.round((insiderTokens / TOTAL_SUPPLY) * 100);
  const deployerId = _deployerId(deployer, insiderCount);

  return { organicBuyers, insiderClusterPct, deployerId };
}

// Check if a wallet received SOL from deployer within the last 7 days (2-hop check)
async function isInsider(wallet, deployer) {
  try {
    const sigs = await rpc('getSignaturesForAddress', [wallet, { limit: 20 }], 1);
    if (!sigs) return false;

    const weekAgo = Date.now() / 1000 - 7 * 86400;
    const recent = sigs.filter(s => s.blockTime && s.blockTime > weekAgo);

    for (const sig of recent.slice(0, 5)) {
      const tx = await rpc(
        'getTransaction',
        [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        2
      );
      if (!tx || !tx.meta) continue;

      // Check if deployer sent SOL in this tx
      const acctKeys = tx.transaction?.message?.accountKeys || [];
      const deployerIdx = acctKeys.findIndex(k => (k.pubkey || k) === deployer);
      if (deployerIdx < 0) continue;

      const solDiff = (tx.meta.preBalances[deployerIdx] || 0) - (tx.meta.postBalances[deployerIdx] || 0);
      if (solDiff > 0.05 * 1e9) return true; // deployer sent >0.05 SOL to this wallet
    }
  } catch { /* budget exhausted or error, skip */ }
  return false;
}

function _deployerId(deployer, insiderCount) {
  const short = deployer.slice(0, 6) + '..' + deployer.slice(-4);
  return insiderCount >= 3 ? `RNG-${short}` : `DEP-${short}`;
}

// ── socials check (from metadata URI) ────────────────────────────────
async function checkSocials(uri) {
  if (!uri) return false;
  try {
    const res = await fetch(uri, { timeout: 8000 });
    if (!res.ok) return false;
    const meta = await res.json();
    return !!(meta.twitter || meta.website || meta.telegram || meta.discord);
  } catch {
    return false;
  }
}

// ── main forensics entry point ────────────────────────────────────────
async function runForensics(launch) {
  const { mint, deployer, uri, created_at, graduated_at } = launch;

  console.log(`[forensics] processing ${mint} via ${HELIUS_KEY ? 'Helius' : 'Ankr public RPC'}`);

  try {
    const [
      devAgeDays,
      top10Pct,
      deployBlockStats,
      devSoldEarly,
      buyerGraph,
      hasSocials,
    ] = await Promise.allSettled([
      getWalletAgeDays(deployer),
      getTop10Pct(mint),
      getDeployBlockStats(mint, deployer),
      checkDevSoldEarly(deployer, mint, graduated_at || Date.now()),
      analyzeBuyerGraph(mint, deployer, created_at || Date.now()),
      checkSocials(uri),
    ]);

    const devPriorRugs = getDeployerPriorRugs(deployer, mint);

    saveForensics(mint, {
      bundle_pct: deployBlockStats.value?.bundlePct ?? null,
      dev_age_days: devAgeDays.value ?? null,
      dev_prior_rugs: devPriorRugs,
      top10_pct: top10Pct.value ?? null,
      dev_sold_early: devSoldEarly.value ? 1 : 0,
      has_socials: hasSocials.value ? 1 : 0,
      organic_buyers: buyerGraph.value?.organicBuyers ?? 0,
      insider_cluster_pct: buyerGraph.value?.insiderClusterPct ?? 0,
      deployer_id: buyerGraph.value?.deployerId ?? _deployerId(deployer || '', 0),
      same_block_snipes: deployBlockStats.value?.sameBlockSnipes ?? 0,
    });

    console.log(`[forensics] done ${mint}`);
  } catch (err) {
    console.error(`[forensics] error on ${mint}:`, err.message);
    // Save partial data so we don't retry forever
    saveForensics(mint, {
      bundle_pct: null, dev_age_days: null, dev_prior_rugs: getDeployerPriorRugs(deployer, mint),
      top10_pct: null, dev_sold_early: 0, has_socials: 0,
      organic_buyers: 0, insider_cluster_pct: 0,
      deployer_id: _deployerId(deployer || '', 0), same_block_snipes: 0,
    });
  }
}

module.exports = { runForensics, getTop10Pct, getHolderCount };
