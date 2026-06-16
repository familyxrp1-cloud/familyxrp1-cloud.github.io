import asyncio
import json
import os

import aiohttp
import discord
import websockets
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN   = os.getenv("DISCORD_TOKEN")
CHANNEL_ID      = int(os.getenv("DISCORD_CHANNEL_ID", "0"))
ISSUER          = os.getenv("TOKEN_ISSUER", "rDTHkzTq3Acxu6QrSLVfHrR3KadFknMkfS")
CURRENCY        = os.getenv("TOKEN_CURRENCY", "CFH")
XRPL_WS         = os.getenv("XRPL_WS", "wss://xrplcluster.com")
XRPLTO_API_KEY  = os.getenv("XRPLTO_API_KEY", "")
XRPLTO_BASE     = "https://api.xrpl.to/api"
WHALE_THRESHOLD = float(os.getenv("WHALE_THRESHOLD", "1000000"))

# Buy tier thresholds in XRP
TIER_STRONG = float(os.getenv("TIER_STRONG", "50"))
TIER_MEGA   = float(os.getenv("TIER_MEGA",   "200"))
TIER_WHALE  = float(os.getenv("TIER_WHALE",  "500"))

intents = discord.Intents.default()
bot = discord.Client(intents=intents)


# ── Helpers ──────────────────────────────────────────────────────────────────

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


# ── Buy detection ─────────────────────────────────────────────────────────────
# Only Payment transactions where:
#   tx.Amount = CFH token object  (receiver gets CFH)
#   sender's XRP balance decreases (they paid XRP)
# This correctly excludes sells (Amount would be XRP string, SendMax would be CFH)
# and pure CFH-to-CFH transfers.

def detect_buy(tx: dict, meta: dict):
    """
    Returns (xrp_spent, cfh_received, buyer) if this is a CFH buy, else None.
    """
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
        if final.get("Account") != buyer:
            continue
        if "Balance" not in prev:
            continue
        delta = int(prev["Balance"]) - int(final["Balance"])
        if delta > 0:
            xrp_spent = delta / 1_000_000

    if xrp_spent <= 0 or cfh_received <= 0:
        return None

    return xrp_spent, cfh_received, buyer


def detect_lp_deposit(tx: dict, meta: dict):
    """
    Returns (xrp_amount, depositor) for AMMDeposit transactions, else None.
    """
    if tx.get("TransactionType") != "AMMDeposit":
        return None
    if meta.get("TransactionResult") != "tesSUCCESS":
        return None

    depositor = tx.get("Account", "")
    xrp_amount = 0.0

    # Amount or Amount2 may be the XRP side of the deposit
    for field in ("Amount", "Amount2"):
        val = tx.get(field)
        if isinstance(val, str):          # XRP expressed as drops string
            xrp_amount = int(val) / 1_000_000
            break

    return xrp_amount, depositor


# ── Balance check (xrpl.to API preferred, falls back to raw XRPL) ────────────

async def get_token_balance(account: str) -> float:
    # Try xrpl.to REST API first — faster than opening a new WS connection
    if XRPLTO_API_KEY:
        try:
            url = f"{XRPLTO_BASE}/account/{account}/lines"
            headers = {"X-Api-Key": XRPLTO_API_KEY}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for line in data.get("lines", []):
                            if line.get("currency") == CURRENCY and line.get("account") == ISSUER:
                                return float(line.get("balance", 0))
        except Exception:
            pass  # fall through to XRPL websocket

    # Fallback: raw XRPL websocket
    try:
        async with websockets.connect(XRPL_WS, open_timeout=10) as ws:
            await ws.send(json.dumps({
                "id": 1,
                "command": "account_lines",
                "account": account,
                "ledger_index": "validated",
            }))
            resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            for line in resp.get("result", {}).get("lines", []):
                if line.get("currency") == CURRENCY and line.get("account") == ISSUER:
                    return float(line.get("balance", 0))
    except Exception:
        pass
    return 0.0


# ── Discord messages ──────────────────────────────────────────────────────────

async def post_buy(channel, xrp_spent, cfh_received, buyer, whale_bal):
    tier   = get_tier_label(xrp_spent)
    is_whale = whale_bal >= WHALE_THRESHOLD
    header = f"**{CURRENCY} {tier}**"
    if is_whale:
        header += "  |  🐋 Whale adding to bag!"

    lines = [
        header,
        f"💰 Spent: **{xrp_spent:.2f} XRP**",
        f"🪙 Got: **{cfh_received:,.0f} {CURRENCY}**",
    ]
    if is_whale:
        lines.append(f"🐋 Whale bag: **{whale_bal:,.0f} {CURRENCY}**")
    lines.append(f"👤 `{short_addr(buyer)}`")

    await channel.send("\n".join(lines))


async def post_lp(channel, xrp_amount, depositor, txn_hash):
    msg = (
        f"**💧 {CURRENCY} LP Deposit!**\n"
        f"💰 **{xrp_amount:.2f} XRP** added to pool\n"
        f"👤 `{short_addr(depositor)}`\n"
        f"[🔗 Txn](https://xrpscan.com/tx/{txn_hash})"
    )
    await channel.send(msg)


# ── XRPL listener ────────────────────────────────────────────────────────────

async def xrpl_listener(channel):
    while True:
        try:
            async with websockets.connect(XRPL_WS, ping_interval=30) as ws:
                await ws.send(json.dumps({
                    "id": "sub",
                    "command": "subscribe",
                    "accounts": [ISSUER],
                }))
                print(f"[XRPL] Subscribed to {ISSUER}")
                await channel.send(
                    f"✅ **${CURRENCY} Alerts online!** Watching buys & LP deposits..."
                )

                async for raw in ws:
                    data = json.loads(raw)
                    if data.get("type") != "transaction":
                        continue

                    tx   = data.get("transaction", {})
                    meta = data.get("meta", {})
                    txn_hash = tx.get("hash", "")

                    # LP deposit
                    lp = detect_lp_deposit(tx, meta)
                    if lp:
                        xrp_amount, depositor = lp
                        await post_lp(channel, xrp_amount, depositor, txn_hash)
                        continue

                    # Buy
                    buy = detect_buy(tx, meta)
                    if buy:
                        xrp_spent, cfh_received, buyer = buy
                        whale_bal = await get_token_balance(buyer)
                        await post_buy(channel, xrp_spent, cfh_received, buyer, whale_bal)

        except Exception as e:
            print(f"[XRPL] Disconnected: {e} — retrying in 5s")
            await asyncio.sleep(5)


# ── Discord startup ───────────────────────────────────────────────────────────

@bot.event
async def on_ready():
    print(f"[Discord] Logged in as {bot.user}")
    channel = bot.get_channel(CHANNEL_ID)
    if not channel:
        print(f"[Discord] ERROR: Channel {CHANNEL_ID} not found")
        return
    asyncio.create_task(xrpl_listener(channel))


bot.run(DISCORD_TOKEN)
