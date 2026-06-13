/**
 * LedgerPad token launch & graduation monitor.
 *
 * Launch detection:
 *   Watch the LedgerPad fee wallet on XRPL. When ~2 XRP arrives,
 *   that's a new token launch. We then query the sender's recent
 *   transactions to find the AMMCreate/token details.
 *
 * Graduation detection:
 *   Track all senders from launches. When one of them submits
 *   an AMMCreate transaction, that's graduation to the full DEX.
 */

require('dotenv').config();
const WebSocket = require('ws');
const fetch = require('node-fetch');
const seen = require('./seen');

const XRPL_WS = 'wss://xrplcluster.com';
const XRPL_HTTP = 'https://xrplcluster.com';

const FEE_WALLET = process.env.PAD_FEE_WALLET;
const LAUNCH_AMOUNT_XRP = parseFloat(process.env.PAD_LAUNCH_FEE_XRP ?? '2');

// In-memory set of issuer addresses from detected launches (for graduation tracking)
const trackedIssuers = new Set();

// ── XRPL helpers ─────────────────────────────────────────────────────────────

async function xrplRequest(method, params = {}) {
  try {
    const res = await fetch(XRPL_HTTP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params: [params] }),
      timeout: 10000,
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch (err) {
    console.error(`[launcher] xrplRequest "${method}" failed:`, err.message);
    return null;
  }
}

async function getAccountTransactions(account, limit = 10) {
  const result = await xrplRequest('account_tx', {
    account,
    limit,
    ledger_index_min: -1,
    ledger_index_max: -1,
  });
  return result?.transactions ?? [];
}

async function getAccountInfo(account) {
  const result = await xrplRequest('account_info', {
    account,
    ledger_index: 'validated',
  });
  return result?.account_data ?? null;
}

// Pull token details from AMMCreate or recent txns by the issuer
async function resolveTokenFromIssuer(issuerAddress) {
  const txns = await getAccountTransactions(issuerAddress, 20);

  // Prefer AMMCreate — contains both assets directly
  const ammCreate = txns.find((t) => t.tx?.TransactionType === 'AMMCreate');
  if (ammCreate) {
    const { Amount, Amount2 } = ammCreate.tx;
    const token = [Amount, Amount2].find(
      (a) => typeof a === 'object' && a.currency !== 'XRP'
    );
    if (token) {
      return {
        currency: token.currency,
        issuer: token.issuer ?? issuerAddress,
        initialLiquidityXrp: extractXrpDrops(Amount, Amount2),
        txHash: ammCreate.tx.hash,
      };
    }
  }

  // Fallback: look for a TrustSet (issuer setting up their own trust line)
  const trustSet = txns.find((t) => t.tx?.TransactionType === 'TrustSet');
  if (trustSet) {
    const limit = trustSet.tx?.LimitAmount;
    return {
      currency: limit?.currency ?? '???',
      issuer: limit?.issuer ?? issuerAddress,
      initialLiquidityXrp: null,
      txHash: trustSet.tx.hash,
    };
  }

  return { currency: '???', issuer: issuerAddress, initialLiquidityXrp: null, txHash: null };
}

function extractXrpDrops(a, b) {
  const xrpSide = [a, b].find((x) => typeof x === 'string');
  if (!xrpSide) return null;
  return (parseInt(xrpSide, 10) / 1_000_000).toFixed(2);
}

function dropsToXrp(drops) {
  return (parseInt(drops, 10) / 1_000_000).toFixed(4);
}

// ── Tweet builders ────────────────────────────────────────────────────────────

function buildLaunchTweet({ currency, issuer, txHash }) {
  const ticker = formatCurrency(currency);
  const lines = [
    `🚀 New token launched on #LedgerPad!`,
    ``,
    `🪙 Token: $${ticker}`,
    `🔗 Issuer: ${issuer.slice(0, 8)}...${issuer.slice(-4)}`,
    ``,
    `Be early. Trade it now on LedgerPad 👇`,
    `🌐 ledgerpad.net`,
    ``,
    `#XRPL #XRP #PAD #NewLaunch #LedgerPad`,
  ];
  return lines.join('\n');
}

function buildGraduationTweet({ currency, issuer, initialLiquidityXrp, txHash }) {
  const ticker = formatCurrency(currency);
  const liqLine = initialLiquidityXrp
    ? `\n💧 Initial liquidity: ${initialLiquidityXrp} XRP`
    : '';
  const lines = [
    `🎓 $${ticker} just GRADUATED on #LedgerPad!`,
    ``,
    `Token has hit the bonding curve and is now live on the #XRPL DEX.`,
    liqLine,
    ``,
    `📈 Catch it early — trade on LedgerPad:`,
    `🌐 ledgerpad.net`,
    ``,
    `#XRPL #XRP #PAD #Graduated #LedgerPad #DeFi`,
  ];
  return lines.filter((l) => l !== '').join('\n');
}

// Hex currency codes → readable string
function formatCurrency(currency) {
  if (!currency || currency.length <= 4) return currency ?? '???';
  // XRPL hex-encoded currency
  try {
    const hex = currency.replace(/00+$/, '');
    const str = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '').trim();
    return str || currency.slice(0, 8);
  } catch {
    return currency.slice(0, 8);
  }
}

// ── WebSocket monitor ─────────────────────────────────────────────────────────

function startXrplMonitor(postFn) {
  if (!FEE_WALLET) {
    console.warn('[launcher] PAD_FEE_WALLET not set — launch/graduation monitoring disabled');
    return;
  }

  let ws;
  let reconnectDelay = 2000;

  function connect() {
    console.log(`[launcher] Connecting to XRPL WebSocket...`);
    ws = new WebSocket(XRPL_WS);

    ws.on('open', () => {
      reconnectDelay = 2000;
      console.log(`[launcher] Connected. Watching fee wallet: ${FEE_WALLET}`);
      // Subscribe to all validated transactions for the fee wallet
      ws.send(JSON.stringify({
        command: 'subscribe',
        accounts: [FEE_WALLET],
      }));
    });

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type !== 'transaction') return;
      const tx = msg.transaction;
      if (!tx) return;

      // ── Launch detection: Payment of ~2 XRP arriving at fee wallet ───────
      if (
        tx.TransactionType === 'Payment' &&
        tx.Destination === FEE_WALLET &&
        typeof tx.Amount === 'string' // XRP is a string in drops
      ) {
        const xrpAmount = parseInt(tx.Amount, 10) / 1_000_000;
        if (Math.abs(xrpAmount - LAUNCH_AMOUNT_XRP) <= 0.5) {
          const issuerAddress = tx.Account;
          const launchKey = `launch:${tx.hash}`;

          if (seen.has(launchKey)) return;
          seen.add(launchKey);
          trackedIssuers.add(issuerAddress);

          console.log(`[launcher] 🚀 Launch detected from ${issuerAddress} (${xrpAmount} XRP fee)`);

          // Short wait for issuer's follow-up txns to land
          setTimeout(async () => {
            const tokenInfo = await resolveTokenFromIssuer(issuerAddress);
            const text = buildLaunchTweet({ ...tokenInfo, issuer: issuerAddress });
            await postFn(text, `launch:${tokenInfo.currency}`);
          }, 5000);
        }
        return;
      }

      // ── Graduation detection: AMMCreate from a tracked issuer ─────────────
      if (
        tx.TransactionType === 'AMMCreate' &&
        trackedIssuers.has(tx.Account)
      ) {
        const gradKey = `grad:${tx.hash}`;
        if (seen.has(gradKey)) return;
        seen.add(gradKey);

        const { Amount, Amount2 } = tx;
        const token = [Amount, Amount2].find(
          (a) => typeof a === 'object' && a.currency
        );
        if (!token) return;

        const currency = token.currency;
        const liqXrp = extractXrpDrops(Amount, Amount2);

        console.log(`[launcher] 🎓 Graduation detected — $${formatCurrency(currency)}`);
        const text = buildGraduationTweet({
          currency,
          issuer: tx.Account,
          initialLiquidityXrp: liqXrp,
          txHash: tx.hash,
        });
        await postFn(text, `grad:${currency}`);
      }
    });

    ws.on('close', () => {
      console.log(`[launcher] WebSocket closed — reconnecting in ${reconnectDelay / 1000}s`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    });

    ws.on('error', (err) => {
      console.error('[launcher] WebSocket error:', err.message);
    });
  }

  connect();
}

module.exports = { startXrplMonitor };
