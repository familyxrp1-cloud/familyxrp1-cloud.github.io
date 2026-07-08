import Link from "next/link";
import { Coins, Gem, PieChart, Star, ChevronRight } from "lucide-react";
import { profile } from "@/lib/demo-data";
import { PenguinMark } from "./PenguinMark";

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg chip text-gold">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-ice-200/60 font-semibold">
          {label}
        </div>
        <div className="truncate text-sm font-bold text-ice-100">{value}</div>
      </div>
    </div>
  );
}

export function ProfileCard() {
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-ice-500 to-ice-800 text-2xl font-extrabold text-frost-soft glow-frost font-display">
            {profile.avatarInitials}
          </div>
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-ice-950 chip">
            <PenguinMark className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 font-display text-lg font-extrabold text-ice-100">
          {profile.name}
        </div>
        <div className="text-xs text-ice-200/60">{profile.handle}</div>
        <span className="mt-2 rounded-full chip px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-frost">
          {profile.role}
        </span>
      </div>

      <div className="mt-4 divide-y divide-ice-300/10 border-y border-ice-300/10">
        <StatRow
          icon={<Coins size={16} />}
          label="$FAMILY Holding"
          value={profile.holding}
        />
        <StatRow
          icon={<Gem size={16} />}
          label="NFT Collection"
          value={`${profile.nftCollection.owned}/${profile.nftCollection.total}`}
        />
        <StatRow
          icon={<PieChart size={16} />}
          label="Vault Share"
          value={profile.vaultShare}
        />
        <StatRow icon={<Star size={16} />} label="Rank" value={`#${profile.rank}`} />
      </div>

      <Link
        href="/house"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-frost/30 bg-frost/10 py-2.5 text-sm font-bold text-frost transition hover:bg-frost/20 hover:glow-frost"
      >
        View Profile
        <ChevronRight size={15} />
      </Link>
    </div>
  );
}
