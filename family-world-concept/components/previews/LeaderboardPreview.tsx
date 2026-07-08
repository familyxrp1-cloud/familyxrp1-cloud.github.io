import { Trophy } from "lucide-react";
import { PreviewCard } from "./PreviewCard";
import { leaderboard } from "@/lib/demo-data";

const medal = ["text-gold-soft", "text-ice-100", "text-[#cd8a5c]"];

export function LeaderboardPreview() {
  return (
    <PreviewCard
      icon={<Trophy size={18} />}
      title="Leaderboard"
      href="/leaderboard"
      cta="View Full Leaderboard"
    >
      <ul className="space-y-1.5">
        {leaderboard.slice(0, 5).map((p) => (
          <li
            key={p.rank}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
              p.isYou ? "chip glow-gold border border-gold/30" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-4 shrink-0 font-display font-extrabold ${
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
              </span>
            </div>
            <span className="shrink-0 font-display font-bold text-ice-200/80">
              {p.points.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}
