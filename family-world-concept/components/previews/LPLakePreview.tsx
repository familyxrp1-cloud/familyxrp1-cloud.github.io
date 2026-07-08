import { Droplet } from "lucide-react";
import { PreviewCard } from "./PreviewCard";
import { lpLake } from "@/lib/demo-data";

export function LPLakePreview() {
  return (
    <PreviewCard
      icon={<Droplet size={18} />}
      title="LP Lake"
      href="/lp-lake"
      cta="View Lake"
    >
      <div className="flex flex-col items-center">
        <div className="pulse-glow grid h-16 w-16 place-items-center rounded-full bg-mint/10 chip">
          <Droplet size={26} className="text-mint" />
        </div>
        <div className="mt-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-ice-200/50">
            Total LP Value
          </div>
          <div className="font-display text-lg font-extrabold text-ice-100">
            {lpLake.totalValue}
          </div>
        </div>
        <div className="mt-3 w-full">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ice-200/50">
            <span>Liquidity Health</span>
            <span className="font-bold text-mint">{lpLake.health}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ice-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint to-frost"
              style={{ width: `${lpLake.healthScore}%` }}
            />
          </div>
        </div>
      </div>
    </PreviewCard>
  );
}
