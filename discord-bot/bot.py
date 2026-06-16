import asyncio
import json
import os

import aiohttp
import websockets
from dotenv import load_dotenv

load_dotenv()

WEBHOOK_URL     = os.getenv("DISCORD_WEBHOOK_URL")
ISSUER          = os.getenv("TOKEN_ISSUER", "rDTHkzTq3Acxu6QrSLVfHrR3KadFknMkfS")
CURRENCY        = os.getenv("TOKEN_CURRENCY", "CFH")
XRPL_WS         = os.getenv("XRPL_WS", "wss://xrplcluster.com")
XRPLTO_API_KEY  = os.getenv("XRPLTO_API_KEY", "")
XRPLTO_BASE     = "https://api.xrpl.to/api"
WHALE_THRESHOLD = float(os.getenv("WHALE_THRESHOLD", "1000000"))

TIER_STRONG = float(os.getenv("TIER_STRONG", "50"))
TIER_MEGA   = float(os.getenv("TIER_MEGA",   "200"))
TIER_WHALE  = float(os.getenv("TIER_WHALE",  "500"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_tier_label(xrp: float) -> str:
    if xrp >= TIER_WHALE:
        return "🐋 Whale Buy!"
    if xrp >= TIER_MEGA:
        return "💥 Mega Buy!"
    if xrp >= TIER_STRONG:
        return "🔥 Strong Buy!"
    return "🟢 Buy!"

def short_addr(addr: str) -> str:
    return f"{addr[:6]}...{addr[-4:]}"


# ── Discord webhook ───────────────────────────────────────────────────────────

async def send_webhook(content: str):
    async with aiohttp.ClientSession() as session:
        await session.post(WEBHOOK_URL, json={"content": content})


# ── Buy detection ─────────────────────────────────────────────────────────────
# Payment where Amount=CFH token + buyer's XRP balance decreased = BUY
# Excludes sells (Amount would be XRP string) and CFH transfers

def detect_buy(tx: dict, meta: dict):
    if tx.get("TransactionType") != "Payment":
        return None
    if meta.get("TransactionResult") != "tesSUCCESS":
        return None

    amount = tx.get("Amount", {})
    if not isinstance(amount, dict):
        return None
    if amount.get("currency") != CURRENCY or amount.get("issuer") != ISSUER:
        return None

    cfh_received = float(amount.get("value", 0))
    buyer = tx["Account"]
    xrp_spent = 0.0

    for node in meta.get("AffectedNodes", []):
        modified = node.get("ModifiedNode", {})
        if modified.get("LedgerEntryType") != "AccountRoot":
            continue
        final = modified.get("FinalFields", {})
        prev  = modified.get("PreviousFields", {})
        if final.get("Account") != buyer or "Balance" not in prev:
            continue
        delta = int(prev["Balance"]) - int(final["Balance"])
        if delta > 0:
            xrp_spent = delta / 1_000_000

    if xrp_spent <= 0 or cfh_received <= 0:
        return None

    return xrp_spent, cfh_received, buyer


def detect_lp_deposit(tx: dict, meta: dict):
    if tx.get("TransactionType") != "AMMDeposit":
        return None
    if meta.get("TransactionResult") != "tesSUCCESS":
        return None

    depositor = tx.get("Account", "")
    xrp_amount = 0.0
    for field in ("Amount", "Amount2"):
        val = tx.get(field)
        if isinstance(val, str):
            xrp_amount = int(val) / 1_000_000
            break

    return xrp_amount, depositor


# ── Balance check (xrpl.to first, XRPL fallback) ─────────────────────────────

async def get_token_balance(account: str) -> float:
    if XRPLTO_API_KEY:
        try:
            url = f"{XRPLTO_BASE}/account/{account}/lines"
            async with aiohttp.ClientSession() as s:
                async with s.get(url, headers={"X-Api-Key": XRPLTO_API_KEY},
                                  timeout=aiohttp.ClientTimeout(total=8)) as r:
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


# ── Alert messages ────────────────────────────────────────────────────────────

async def post_buy(xrp_spent, cfh_received, buyer, whale_bal, txn_hash):
    tier = get_tier_label(xrp_spent)
    is_whale = whale_bal >= WHALE_THRESHOLD
    lines = [f"**{CURRENCY} {tier}**"]
    if is_whale:
        lines[0] += "  |  🐋 Whale adding to bag!"
    lines += [
        f"💰 Spent: **{xrp_spent:.2f} XRP**",
        f"🪙 Got: **{cfh_received:,.0f} {CURRENCY}**",
    ]
    if is_whale:
        lines.append(f"🐋 Bag: **{whale_bal:,.0f} {CURRENCY}**")
    lines.append(f"👤 `{short_addr(buyer)}`")
    lines.append(f"[🔗 Txn](https://xrpscan.com/tx/{txn_hash})")
    await send_webhook("\n".join(lines))


async def post_lp(xrp_amount, depositor, txn_hash):
    await send_webhook(
        f"**💧 {CURRENCY} LP Deposit!**\n"
        f"💰 **{xrp_amount:.2f} XRP** added to pool\n"
        f"👤 `{short_addr(depositor)}`\n"
        f"[🔗 Txn](https://xrpscan.com/tx/{txn_hash})"
    )


# ── XRPL listener ────────────────────────────────────────────────────────────

async def main():
    await send_webhook(f"✅ **${CURRENCY} Alerts online!** Watching buys & LP deposits...")
    while True:
        try:
            async with websockets.connect(XRPL_WS, ping_interval=30) as ws:
                await ws.send(json.dumps({
                    "id": "sub", "command": "subscribe", "accounts": [ISSUER],
                }))
                print(f"[XRPL] Subscribed to {ISSUER}")

                async for raw in ws:
                    data = json.loads(raw)
                    if data.get("type") != "transaction":
                        continue

                    tx       = data.get("transaction", {})
                    meta     = data.get("meta", {})
                    txn_hash = tx.get("hash", "")

                    lp = detect_lp_deposit(tx, meta)
                    if lp:
                        await post_lp(*lp, txn_hash)
                        continue

                    buy = detect_buy(tx, meta)
                    if buy:
                        xrp_spent, cfh_received, buyer = buy
                        whale_bal = await get_token_balance(buyer)
                        await post_buy(xrp_spent, cfh_received, buyer, whale_bal, txn_hash)

        except Exception as e:
            print(f"[XRPL] Error: {e} — retrying in 5s")
            await asyncio.sleep(5)


asyncio.run(main())
