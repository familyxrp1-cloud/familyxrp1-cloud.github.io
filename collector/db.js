'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'launches.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS launches (
    mint TEXT PRIMARY KEY,
    name TEXT,
    ticker TEXT,
    deployer TEXT,
    created_at INTEGER,
    graduated_at INTEGER,

    -- from WS create event
    uri TEXT,
    bonding_curve TEXT,
    v_sol_at_grad REAL,

    -- stage 2 forensics (null until processed)
    bundle_pct REAL,
    dev_age_days INTEGER,
    dev_prior_rugs INTEGER,
    top10_pct REAL,
    dev_sold_early INTEGER,
    has_socials INTEGER,
    organic_buyers INTEGER,
    insider_cluster_pct REAL,
    deployer_id TEXT,
    same_block_snipes INTEGER,
    sale_duration_min REAL,

    -- stage 3 outcome (null until 48h window closes)
    outcome TEXT,
    peak_x REAL,
    migration_price_usd REAL,
    peak_price_usd REAL,
    hours_alive REAL,
    series TEXT,

    -- future work stubs (null in v1)
    meta TEXT,
    meta_rank INTEGER,
    smart_money_buyers INTEGER,

    -- internal pipeline state
    forensics_done INTEGER DEFAULT 0,
    forensics_queued_at INTEGER,
    label_due_at INTEGER,
    label_12h_done INTEGER DEFAULT 0,
    label_24h_done INTEGER DEFAULT 0,
    label_48h_done INTEGER DEFAULT 0,
    next_snapshot_at INTEGER,
    snapshot_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_launches_graduated
    ON launches(graduated_at) WHERE graduated_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_launches_deployer
    ON launches(deployer);
  CREATE INDEX IF NOT EXISTS idx_launches_outcome
    ON launches(outcome);
  CREATE INDEX IF NOT EXISTS idx_launches_forensics
    ON launches(forensics_done, graduated_at) WHERE graduated_at IS NOT NULL;
`);

// ── meta helpers ─────────────────────────────────────────────────────
const metaGet = db.prepare('SELECT value FROM meta WHERE key = ?');
const metaSet = db.prepare(
  'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function getMeta(key, fallback = null) {
  const row = metaGet.get(key);
  return row ? row.value : fallback;
}
function setMeta(key, value) {
  metaSet.run(key, String(value));
}

// ── daily Helius budget ───────────────────────────────────────────────
function getTodayKey() {
  return 'helius_credits_' + new Date().toISOString().slice(0, 10);
}
function getUsedCredits() {
  return parseInt(getMeta(getTodayKey(), '0'), 10);
}
function addCredits(n) {
  const used = getUsedCredits() + n;
  setMeta(getTodayKey(), used);
  return used;
}
function budgetOk(dailyLimit) {
  return getUsedCredits() < dailyLimit;
}

// ── launch helpers ────────────────────────────────────────────────────
const stmtInsertLaunch = db.prepare(`
  INSERT INTO launches (mint, name, ticker, deployer, created_at, uri, bonding_curve)
  VALUES (@mint, @name, @ticker, @deployer, @created_at, @uri, @bonding_curve)
  ON CONFLICT(mint) DO NOTHING
`);

const stmtMarkGraduated = db.prepare(`
  UPDATE launches SET
    graduated_at = @graduated_at,
    v_sol_at_grad = @v_sol_at_grad,
    sale_duration_min = @sale_duration_min,
    label_due_at = @label_due_at,
    next_snapshot_at = @next_snapshot_at
  WHERE mint = @mint
`);

const stmtUpdateForensics = db.prepare(`
  UPDATE launches SET
    bundle_pct = @bundle_pct,
    dev_age_days = @dev_age_days,
    dev_prior_rugs = @dev_prior_rugs,
    top10_pct = @top10_pct,
    dev_sold_early = @dev_sold_early,
    has_socials = @has_socials,
    organic_buyers = @organic_buyers,
    insider_cluster_pct = @insider_cluster_pct,
    deployer_id = @deployer_id,
    same_block_snipes = @same_block_snipes,
    forensics_done = 1
  WHERE mint = @mint
`);

const stmtUpdateOutcome = db.prepare(`
  UPDATE launches SET
    outcome = @outcome,
    peak_x = @peak_x,
    migration_price_usd = @migration_price_usd,
    peak_price_usd = @peak_price_usd,
    hours_alive = @hours_alive,
    label_48h_done = 1
  WHERE mint = @mint
`);

const stmtUpdateLabel12 = db.prepare(`
  UPDATE launches SET label_12h_done = 1, migration_price_usd = @price WHERE mint = @mint
`);
const stmtUpdateLabel24 = db.prepare(`
  UPDATE launches SET label_24h_done = 1, peak_price_usd = CASE WHEN @price > COALESCE(peak_price_usd, 0) THEN @price ELSE peak_price_usd END WHERE mint = @mint
`);

const stmtUpdateSeries = db.prepare(`
  UPDATE launches SET
    series = @series,
    snapshot_count = @snapshot_count,
    next_snapshot_at = @next_snapshot_at
  WHERE mint = @mint
`);

function insertLaunch(fields) {
  stmtInsertLaunch.run(fields);
}
function markGraduated(mint, vSol, graduatedAt) {
  const launch = getLaunch(mint);
  const saleDurationMin = launch && launch.created_at
    ? (graduatedAt - launch.created_at) / 60000
    : null;
  stmtMarkGraduated.run({
    mint,
    graduated_at: graduatedAt,
    v_sol_at_grad: vSol,
    sale_duration_min: saleDurationMin,
    label_due_at: graduatedAt + 48 * 60 * 60 * 1000,
    next_snapshot_at: graduatedAt + 4 * 60 * 60 * 1000,
  });
}
function saveForensics(mint, fields) {
  stmtUpdateForensics.run({ mint, ...fields });
}
function saveOutcome(mint, fields) {
  stmtUpdateOutcome.run({ mint, ...fields });
}
function updateLabel12(mint, price) {
  stmtUpdateLabel12.run({ mint, price });
}
function updateLabel24(mint, price) {
  stmtUpdateLabel24.run({ mint, price });
}
function updateSeries(mint, series, nextSnapshotAt) {
  stmtUpdateSeries.run({
    mint,
    series: JSON.stringify(series),
    snapshot_count: series.length,
    next_snapshot_at: nextSnapshotAt,
  });
}

function getLaunch(mint) {
  return db.prepare('SELECT * FROM launches WHERE mint = ?').get(mint);
}

function getPendingForensics(limit = 20) {
  return db.prepare(`
    SELECT * FROM launches
    WHERE graduated_at IS NOT NULL AND forensics_done = 0
    ORDER BY graduated_at ASC
    LIMIT ?
  `).all(limit);
}

function getPendingLabels(now) {
  return db.prepare(`
    SELECT * FROM launches
    WHERE graduated_at IS NOT NULL
      AND forensics_done = 1
      AND label_48h_done = 0
      AND label_due_at <= ?
    LIMIT 50
  `).all(now);
}

function getPendingLabel12(now) {
  return db.prepare(`
    SELECT * FROM launches
    WHERE graduated_at IS NOT NULL
      AND label_12h_done = 0
      AND graduated_at + 12*60*60*1000 <= ?
    LIMIT 50
  `).all(now);
}

function getPendingLabel24(now) {
  return db.prepare(`
    SELECT * FROM launches
    WHERE graduated_at IS NOT NULL
      AND label_24h_done = 0
      AND graduated_at + 24*60*60*1000 <= ?
    LIMIT 50
  `).all(now);
}

function getPendingSnapshots(now) {
  return db.prepare(`
    SELECT * FROM launches
    WHERE graduated_at IS NOT NULL
      AND snapshot_count < 13
      AND next_snapshot_at IS NOT NULL
      AND next_snapshot_at <= ?
    LIMIT 30
  `).all(now);
}

function getDeployerPriorRugs(deployer, excludeMint) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM launches
    WHERE deployer = ? AND mint != ? AND outcome = 'rug'
  `).get(deployer, excludeMint);
  return row ? row.c : 0;
}

// Returns finished launches shaped for the wire contract
function getFinishedLaunches() {
  return db.prepare(`
    SELECT * FROM launches
    WHERE outcome IS NOT NULL
      AND outcome != 'pending'
    ORDER BY graduated_at DESC
    LIMIT 2000
  `).all();
}

module.exports = {
  db,
  getMeta, setMeta,
  getUsedCredits, addCredits, budgetOk,
  insertLaunch, markGraduated,
  saveForensics, saveOutcome,
  updateLabel12, updateLabel24, updateSeries,
  getLaunch, getPendingForensics,
  getPendingLabels, getPendingLabel12, getPendingLabel24,
  getPendingSnapshots,
  getDeployerPriorRugs,
  getFinishedLaunches,
};
