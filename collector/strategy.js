'use strict';
// Strategy miner: scans labeled launch history for filter combinations where
// >= hitGoal of matching launches reached `target`x from graduation price.
//
// Usage (on the server, next to launches.db):
//   node strategy.js                      # defaults: target 1.5x, min 30 samples
//   node strategy.js --target 2 --min 20 --top 15
//   node strategy.js --json               # machine-readable output
//   node strategy.js --file launches.json # run on a downloaded /launches.json instead of the DB
//
// A "hit" = peak_x >= target within the 48h labeling window, i.e. buying at
// graduation and taking profit at target would have filled. EV assumes:
//   hit            -> +(target-1) per 1 staked
//   miss + rug     -> -0.95
//   miss + fade    -> -0.60
//   miss + win     -> -0.10  (held >=80% of migration price at 48h)
// These loss estimates are conservative approximations; the DB stores peak
// price, not your exact exit.

const Z = 1.96; // 95% confidence for Wilson lower bound

const MISS_RETURN = { rug: -0.95, fade: -0.60, win: -0.10 };

// One predicate per feature per combo. Missing values never match.
const PREDICATES = [
  { key: 'bundlePct', label: 'bundle% <= 5', fn: r => r.bundlePct != null && r.bundlePct <= 5 },
  { key: 'bundlePct', label: 'bundle% <= 10', fn: r => r.bundlePct != null && r.bundlePct <= 10 },
  { key: 'bundlePct', label: 'bundle% <= 20', fn: r => r.bundlePct != null && r.bundlePct <= 20 },
  { key: 'top10Pct', label: 'top10% <= 20', fn: r => r.top10Pct != null && r.top10Pct <= 20 },
  { key: 'top10Pct', label: 'top10% <= 30', fn: r => r.top10Pct != null && r.top10Pct <= 30 },
  { key: 'top10Pct', label: 'top10% <= 40', fn: r => r.top10Pct != null && r.top10Pct <= 40 },
  { key: 'devPriorRugs', label: 'dev has 0 prior rugs', fn: r => (r.devPriorRugs || 0) === 0 },
  { key: 'devSoldEarly', label: 'dev did not sell early', fn: r => !r.devSoldEarly },
  { key: 'hasSocials', label: 'has socials', fn: r => !!r.hasSocials },
  { key: 'devAgeDays', label: 'dev wallet >= 7d old', fn: r => r.devAgeDays != null && r.devAgeDays >= 7 },
  { key: 'devAgeDays', label: 'dev wallet >= 30d old', fn: r => r.devAgeDays != null && r.devAgeDays >= 30 },
  { key: 'sameBlockSnipes', label: 'no same-block snipes', fn: r => (r.sameBlockSnipes || 0) === 0 },
  { key: 'sameBlockSnipes', label: 'same-block snipes <= 2', fn: r => (r.sameBlockSnipes || 0) <= 2 },
  { key: 'insiderClusterPct', label: 'insider cluster <= 10%', fn: r => r.insiderClusterPct != null && r.insiderClusterPct <= 10 },
  { key: 'organicBuyers', label: 'organic buyers >= 50', fn: r => (r.organicBuyers || 0) >= 50 },
  { key: 'organicBuyers', label: 'organic buyers >= 150', fn: r => (r.organicBuyers || 0) >= 150 },
  { key: 'smartMoneyBuyers', label: 'smart money buyers >= 1', fn: r => (r.smartMoneyBuyers || 0) >= 1 },
  { key: 'saleDurationMin', label: 'bonded in <= 15min', fn: r => r.saleDurationMin != null && r.saleDurationMin <= 15 },
  { key: 'saleDurationMin', label: 'bonded over >= 60min', fn: r => r.saleDurationMin != null && r.saleDurationMin >= 60 },
  { key: 'liqAtGrad', label: 'liq at grad >= 85 SOL', fn: r => r.liqAtGrad != null && r.liqAtGrad >= 85 },
];

function wilsonLow(hits, n) {
  if (!n) return 0;
  const p = hits / n;
  const d = 1 + (Z * Z) / n;
  const c = p + (Z * Z) / (2 * n);
  const s = Z * Math.sqrt((p * (1 - p) + (Z * Z) / (4 * n)) / n);
  return (c - s) / d;
}

// Accepts DB rows (snake_case) or /launches.json rows (camelCase).
function normalize(r) {
  return {
    mint: r.mint,
    ticker: r.ticker,
    outcome: r.outcome,
    peakX: r.peakX ?? r.peak_x,
    bundlePct: r.bundlePct ?? r.bundle_pct,
    top10Pct: r.top10Pct ?? r.top10_pct,
    devPriorRugs: r.devPriorRugs ?? r.dev_prior_rugs,
    devSoldEarly: r.devSoldEarly ?? (r.dev_sold_early === 1),
    hasSocials: r.hasSocials ?? (r.has_socials === 1),
    devAgeDays: r.devAgeDays ?? r.dev_age_days,
    sameBlockSnipes: r.sameBlockSnipes ?? r.same_block_snipes,
    insiderClusterPct: r.insiderClusterPct ?? r.insider_cluster_pct,
    organicBuyers: r.organicBuyers ?? r.organic_buyers,
    smartMoneyBuyers: r.smartMoneyBuyers ?? r.smart_money_buyers,
    saleDurationMin: r.saleDurationMin ?? r.sale_duration_min,
    liqAtGrad: r.liqAtGrad ?? r.v_sol_at_grad,
  };
}

function evaluate(rows, preds, target) {
  let n = 0, hits = 0, ev = 0, peakSum = 0, rugs = 0;
  for (const r of rows) {
    if (!preds.every(p => p.fn(r))) continue;
    n++;
    const peak = r.peakX || 0;
    peakSum += peak;
    if (r.outcome === 'rug') rugs++;
    if (peak >= target) { hits++; ev += target - 1; }
    else ev += MISS_RETURN[r.outcome] ?? -0.60;
  }
  return { n, hits, rugs, hitRate: n ? hits / n : 0, wilsonLow: wilsonLow(hits, n), evPerTrade: n ? ev / n : 0, avgPeakX: n ? peakSum / n : 0 };
}

function* combos(preds, maxDepth) {
  const idx = [];
  function* rec(start, depth) {
    for (let i = start; i < preds.length; i++) {
      if (idx.some(j => preds[j].key === preds[i].key)) continue;
      idx.push(i);
      yield idx.map(j => preds[j]);
      if (depth < maxDepth) yield* rec(i + 1, depth + 1);
      idx.pop();
    }
  }
  yield* rec(0, 1);
}

function mineStrategies({ rows, target = 1.5, minSample = 30, maxDepth = 3, top = 20 }) {
  const data = rows.map(normalize).filter(r => r.outcome && r.outcome !== 'pending' && r.peakX != null);
  const baseline = evaluate(data, [], target);
  const results = [];
  for (const preds of combos(PREDICATES, maxDepth)) {
    const s = evaluate(data, preds, target);
    if (s.n < minSample) continue;
    if (s.hitRate <= baseline.hitRate) continue;
    results.push({ rules: preds.map(p => p.label), ...s });
  }
  results.sort((a, b) => b.wilsonLow - a.wilsonLow);
  // Drop strategies whose rule set is a superset of a better-or-equal one.
  const kept = [];
  for (const s of results) {
    if (kept.some(k => k.wilsonLow >= s.wilsonLow && k.rules.every(rl => s.rules.includes(rl)))) continue;
    kept.push(s);
    if (kept.length >= top) break;
  }
  return { target, minSample, labeledLaunches: data.length, baseline, strategies: kept };
}

function fmtPct(x) { return (x * 100).toFixed(1) + '%'; }

function printReport(rep) {
  console.log(`\nSURVIVOR LAB — strategy miner`);
  console.log(`labeled launches: ${rep.labeledLaunches} | target: x${rep.target} | min sample: ${rep.minSample}`);
  console.log(`baseline (no filter): ${fmtPct(rep.baseline.hitRate)} hit x${rep.target} | EV ${rep.baseline.evPerTrade >= 0 ? '+' : ''}${fmtPct(rep.baseline.evPerTrade)}/trade | rugs ${fmtPct(rep.baseline.rugs / (rep.baseline.n || 1))}`);
  if (!rep.strategies.length) {
    console.log(`\nNo filter combo beat the baseline with >= ${rep.minSample} samples.`);
    console.log(`Either lower --min, lower --target, or let the collector gather more history.`);
    return;
  }
  console.log(`\n#   hit x${rep.target}  95%low   EV/trade  n     rugs   avg peak  rules`);
  rep.strategies.forEach((s, i) => {
    console.log(
      String(i + 1).padEnd(4)
      + fmtPct(s.hitRate).padEnd(9)
      + fmtPct(s.wilsonLow).padEnd(9)
      + ((s.evPerTrade >= 0 ? '+' : '') + fmtPct(s.evPerTrade)).padEnd(10)
      + String(s.n).padEnd(6)
      + fmtPct(s.rugs / s.n).padEnd(7)
      + ('x' + s.avgPeakX.toFixed(2)).padEnd(10)
      + s.rules.join(' AND ')
    );
  });
  console.log(`\n"95%low" = Wilson lower bound: with 95% confidence the true hit rate is at least this.`);
  console.log(`Trust that column over raw hit rate, especially on small n.`);
}

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

if (require.main === module) {
  const file = arg('file', null);
  let rows;
  if (file) {
    const j = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    rows = j.launches || j;
  } else {
    rows = require('./db').getFinishedLaunches();
  }
  const rep = mineStrategies({
    rows,
    target: parseFloat(arg('target', '1.5')),
    minSample: parseInt(arg('min', '30'), 10),
    maxDepth: parseInt(arg('depth', '3'), 10),
    top: parseInt(arg('top', '20'), 10),
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rep, null, 2));
  else printReport(rep);
}

module.exports = { mineStrategies, PREDICATES, normalize };
