import { Trophy } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { leaderboard } from "@/lib/demo-data";

const medal = ["text-gold-soft", "text-ice-100", "text-[#cd8a5c]"];

export default function LeaderboardPage() {
  return (
    <PageShell
      icon={<Trophy size={22} />}
      title="Leaderboard"
      tagline="Top Family members, ranked by XP"
      accent="gold"
    >
      <ul className="space-y-2">
        {leaderboard.map((p) => (
          <li
            key={p.rank}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
              p.isYou
                ? "chip glow-gold border border-gold/30"
                : "glass-panel-soft"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-6 shrink-0 font-display text-lg font-extrabold ${
                  p.rank <= 3 ? medal[p.rank - 1] : "text-ice-200/50"
                }`}
              >
                {p.rank}
              </span>
              <span
                className={`truncate font-semibold ${
                  p.isYou ? "text-gold-soft" : "text-ice-100"
                }`}
              >
                {p.name}
                {p.isYou && (
                  <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                    You
                  </span>
                )}
              </span>
            </div>
            <span className="shrink-0 font-display font-bold text-ice-200/80">
              {p.points.toLocaleString()} XP
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-xs text-ice-200/40">
        Demo leaderboard only. Live XP will be earned through Missions and
        Telegram Family Vault bot activity in a future version.
      </div>
    </PageShell>
  );
}
