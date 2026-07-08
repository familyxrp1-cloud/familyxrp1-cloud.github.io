import { Sparkles } from "lucide-react";

export function DemoBadge() {
  return (
    <div className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full chip px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-frost">
      <Sparkles size={12} />
      Private Prototype · Demo Data Only
    </div>
  );
}
