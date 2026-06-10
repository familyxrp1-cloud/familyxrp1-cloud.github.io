#!/usr/bin/env node
'use strict';
/**
 * calibrate.js — Validate and tune threshold rules against the MemeTrans dataset.
 *
 * MemeTrans: https://github.com/git-disl/MemeTrans
 * 41k labeled pump.fun launches, 122 features each.
 *
 * Usage:
 *   node calibrate.js [--dataset ./path/to/dataset.csv] [--grid]
 *
 * Steps:
 *   1. Download MemeTrans dataset (clones repo or uses local path)
 *   2. Map its columns to our wire contract fields
 *   3. Compute win-lift for each threshold rule
 *   4. With --grid: grid-search optimal thresholds, output recommended values
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const doGrid = args.includes('--grid');
const datasetArg = args.find((a, i) => args[i - 1] === '--dataset');
const DATASET_PATH = datasetArg || path.join(__dirname, 'memetrans', 'dataset.csv');

// ── column mapping (MemeTrans → our wire contract) ────────────────────
// Adjust these if MemeTrans uses different column names.
// Run `node calibrate.js --list-columns` to print available columns.
const COL_MAP = {
  // Outcome: MemeTrans uses 'label' or 'outcome' column
  outcome: ['label', 'outcome', 'result'],

  // Bundle: % of supply bought in deploy block
  bundlePct: ['bundle_pct', 'bundlePct', 'bundle_percent', 'first_block_pct'],

  // Deployer wallet age in days
  devAgeDays: ['dev_age_days', 'devAgeDays', 'deployer_age', 'wallet_age_days'],

  // Holder concentration
  top10Pct: ['top10_pct', 'top10Pct', 'holder_top10_pct', 'top_10_pct'],

  // Sale fill time (minutes)
  saleDurationMin: ['sale_duration_min', 'fill_time_min', 'bonding_curve_fill_min'],

  // Insider cluster
  insiderClusterPct: ['insider_cluster_pct', 'cluster_pct', 'insider_pct'],

  // Prior rugs
  devPriorRugs: ['dev_prior_rugs', 'deployer_rugs', 'rug_count'],
};

// ── outcome label normalization ────────────────────────────────────────
function normalizeOutcome(raw) {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  if (v === 'win' || v === '1' || v === 'success' || v === 'survived') return 'win';
  if (v === 'rug' || v === '0' || v === 'rug_pull' || v === 'rugged') return 'rug';
  if (v === 'fade' || v === '2' || v === 'faded' || v === 'dead') return 'fade';
  return null;
}

// ── CSV parser (no deps) ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (vals[j] || '').trim().replace(/^"|"$/g, '');
    });
    rows.push(row);
  }
  return { headers, rows };
}

// ── resolve column from aliases ────────────────────────────────────────
function resolveCol(headers, aliases) {
  for (const alias of aliases) {
    if (headers.includes(alias)) return alias;
  }
  return null;
}

// ── win-lift calculation ───────────────────────────────────────────────
function computeLift(data, predicate, baseWinRate) {
  const subset = data.filter(predicate);
  if (subset.length < 5) return { lift: null, n: subset.length, winRate: null };
  const wins = subset.filter(r => r._outcome === 'win').length;
  const winRate = wins / subset.length;
  return {
    lift: baseWinRate > 0 ? winRate / baseWinRate : null,
    n: subset.length,
    winRate,
    wins,
  };
}

// ── threshold grid search ──────────────────────────────────────────────
function gridSearch(data, fieldFn, thresholds, direction, baseWinRate) {
  return thresholds.map(t => {
    const predicate = direction === 'below'
      ? r => { const v = fieldFn(r); return v !== null && v < t; }
      : r => { const v = fieldFn(r); return v !== null && v > t; };
    const stats = computeLift(data, predicate, baseWinRate);
    return { threshold: t, direction, ...stats };
  });
}

// ── download MemeTrans dataset ─────────────────────────────────────────
function ensureDataset() {
  if (fs.existsSync(DATASET_PATH)) {
    console.log('Using existing dataset:', DATASET_PATH);
    return;
  }

  const dir = path.dirname(DATASET_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  console.log('Cloning MemeTrans dataset (this may take a moment)...');
  try {
    execSync(
      'git clone --depth 1 https://github.com/git-disl/MemeTrans ' + path.join(__dirname, 'memetrans'),
      { stdio: 'inherit' }
    );
    // Find the CSV in the cloned repo
    const files = fs.readdirSync(path.join(__dirname, 'memetrans'));
    const csv = files.find(f => f.endsWith('.csv'));
    if (!csv) {
      // Try subdirectory
      const sub = fs.readdirSync(path.join(__dirname, 'memetrans', 'data') ).find(f => f.endsWith('.csv'));
      if (!sub) throw new Error('No CSV found in cloned MemeTrans repo. Check the repo structure.');
      return path.join(__dirname, 'memetrans', 'data', sub);
    }
    return path.join(__dirname, 'memetrans', csv);
  } catch (e) {
    console.error('Could not clone MemeTrans:', e.message);
    console.error('Download manually from https://github.com/git-disl/MemeTrans');
    console.error('Then run: node calibrate.js --dataset /path/to/file.csv');
    process.exit(1);
  }
}

// ── main ───────────────────────────────────────────────────────────────
function main() {
  if (args.includes('--help')) {
    console.log('Usage: node calibrate.js [--dataset path.csv] [--grid] [--list-columns]');
    return;
  }

  const csvPath = ensureDataset() || DATASET_PATH;

  if (!fs.existsSync(csvPath)) {
    console.error('Dataset not found:', csvPath);
    process.exit(1);
  }

  console.log('Loading dataset from', csvPath);
  const raw = fs.readFileSync(csvPath, 'utf8');
  const { headers, rows } = parseCSV(raw);
  console.log(`Loaded ${rows.length} rows, ${headers.length} columns`);

  if (args.includes('--list-columns')) {
    console.log('\nAvailable columns:');
    headers.forEach(h => console.log(' ', h));
    return;
  }

  // Resolve column mappings
  const cols = {};
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    cols[field] = resolveCol(headers, aliases);
    if (!cols[field]) {
      console.warn(`  [warn] No column found for '${field}' (tried: ${aliases.join(', ')})`);
    }
  }

  // Normalize outcomes
  const data = rows
    .map(r => ({
      ...r,
      _outcome: normalizeOutcome(cols.outcome ? r[cols.outcome] : null),
      _bundlePct: cols.bundlePct ? parseFloat(r[cols.bundlePct]) || null : null,
      _devAgeDays: cols.devAgeDays ? parseFloat(r[cols.devAgeDays]) || null : null,
      _top10Pct: cols.top10Pct ? parseFloat(r[cols.top10Pct]) || null : null,
      _saleDuration: cols.saleDurationMin ? parseFloat(r[cols.saleDurationMin]) || null : null,
      _insiderPct: cols.insiderClusterPct ? parseFloat(r[cols.insiderClusterPct]) || null : null,
      _devRugs: cols.devPriorRugs ? parseFloat(r[cols.devPriorRugs]) || null : null,
    }))
    .filter(r => r._outcome !== null);

  const wins = data.filter(r => r._outcome === 'win');
  const rugs = data.filter(r => r._outcome === 'rug');
  const fades = data.filter(r => r._outcome === 'fade');
  const baseWinRate = wins.length / data.length;

  console.log(`\nDataset: ${data.length} labeled launches`);
  console.log(`  Wins:  ${wins.length} (${pct(wins.length, data.length)}%)`);
  console.log(`  Rugs:  ${rugs.length} (${pct(rugs.length, data.length)}%)`);
  console.log(`  Fades: ${fades.length} (${pct(fades.length, data.length)}%)`);
  console.log(`  Base win rate: ${(baseWinRate * 100).toFixed(1)}%`);

  // ── Current threshold evaluation ─────────────────────────────────────
  console.log('\n──── Current threshold evaluation ────\n');

  const CURRENT_THRESHOLDS = [
    { name: 'Bundle < 15%',        fn: r => r._bundlePct,    dir: 'below', t: 15 },
    { name: 'Dev age > 30d',        fn: r => r._devAgeDays,   dir: 'above', t: 30 },
    { name: 'Top-10 holders < 35%', fn: r => r._top10Pct,     dir: 'below', t: 35 },
    { name: 'Sale pace > 30 min',   fn: r => r._saleDuration, dir: 'above', t: 30 },
    { name: 'Insider cluster < 20%',fn: r => r._insiderPct,   dir: 'below', t: 20 },
    { name: 'Zero prior rugs',      fn: r => r._devRugs,      dir: 'below', t: 1  },
  ];

  for (const rule of CURRENT_THRESHOLDS) {
    const pred = rule.dir === 'below'
      ? r => { const v = rule.fn(r); return v !== null && v < rule.t; }
      : r => { const v = rule.fn(r); return v !== null && v > rule.t; };
    const stats = computeLift(data, pred, baseWinRate);
    if (stats.lift === null) {
      console.log(`  ${rule.name.padEnd(30)} → no data`);
    } else {
      const bar = '█'.repeat(Math.min(20, Math.round(stats.lift * 5)));
      console.log(
        `  ${rule.name.padEnd(30)} → ${stats.lift.toFixed(2)}× lift  ${bar}`
        + `  (n=${stats.n}, win rate=${(stats.winRate * 100).toFixed(1)}%)`
      );
    }
  }

  if (!doGrid) {
    console.log('\nRun with --grid to search for optimal thresholds.');
    return;
  }

  // ── Grid search ─────────────────────────────────────────────────────
  console.log('\n──── Grid search: optimal thresholds ────\n');

  const GRID = [
    {
      name: 'bundlePct (below)',
      fn: r => r._bundlePct,
      thresholds: [5, 10, 15, 20, 25, 30, 40],
      dir: 'below',
    },
    {
      name: 'devAgeDays (above)',
      fn: r => r._devAgeDays,
      thresholds: [7, 14, 30, 60, 90, 180],
      dir: 'above',
    },
    {
      name: 'top10Pct (below)',
      fn: r => r._top10Pct,
      thresholds: [20, 25, 30, 35, 40, 50],
      dir: 'below',
    },
    {
      name: 'saleDurationMin (above)',
      fn: r => r._saleDuration,
      thresholds: [10, 20, 30, 45, 60, 90],
      dir: 'above',
    },
    {
      name: 'insiderClusterPct (below)',
      fn: r => r._insiderPct,
      thresholds: [10, 15, 20, 25, 30],
      dir: 'below',
    },
  ];

  for (const rule of GRID) {
    const results = gridSearch(data, rule.fn, rule.thresholds, rule.dir, baseWinRate);
    const best = results.filter(r => r.lift !== null).sort((a, b) => b.lift - a.lift)[0];

    console.log(`  ${rule.name}:`);
    results.forEach(r => {
      const marker = r === best ? ' ← best' : '';
      const lift = r.lift !== null ? r.lift.toFixed(2) + '×' : 'n/a';
      console.log(
        `    threshold=${r.threshold.toString().padEnd(6)} lift=${lift.padEnd(8)} n=${(r.n || 0).toString().padStart(6)}${marker}`
      );
    });
    console.log('');
  }

  console.log('Adjust TRAITS thresholds in survivor-lab.html to match the "← best" values above.');
}

function pct(n, d) {
  return d ? Math.round(n / d * 100) : 0;
}

main();
