import { Droplet, TrendingUp, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { lpLake } from "@/lib/demo-data";

export default function LPLakePage() {
  return (
    <PageShell
      icon={<Droplet size={22} />}
      title="LP Lake"
      tagline={lpLake.tagline}
      accent="mint"
    >
      <div className="flex flex-col items-center">
        <div className="pulse-glow grid h-24 w-24 place-items-center rounded-full bg-mint/10 chip">
          <Droplet size={40} className="text-mint" />
        </div>
        <div className="mt-4 text-center">
          <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
            Total LP Value
          </div>
          <div className="font-display text-3xl font-extrabold text-ice-100">
            {lpLake.totalValue}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-sm">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-ice-200/60">
          <span>Liquidity Health</span>
          <span className="font-bold text-mint">{lpLake.health}</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-ice-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-mint to-frost"
            style={{ width: `${lpLake.healthScore}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass-panel-soft flex items-start gap-3 p-4">
          <TrendingUp className="mt-0.5 text-mint" size={18} />
          <div>
            <div className="text-sm font-bold text-ice-100">Growing pool</div>
            <div className="text-xs text-ice-200/60">
              Liquidity has trended upward over the demo period, reducing
              slippage for traders.
            </div>
          </div>
        </div>
        <div className="glass-panel-soft flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 text-frost" size={18} />
          <div>
            <div className="text-sm font-bold text-ice-100">
              Locked liquidity
            </div>
            <div className="text-xs text-ice-200/60">
              Placeholder for future on-chain lock verification once XRPL
              data is connected.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-xs text-ice-200/40">
        Demo values only. Live pool depth, price impact, and lock status will
        pull directly from XRPL in a future version.
      </div>
    </PageShell>
  );
}
