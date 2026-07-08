import { Landmark, PieChart, Coins } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { vault, globalStats } from "@/lib/demo-data";

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-xl chip py-3 text-center font-display text-2xl font-extrabold text-gold-soft sm:text-3xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-ice-200/50">
        {label}
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <PageShell
      icon={<Landmark size={22} />}
      title="Community Vault"
      tagline={`${vault.supplyPercent} of supply · ${vault.tagline}`}
      accent="gold"
    >
      <div className="text-center text-xs uppercase tracking-wider text-ice-200/60">
        Vault unlocks in
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <TimeBlock value={vault.countdown.months} label="Months" />
        <TimeBlock value={vault.countdown.days} label="Days" />
        <TimeBlock value={vault.countdown.hours} label="Hours" />
        <TimeBlock value={vault.countdown.mins} label="Mins" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-panel-soft flex flex-col items-center p-4 text-center">
          <Coins className="mb-1 text-gold" size={20} />
          <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
            Vault Value
          </div>
          <div className="font-display text-lg font-extrabold text-ice-100">
            {globalStats.vaultValue}
          </div>
        </div>
        <div className="glass-panel-soft flex flex-col items-center p-4 text-center">
          <PieChart className="mb-1 text-frost" size={20} />
          <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
            Your Share
          </div>
          <div className="font-display text-lg font-extrabold text-ice-100">
            {vault.yourShare}
          </div>
        </div>
        <div className="glass-panel-soft flex flex-col items-center p-4 text-center">
          <Landmark className="mb-1 text-mint" size={20} />
          <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
            Est. Reward
          </div>
          <div className="font-display text-lg font-extrabold text-mint">
            {vault.estReward}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-sm leading-relaxed text-ice-200/70">
        <p>
          The Community Vault holds {vault.supplyPercent} of total $FAMILY
          supply, distributed to holders over time. Your share and estimated
          reward scale with how much $FAMILY you hold at snapshot time.
        </p>
        <p className="mt-2 text-xs text-ice-200/40">
          All figures on this page are placeholder demo data for the private
          prototype — no wallet is connected and no rewards are being
          distributed yet.
        </p>
      </div>
    </PageShell>
  );
}
