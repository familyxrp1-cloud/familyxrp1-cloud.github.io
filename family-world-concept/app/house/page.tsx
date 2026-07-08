import { Home, Coins, Gem, PieChart, Star } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { PenguinMark } from "@/components/PenguinMark";
import { profile } from "@/lib/demo-data";

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-panel-soft flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl chip text-gold">
        {icon}
      </span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ice-200/50">
          {label}
        </div>
        <div className="font-display text-base font-extrabold text-ice-100">
          {value}
        </div>
      </div>
    </div>
  );
}

export default function HousePage() {
  return (
    <PageShell
      icon={<Home size={22} />}
      title="My House"
      tagline="Your profile & assets"
    >
      <div className="flex flex-col items-center text-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-ice-500 to-ice-800 text-3xl font-extrabold text-frost-soft glow-frost font-display">
          {profile.avatarInitials}
        </div>
        <div className="mt-3 font-display text-xl font-extrabold text-ice-100">
          {profile.name}
        </div>
        <div className="text-xs text-ice-200/60">{profile.handle}</div>
        <span className="mt-2 rounded-full chip px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-frost">
          {profile.role}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat icon={<Coins size={18} />} label="$FAMILY Holding" value={profile.holding} />
        <Stat
          icon={<Gem size={18} />}
          label="NFT Collection"
          value={`${profile.nftCollection.owned} / ${profile.nftCollection.total}`}
        />
        <Stat icon={<PieChart size={18} />} label="Vault Share" value={profile.vaultShare} />
        <Stat icon={<Star size={18} />} label="Leaderboard Rank" value={`#${profile.rank}`} />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ice-200/60">
          NFT Collection
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: profile.nftCollection.total }, (_, i) => (
            <div
              key={i}
              className={`grid aspect-square place-items-center rounded-lg text-lg ${
                i < profile.nftCollection.owned
                  ? "chip glow-frost"
                  : "border border-dashed border-ice-300/15 text-ice-300/20"
              }`}
            >
              {i < profile.nftCollection.owned ? (
                <PenguinMark className="h-5 w-5" />
              ) : (
                "?"
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-xs text-ice-200/40">
        Demo profile only — wallet connection is not enabled in this
        prototype. Holdings, NFTs, and rank shown are placeholder values.
      </div>
    </PageShell>
  );
}
