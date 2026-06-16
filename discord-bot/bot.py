import asyncio
import json
import os

import aiohttp
import discord
import websockets
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN   = os.getenv("DISCORD_TOKEN")
CHANNEL_NAME    = os.getenv("DISCORD_CHANNEL_NAME", "test")
ISSUER          = os.getenv("TOKEN_ISSUER", "rDTHkzTq3Acxu6QrSLVfHrR3KadFknMkfS")
CURRENCY        = os.getenv("TOKEN_CURRENCY", "CFH")
XRPL_WS         = os.getenv("XRPL_WS", "wss://xrplcluster.com")
XRPLTO_API_KEY  = os.getenv("XRPLTO_API_KEY", "")
XRPLTO_BASE     = "https://api.xrpl.to/api"
WHALE_THRESHOLD = float(os.getenv("WHALE_THRESHOLD", "1000000"))
CHART_URL       = os.getenv("CHART_URL", f"https://xrpl.to/en/token/CFH+rDTHkzTq3Acxu6QrSLVfHrR3KadFknMkfS")
BUY_URL         = os.getenv("BUY_URL",   f"https://xrpl.to/en/token/CFH+rDTHkzTq3Acxu6QrSLVfHrR3KadFknMkfS")

TIER_STRONG = float(os.getenv("TIER_STRONG", "50"))
TIER_MEGA   = float(os.getenv("TIER_MEGA",   "200"))
TIER_WHALE  = float(os.getenv("TIER_WHALE",  "500"))

intents = discord.Intents.default()
bot = discord.Client(intents=intents)


# ── Helpers ───────────────────────────────────────────────────────────────────

def tier_label(xrp: float) -> str:
    if xrp >= TIER_WHALE:  return "🐋 Whale Buy!"
    if xrp >= TIER_MEGA:   return "💥 Mega Buy!"
    if xrp >= TIER_STRONG: return "🔥 Strong Buy!"
    return "🟢 Buy!"

def short_addr(addr: str) -> str:
    return f"{addr[:6]}...{addr[-4:]}"

def fmt_amount(val: float) -> str:
    if val >= 1_000_000: return f"{val/1_000_000:.4f}M"
    if val >= 1_000:     return f"{val:,.2f}"
    return f"{val:.4f}"


# ── Universal buy detection ───────────────────────────────────────────────────
# Works for Payment (AMM swaps) AND OfferCreate (order book fills).
# Detects by reading ACTUAL balance changes in metadata — not tx fields.
# This avoids the "tx.Amount is max requested not actual delivered" bug.
# Only alerts when CFH is actually received in the transaction (not maker orders).

def detect_buy(tx: dict, meta: dict):
    if tx.get("TransactionType") in ("AMMDeposit", "AMMWithdraw", "AMMCreate", "AMMVote", "AMMBid"):
        return None
    if meta.get("TransactionResult") != "tesSUCCESS":
        return None

    account   = tx["Account"]
    fee_drops = int(tx.get("Fee", 0))
    xrp_drop_decrease = 0
    cfh_received      = 0.0

    for node in meta.get("AffectedNodes", []):
        for ntype in ("ModifiedNode", "CreatedNode"):
            n = node.get(ntype)
            if not n:
                continue

            etype = n.get("LedgerEntryType")
            final = n.get("FinalFields") or n.get("NewFields", {})
            prev  = n.get("PreviousFields", {})

            # XRP spent: buyer's AccountRoot balance decrease (includes fee)
            if etype == "AccountRoot" and final.get("Account") == account:
                if "Balance" in prev:
                    xrp_drop_decrease = int(prev["Balance"]) - int(final["Balance"])

            # CFH received: RippleState that links BUYER ↔ ISSUER only
            if etype == "RippleState":
                bal     = final.get("Balance", {})
                prev_bal = prev.get("Balance", {})
                if bal.get("currency") != CURRENCY:
                    continue

                low_acc  = final.get("LowLimit",  {}).get("issuer", "")
                high_acc = final.get("HighLimit", {}).get("issuer", "")

                # Skip any trust line that doesn't involve BOTH buyer and issuer
                if ISSUER not in {low_acc, high_acc}:
                    continue
                if account not in {low_acc, high_acc}:
                    continue
                if "value" not in prev_bal:
                    continue

                prev_val  = float(prev_bal["value"])
                final_val = float(bal["value"])

                # Balance is always stored from LOW account's perspective.
                # Positive = HIGH account holds the tokens.
                # Negative = LOW account holds abs(balance) tokens.
                if account == low_acc:
                    # Buyer is LOW: balance goes more negative as buyer accumulates = prev - final
                    delta = prev_val - final_val
                else:
                    # Buyer is HIGH: balance goes more positive as buyer accumulates = final - prev
                    delta = final_val - prev_val

                if delta > 0:
                    cfh_received += delta

    # Subtract fee so xrp_spent reflects only the trade cost
    xrp_spent = (xrp_drop_decrease - fee_drops) / 1_000_000

    if xrp_spent > 0.001 and cfh_received > 0:
        return xrp_spent, cfh_received, account
    return None


# ── LP deposit detection ──────────────────────────────────────────────────────
# AMMDeposit is its own transaction type — completely separate from buys.
# Can be single-sided (XRP only or CFH only) or two-sided (both assets).

def detect_lp(tx: dict, meta: dict):
    if tx.get("TransactionType") != "AMMDeposit":
        return None
    if meta.get("TransactionResult") != "tesSUCCESS":
        return None

    depositor  = tx.get("Account", "")
    xrp_amount = 0.0
    cfh_amount = 0.0

    for field in ("Amount", "Amount2"):
        val = tx.get(field)
        if isinstance(val, str):  # XRP is always a drops string
            xrp_amount = int(val) / 1_000_000
        elif isinstance(val, dict):
            if val.get("currency") == CURRENCY and val.get("issuer") == ISSUER:
                cfh_amount = float(val.get("value", 0))

    return xrp_amount, cfh_amount, depositor


# ── Whale balance check ───────────────────────────────────────────────────────

async def get_cfh_balance(account: str) -> float:
    if XRPLTO_API_KEY:
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(
                    f"{XRPLTO_BASE}/account/{account}/lines",
                    headers={"X-Api-Key": XRPLTO_API_KEY},
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as r:
                    if r.status == 200:
                        for line in (await r.json()).get("lines", []):
                            if line.get("currency") == CURRENCY and line.get("account") == ISSUER:
                                return float(line.get("balance", 0))
        except Exception:
            pass

    try:
        async with websockets.connect(XRPL_WS, open_timeout=10) as ws:
            await ws.send(json.dumps({
                "id": 1, "command": "account_lines",
                "account": account, "ledger_index": "validated",
            }))
            resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            for line in resp.get("result", {}).get("lines", []):
                if line.get("currency") == CURRENCY and line.get("account") == ISSUER:
                    return float(line.get("balance", 0))
    except Exception:
        pass
    return 0.0


# ── Discord alerts ────────────────────────────────────────────────────────────

async def post_buy(ch, xrp_spent, cfh_received, buyer, whale_bal, txn_hash):
    label    = tier_label(xrp_spent)
    is_whale = whale_bal >= WHALE_THRESHOLD

    header = f"{label.split()[0]} {CURRENCY} {' '.join(label.split()[1:])}"
    if is_whale:
        header += " | 🐋 Whale adding to bag!"

    body = (
        f"{header}\n"
        f"💰 Spent: **{xrp_spent:.2f} XRP**\n"
        f"🪙 Got: **{fmt_amount(cfh_received)} {CURRENCY}**\n"
    )
    if is_whale:
        body += f"🐋 Bag: **{fmt_amount(whale_bal)} {CURRENCY}**\n"
    body += (
        f"👤 {short_addr(buyer)}\n\n"
        f"[📊 Chart]({CHART_URL}) • "
        f"[🔗 Txn](https://xrpscan.com/tx/{txn_hash}) • "
        f"[🛒 Buy]({BUY_URL})\n"
        f"{CURRENCY} • XRPL"
    )
    await ch.send(body)


async def post_lp(ch, xrp_amount, cfh_amount, depositor, txn_hash):
    lines = [f"💧 {CURRENCY} LP Deposit!"]
    if xrp_amount > 0:
        lines.append(f"🪙 **{xrp_amount:.2f} XRP** added to pool")
    if cfh_amount > 0:
        lines.append(f"🪙 **{fmt_amount(cfh_amount)} {CURRENCY}** added to pool")
    lines.append(f"👤 {short_addr(depositor)}")
    lines.append(f"\n[🔗 Txn](https://xrpscan.com/tx/{txn_hash})\n{CURRENCY} • XRPL")
    await ch.send("\n".join(lines))


# ── XRPL listener ────────────────────────────────────────────────────────────
# AMM pool discovery runs on the SAME connection as the subscription so we
# don't waste a separate socket and avoid race-condition timeouts.

async def xrpl_listener(channel):
    while True:
        try:
            async with websockets.connect(XRPL_WS, ping_interval=30) as ws:
                # Step 1: query AMM pool address on this connection
                await ws.send(json.dumps({
                    "id": "amm_query",
                    "command": "amm_info",
                    "asset":  {"currency": CURRENCY, "issuer": ISSUER},
                    "asset2": {"currency": "XRP"},
                    "ledger_index": "validated",
                }))
                amm_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                print(f"[XRPL] amm_info raw: {json.dumps(amm_resp)[:300]}")
                amm_account = amm_resp.get("result", {}).get("amm", {}).get("account", "")
                if amm_account:
                    print(f"[XRPL] AMM pool: {amm_account}")
                else:
                    print(f"[XRPL] WARNING: AMM account not found — subscribing to issuer only")

                accounts = [ISSUER] + ([amm_account] if amm_account else [])

                # Step 2: subscribe to accounts on this same connection
                await ws.send(json.dumps({
                    "id": "sub", "command": "subscribe", "accounts": accounts,
                }))
                print(f"[XRPL] Subscribed to {accounts}")

                # Step 3: consume subscribe confirmation (not a "transaction" type)
                sub_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                print(f"[XRPL] subscribe ack: {json.dumps(sub_resp)[:200]}")

                seen = set()
                async for raw in ws:
                    data = json.loads(raw)
                    if data.get("type") != "transaction":
                        continue

                    tx       = data.get("transaction", {})
                    meta     = data.get("meta", {})
                    txn_hash = tx.get("hash", "")

                    if txn_hash in seen:
                        continue
                    seen.add(txn_hash)
                    if len(seen) > 500:
                        seen = set(list(seen)[-250:])

                    lp = detect_lp(tx, meta)
                    if lp:
                        xrp_amt, cfh_amt, depositor = lp
                        await post_lp(channel, xrp_amt, cfh_amt, depositor, txn_hash)
                        continue

                    buy = detect_buy(tx, meta)
                    if buy:
                        xrp_spent, cfh_received, buyer = buy
                        whale_bal = await get_cfh_balance(buyer)
                        await post_buy(channel, xrp_spent, cfh_received, buyer, whale_bal, txn_hash)

        except Exception as e:
            print(f"[XRPL] Error: {e} — reconnecting in 5s")
            await asyncio.sleep(5)


# ── Discord startup ───────────────────────────────────────────────────────────

@bot.event
async def on_ready():
    print(f"[Discord] Logged in as {bot.user}")
    channel = discord.utils.get(bot.get_all_channels(), name=CHANNEL_NAME)
    if not channel:
        print(f"[Discord] ERROR: no channel named #{CHANNEL_NAME}")
        return
    await channel.send(f"✅ **${CURRENCY} Alerts online!** Watching buys & LP deposits...")
    asyncio.create_task(xrpl_listener(channel))


bot.run(DISCORD_TOKEN)
