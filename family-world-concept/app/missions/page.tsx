import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { missions } from "@/lib/demo-data";

export default function MissionsPage() {
  return (
    <PageShell
      icon={<ListChecks size={22} />}
      title="Missions"
      tagline="Complete daily missions to earn XP & rewards"
      accent="gold"
    >
      <ul className="space-y-3">
        {missions.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl glass-panel-soft px-4 py-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              {m.done ? (
                <CheckCircle2 size={20} className="shrink-0 text-mint" />
              ) : (
                <Circle size={20} className="shrink-0 text-ice-300/50" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-ice-100">
                  {m.label}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
                  {m.progress}/{m.total} complete
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full chip px-2.5 py-1 text-[10px] font-bold text-gold">
              +{m.xp} XP
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-xs text-ice-200/40">
        Missions reset daily. In this prototype, progress shown is static demo
        data — live tracking will connect through the Telegram Family Vault
        bot.
      </div>
    </PageShell>
  );
}
