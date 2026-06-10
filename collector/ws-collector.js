'use strict';
const WebSocket = require('ws');
const { insertLaunch, markGraduated, getLaunch } = require('./db');

const WS_URL = 'wss://pumpportal.fun/api/data';
let reconnectDelay = 2000;
let onGraduatedCallback = null;

function connect(onGraduated) {
  onGraduatedCallback = onGraduated;
  _connect();
}

function _connect() {
  console.log('[ws] connecting to', WS_URL);
  const ws = new WebSocket(WS_URL);
  ws.on('open', () => {
    console.log('[ws] connected');
    reconnectDelay = 2000;
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    ws.send(JSON.stringify({ method: 'subscribeMigration' }));
  });
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.txType === 'create') {
      if (!msg.mint) return;
      insertLaunch({ mint: msg.mint, name: msg.name||msg.symbol||'Unknown', ticker: msg.symbol||'???', deployer: msg.traderPublicKey||'', created_at: Date.now(), uri: msg.uri||null, bonding_curve: msg.bondingCurveKey||null });
    } else if (msg.txType === 'migrate' || msg.txType === 'migration') {
      const mint = msg.mint || msg.baseMint;
      if (!mint) return;
      const vSol = msg.vSolInBondingCurve || msg.solAmount || null;
      const now = Date.now();
      if (!getLaunch(mint)) insertLaunch({ mint, name: msg.name||'Unknown', ticker: msg.symbol||'???', deployer: msg.traderPublicKey||'', created_at: now-3600000, uri: msg.uri||null, bonding_curve: msg.bondingCurveKey||null });
      markGraduated(mint, vSol, now);
      console.log(`[ws] graduated: ${mint}`);
      if (onGraduatedCallback) onGraduatedCallback(mint);
    }
  });
  ws.on('close', (code) => {
    console.warn(`[ws] closed (${code}), reconnecting in ${reconnectDelay}ms`);
    setTimeout(_connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  });
  ws.on('error', (err) => { console.error('[ws] error:', err.message); ws.terminate(); });
}

module.exports = { connect };
