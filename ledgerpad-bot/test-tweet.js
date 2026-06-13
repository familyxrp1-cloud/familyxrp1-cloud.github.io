/**
 * Run this to preview all 10 tweet formats without posting anything.
 * Usage: node test-tweet.js
 */
require('dotenv').config();
const { TWEET_SCHEDULE } = require('./tweets');

const LABELS = [
  'morning-price',
  'market-compare',
  'pad-update',
  'news-flash',
  'volume-check',
  'xrpl-network',
  'market-cap-rank',
  'pad-spotlight',
  'evening-wrap',
  'community',
];

(async () => {
  console.log('🧪 Previewing all 10 tweet formats (no posting)\n');
  for (let i = 0; i < TWEET_SCHEDULE.length; i++) {
    const label = LABELS[i];
    let text;
    try {
      text = await TWEET_SCHEDULE[i]();
    } catch (err) {
      text = `[ERROR] ${err.message}`;
    }
    const charCount = text ? text.length : 0;
    const over = charCount > 280 ? ` ⚠️  OVER LIMIT (${charCount})` : ` ✅ ${charCount}/280`;
    console.log(`\n[${'#' + (i + 1)} ${label}]${over}`);
    console.log('─'.repeat(60));
    console.log(text ?? '[null — data unavailable]');
    console.log('─'.repeat(60));
  }
  console.log('\n✅ Preview complete');
})();
