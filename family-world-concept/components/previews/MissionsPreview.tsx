import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { PreviewCard } from "./PreviewCard";
import { missions } from "@/lib/demo-data";

export function MissionsPreview() {
  return (
    <PreviewCard
      icon={<ListChecks size={18} />}
      title="Missions"
      href="/missions"
      cta="View Missions"
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-ice-200/50">
        Complete daily missions · earn XP &amp; rewards
      </div>
      <ul className="space-y-2">
        {missions.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-lg chip px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              {m.done ? (
                <CheckCircle2 size={16} className="shrink-0 text-mint" />
              ) : (
                <Circle size={16} className="shrink-0 text-ice-300/50" />
              )}
              <span className="truncate text-xs font-semibold text-ice-100">
                {m.label}
              </span>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-ice-200/60">
              {m.progress}/{m.total}
            </span>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}
