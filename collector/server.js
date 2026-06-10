'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getFinishedLaunches, getMeta, db } = require('./db');

const PORT = parseInt(process.env.PORT||'3000',10);
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN||'*' }));

app.get('/launches.json', (req, res) => {
  const rows = getFinishedLaunches();
  res.json({
    updatedAt: new Date().toISOString(),
    count: rows.length,
    launches: rows.map(r => ({
      name: r.name||'Unknown', ticker: r.ticker||'???', mint: r.mint,
      bundlePct: r.bundle_pct, devAgeDays: r.dev_age_days, devPriorRugs: r.dev_prior_rugs??0,
      top10Pct: r.top10_pct, devSoldEarly: r.dev_sold_early===1, hasSocials: r.has_socials===1,
      organicBuyers: r.organic_buyers??0, liqAtGrad: r.v_sol_at_grad,
      insiderClusterPct: r.insider_cluster_pct??0, deployerId: r.deployer_id,
      sameBlockSnipes: r.same_block_snipes??0, saleDurationMin: r.sale_duration_min,
      outcome: r.outcome, peakX: r.peak_x, hoursAlive: r.hours_alive,
      series: r.series?JSON.parse(r.series):null,
      meta: r.meta||null, metaRank: r.meta_rank||null, smartMoneyBuyers: r.smart_money_buyers||null,
    }))
  });
});

app.get('/status', (req, res) => {
  const s = db.prepare('SELECT COUNT(*) AS total,SUM(graduated_at IS NOT NULL) AS graduated,SUM(forensics_done=1) AS forensics_done,SUM(outcome IS NOT NULL) AS labeled,SUM(outcome="win") AS wins,SUM(outcome="rug") AS rugs,SUM(outcome="fade") AS fades FROM launches').get();
  const today = new Date().toISOString().slice(0,10);
  res.json({ uptime: Math.round(process.uptime()), launches: s, helius: { creditsToday: parseInt(getMeta('helius_credits_'+today,'0'),10), dailyBudget: parseInt(process.env.HELIUS_DAILY_BUDGET||'28000',10) }, ts: new Date().toISOString() });
});

const HTML = path.join(__dirname,'..','survivor-lab.html');
app.get('/', (req,res) => res.sendFile(HTML));
app.get('/survivor-lab.html', (req,res) => res.sendFile(HTML));

function start() {
  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
}
module.exports = { start };
