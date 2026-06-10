'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getFinishedLaunches, getMeta } = require('./db');

const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));

// ── /launches.json ────────────────────────────────────────────────────
app.get('/launches.json', (req, res) => {
  const rows = getFinishedLaunches();

  const launches = rows.map(r => ({
    name: r.name || 'Unknown',
    ticker: r.ticker || '???',
    mint: r.mint,

    // forensics (null-safe: engine handles nulls gracefully)
    bundlePct: r.bundle_pct,
    devAgeDays: r.dev_age_days,
    devPriorRugs: r.dev_prior_rugs ?? 0,
    top10Pct: r.top10_pct,
    devSoldEarly: r.dev_sold_early === 1,
    hasSocials: r.has_socials === 1,
    organicBuyers: r.organic_buyers ?? 0,
    liqAtGrad: r.v_sol_at_grad,
    insiderClusterPct: r.insider_cluster_pct ?? 0,
    deployerId: r.deployer_id,
    sameBlockSnipes: r.same_block_snipes ?? 0,
    saleDurationMin: r.sale_duration_min,

    // outcome
    outcome: r.outcome,
    peakX: r.peak_x,
    hoursAlive: r.hours_alive,

    // series: stored as JSON string, parse it
    series: r.series ? JSON.parse(r.series) : null,

    // stubs (null in v1)
    meta: r.meta || null,
    metaRank: r.meta_rank || null,
    smartMoneyBuyers: r.smart_money_buyers || null,
  }));

  res.json({
    updatedAt: new Date().toISOString(),
    count: launches.length,
    launches,
  });
});

// ── /status — operational dashboard ──────────────────────────────────
app.get('/status', (req, res) => {
  const { db } = require('./db');

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(graduated_at IS NOT NULL) AS graduated,
      SUM(forensics_done = 1) AS forensics_done,
      SUM(outcome IS NOT NULL) AS labeled,
      SUM(outcome = 'win') AS wins,
      SUM(outcome = 'rug') AS rugs,
      SUM(outcome = 'fade') AS fades
    FROM launches
  `).get();

  const today = new Date().toISOString().slice(0, 10);
  const creditsUsed = parseInt(getMeta('helius_credits_' + today, '0'), 10);

  res.json({
    uptime: Math.round(process.uptime()),
    launches: stats,
    helius: {
      creditsToday: creditsUsed,
      dailyBudget: parseInt(process.env.HELIUS_DAILY_BUDGET || '28000', 10),
    },
    ts: new Date().toISOString(),
  });
});

// ── serve survivor-lab.html ───────────────────────────────────────────
const HTML_PATH = path.join(__dirname, '..', 'survivor-lab.html');
app.get('/', (req, res) => res.sendFile(HTML_PATH));
app.get('/survivor-lab.html', (req, res) => res.sendFile(HTML_PATH));

// ── start ─────────────────────────────────────────────────────────────
function start() {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] /launches.json  – wire contract`);
    console.log(`[server] /status         – pipeline status`);
  });
}

module.exports = { start };
