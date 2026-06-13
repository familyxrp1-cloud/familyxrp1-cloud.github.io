require('dotenv').config();
const cron = require('node-cron');
const { TwitterApi } = require('twitter-api-v2');
const { TWEET_SCHEDULE } = require('./tweets');
const { startXrplMonitor } = require('./launcher');

const DRY_RUN = process.env.DRY_RUN === 'true';

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = client.readWrite;

async function postTweet(builderFn, label) {
  let text;
  try {
    text = await builderFn();
  } catch (err) {
    console.error(`[bot] Error building tweet "${label}":`, err.message);
    return;
  }

  if (!text) {
    console.log(`[bot] Skipping "${label}" — no content (data unavailable)`);
    return;
  }

  if (text.length > 280) {
    // Trim to 280 chars at last newline boundary
    text = text.slice(0, 277) + '...';
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would post "${label}":\n${'─'.repeat(60)}\n${text}\n${'─'.repeat(60)}\n`);
    return;
  }

  try {
    const { data } = await rwClient.v2.tweet(text);
    console.log(`[bot] Posted "${label}" → tweet id ${data.id}`);
  } catch (err) {
    console.error(`[bot] Failed to post "${label}":`, err.message);
  }
}

// ── Schedule — times are in UTC ───────────────────────────────────────────────
// 10 tweets/day, evenly spread from 06:00 to 22:00 UTC
const SCHEDULE = [
  { cron: '0 6 * * *',  idx: 0, label: 'morning-price' },
  { cron: '0 8 * * *',  idx: 1, label: 'market-compare' },
  { cron: '0 10 * * *', idx: 2, label: 'pad-update' },
  { cron: '0 12 * * *', idx: 3, label: 'news-flash' },
  { cron: '30 13 * * *',idx: 4, label: 'volume-check' },
  { cron: '0 15 * * *', idx: 5, label: 'xrpl-network' },
  { cron: '30 16 * * *',idx: 6, label: 'market-cap-rank' },
  { cron: '0 18 * * *', idx: 7, label: 'pad-spotlight' },
  { cron: '0 20 * * *', idx: 8, label: 'evening-wrap' },
  { cron: '0 22 * * *', idx: 9, label: 'community' },
];

for (const { cron: expr, idx, label } of SCHEDULE) {
  cron.schedule(expr, () => postTweet(TWEET_SCHEDULE[idx], label), { timezone: 'UTC' });
  console.log(`[bot] Scheduled "${label}" at ${expr} UTC`);
}

// ── Launch & graduation monitor ───────────────────────────────────────────────
// Fires immediately on XRPL events (not on a schedule)
startXrplMonitor(async (text, label) => {
  if (!text) return;
  if (text.length > 280) text = text.slice(0, 277) + '...';
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would post "${label}":\n${'─'.repeat(60)}\n${text}\n${'─'.repeat(60)}\n`);
    return;
  }
  try {
    const { data } = await rwClient.v2.tweet(text);
    console.log(`[bot] Posted "${label}" → tweet id ${data.id}`);
  } catch (err) {
    console.error(`[bot] Failed to post "${label}":`, err.message);
  }
});

console.log(`\n🚀 LedgerPad X Bot started — ${DRY_RUN ? 'DRY RUN mode' : 'LIVE mode'}`);
console.log('📅 10 scheduled tweets/day, 06:00–22:00 UTC');
console.log('⚡ Launch & graduation alerts: real-time via XRPL WebSocket\n');

// Keep alive
process.on('SIGINT', () => {
  console.log('\n[bot] Shutting down gracefully...');
  process.exit(0);
});
