import { Landmark } from "lucide-react";
import { PreviewCard } from "./PreviewCard";
import { vault } from "@/lib/demo-data";

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-lg chip py-1.5 text-center font-display text-base font-extrabold text-gold-soft sm:text-lg">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-ice-200/50">
        {label}
      </div>
    </div>
  );
}

export function VaultPreview() {
  return (
    <PreviewCard
      icon={<Landmark size={18} />}
      title="Community Vault"
      href="/vault"
      cta="View Vault"
    >
      <div className="text-center text-[10px] uppercase tracking-wider text-ice-200/60">
        Vault unlocks in
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <TimeBlock value={vault.countdown.months} label="Months" />
        <TimeBlock value={vault.countdown.days} label="Days" />
        <TimeBlock value={vault.countdown.hours} label="Hours" />
        <TimeBlock value={vault.countdown.mins} label="Mins" />
      </div>
      <div className="mt-4 flex justify-between gap-2 border-t border-ice-300/10 pt-3 text-center">
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-wider text-ice-200/50">
            Your Share
          </div>
          <div className="font-display text-sm font-bold text-ice-100">
            {vault.yourShare}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-wider text-ice-200/50">
            Est. Reward
          </div>
          <div className="font-display text-sm font-bold text-mint">
            {vault.estReward}
          </div>
        </div>
      </div>
    </PreviewCard>
  );
}
