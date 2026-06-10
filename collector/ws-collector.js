'use strict';
const WebSocket = require('ws');
const { insertLaunch, markGraduated, getLaunch } = require('./db');

const WS_URL = 'wss://pumpportal.fun/api/data';

let reconnectDelay = 2000;
let ws = null;
let onGraduatedCallback = null;

function connect(onGraduated) {
  onGraduatedCallback = onGraduated;
  _connect();
}

function _connect() {
  console.log('[ws] connecting to', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('[ws] connected');
    reconnectDelay = 2000;
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    ws.send(JSON.stringify({ method: 'subscribeMigration' }));
    console.log('[ws] subscribed to newToken + migration');
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.txType === 'create') {
      handleCreate(msg);
    } else if (msg.txType === 'migrate' || msg.txType === 'migration') {
      handleMigration(msg);
    }
    // ignore: trade events, pings, etc.
  });

  ws.on('close', (code) => {
    console.warn(`[ws] closed (${code}), reconnecting in ${reconnectDelay}ms`);
    setTimeout(_connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  });

  ws.on('error', (err) => {
    console.error('[ws] error:', err.message);
    ws.terminate();
  });
}

function handleCreate(msg) {
  const { mint, name, symbol, traderPublicKey, uri, bondingCurveKey } = msg;
  if (!mint) return;

  insertLaunch({
    mint,
    name: name || symbol || 'Unknown',
    ticker: symbol || '???',
    deployer: traderPublicKey || '',
    created_at: Date.now(),
    uri: uri || null,
    bonding_curve: bondingCurveKey || null,
  });
}

function handleMigration(msg) {
  const mint = msg.mint || msg.baseMint;
  if (!mint) return;

  const vSol = msg.vSolInBondingCurve || msg.solAmount || null;
  const now = Date.now();

  // Ensure the launch exists (may have started before we connected)
  const existing = getLaunch(mint);
  if (!existing) {
    insertLaunch({
      mint,
      name: msg.name || 'Unknown',
      ticker: msg.symbol || '???',
      deployer: msg.traderPublicKey || '',
      created_at: now - 3600000, // unknown, estimate 1h ago
      uri: msg.uri || null,
      bonding_curve: msg.bondingCurveKey || null,
    });
  }

  markGraduated(mint, vSol, now);
  console.log(`[ws] graduated: ${mint} (${vSol?.toFixed(1)} SOL)`);

  if (onGraduatedCallback) onGraduatedCallback(mint);
}

module.exports = { connect };
