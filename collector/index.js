'use strict';
require('dotenv').config();
const { getPendingForensics, budgetOk } = require('./db');
const { connect: connectWs } = require('./ws-collector');
const { runForensics } = require('./forensics');
const { start: startLabeler } = require('./labeler');
const { start: startServer } = require('./server');

const DAILY_BUDGET = parseInt(process.env.HELIUS_DAILY_BUDGET||'28000',10);
const pendingForensics = new Set();
let forensicsRunning = false;

function enqueue(mint) { pendingForensics.add(mint); }

async function drain() {
  if (forensicsRunning) return;
  forensicsRunning = true;
  while (pendingForensics.size > 0) {
    if (!budgetOk(DAILY_BUDGET)) { console.warn('[forensics] budget exhausted'); break; }
    const [mint] = pendingForensics;
    pendingForensics.delete(mint);
    const { getLaunch } = require('./db');
    const l = getLaunch(mint);
    if (l && !l.forensics_done) await runForensics(l).catch(e => console.error('[forensics]', e.message));
    await sleep(1500);
  }
  forensicsRunning = false;
}

async function main() {
  console.log('=== SURVIVOR LAB COLLECTOR ===');
  console.log(`Helius: ${process.env.HELIUS_KEY ? 'key set' : 'using Ankr public RPC'}`);
  startServer();
  getPendingForensics(50).forEach(r => enqueue(r.mint));
  startLabeler();
  connectWs(mint => enqueue(mint));
  setInterval(drain, 10000);
  drain();
  console.log('[main] running');
}

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
