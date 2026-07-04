'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = parseInt(process.env.PORT || '3100', 10);
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PER_IP_HOURLY_LIMIT = parseInt(process.env.PER_IP_HOURLY_LIMIT || '5', 10);
const DAILY_GLOBAL_LIMIT = parseInt(process.env.DAILY_GLOBAL_LIMIT || '150', 10);
const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const HOUR_MS = 60 * 60 * 1000;

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '200kb' }));

// In-memory only — resets on restart, which is fine for a community meme tool.
const ipHits = new Map();
let dailyCount = 0;
let dailyDay = new Date().toISOString().slice(0, 10);

function rollDailyCounter() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyDay) { dailyDay = today; dailyCount = 0; }
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter(t => now - t < HOUR_MS);
  ipHits.set(ip, hits);
  return hits.length >= PER_IP_HOURLY_LIMIT;
}

function recordHit(ip) {
  const hits = ipHits.get(ip) || [];
  hits.push(Date.now());
  ipHits.set(ip, hits);
}

app.post('/generate', async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'This server has no OPENAI_API_KEY configured yet.' });
  }

  rollDailyCounter();
  if (dailyCount >= DAILY_GLOBAL_LIMIT) {
    return res.status(429).json({ error: 'Daily image budget for the whole site has been reached — try again tomorrow.' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: `You've hit the per-hour limit (${PER_IP_HOURLY_LIMIT} images). Try again later.` });
  }

  const { prompt, size } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) {
    return res.status(400).json({ error: 'Missing or invalid prompt.' });
  }
  const finalSize = ALLOWED_SIZES.includes(size) ? size : '1024x1024';

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: finalSize, n: 1 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `OpenAI request failed (${r.status})`);
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image returned.');

    recordHit(ip);
    dailyCount++;
    res.json({ image: 'data:image/png;base64,' + b64 });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/status', (req, res) => {
  rollDailyCounter();
  res.json({ ok: true, dailyCount, dailyLimit: DAILY_GLOBAL_LIMIT });
});

app.listen(PORT, () => console.log(`[meme-api] listening on :${PORT}`));
