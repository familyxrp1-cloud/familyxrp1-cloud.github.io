'use strict';
require('dotenv').config();

const { getPendingForensics, budgetOk } = require('./db');
const { connect: connectWs } = require('./ws-collector');
const { runForensics } = require('./forensics');
const { start: startLabeler } = require('./labeler');
const { start: startServer } = require('./server');

const DAILY_BUDGET = parseInt(process.env.HELIUS_DAILY_BUDGET || '28000', 10);
const FORENSICS_QUEUE_MAX = parseInt(process.env.FORENSICS_QUEUE_MAX || '500', 10);

// ── forensics queue ───────────────────────────────────────────────────
// Simple FIFO set: mint addresses waiting for stage-2 forensics
const pendingForensics = new Set();
let forensicsRunning = false;

function enqueueForensics(mint) {
  if (pendingForensics.size >= FORENSICS_QUEUE_MAX) {
    console.warn('[forensics queue] full, dropping', mint);
    return;
  }
  pendingForensics.add(mint);
}

async function drainForensicsQueue() {
  if (forensicsRunning) return;
  forensicsRunning = true;

  while (pendingForensics.size > 0) {
    if (!budgetOk(DAILY_BUDGET)) {
      console.warn('[forensics] daily Helius budget exhausted, pausing until tomorrow');
      break;
    }

    const [mint] = pendingForensics;
    pendingForensics.delete(mint);

    const { getLaunch } = require('./db');
    const launch = getLaunch(mint);
    if (launch && !launch.forensics_done) {
      await runForensics(launch).catch(e =>
        console.error('[forensics] unhandled error:', e.message)
      );
    }

    // Breathe between tokens
    await sleep(1500);
  }

  forensicsRunning = false;
}

// ── recover any backlog from DB on startup ────────────────────────────
function loadBacklog() {
  const backlog = getPendingForensics(50);
  if (backlog.length > 0) {
    console.log(`[startup] ${backlog.length} graduated tokens awaiting forensics`);
    backlog.forEach(r => enqueueForensics(r.mint));
  }
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('=== SURVIVOR LAB COLLECTOR ===');
  console.log(`Helius key: ${process.env.HELIUS_KEY ? '✓ set' : '✗ missing (forensics will be skipped)'}`);
  console.log(`Daily budget: ${DAILY_BUDGET} Helius credits`);
  console.log('');

  // Start HTTP server
  startServer();

  // Load backlogged forensics from previous run
  loadBacklog();

  // Start labeler (polls Dexscreener every 5 min)
  startLabeler();

  // Connect to PumpPortal WebSocket
  connectWs((mint) => {
    enqueueForensics(mint);
  });

  // Drain forensics queue on an interval (separate from WebSocket events)
  setInterval(drainForensicsQueue, 10000); // check every 10s
  drainForensicsQueue(); // run immediately for backlog

  console.log('[main] all subsystems started');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
