import Link from "next/link";
import { Users, Droplet, ShieldCheck, Lock, Send, Menu } from "lucide-react";
import { PenguinMark } from "./PenguinMark";
import { globalStats } from "@/lib/demo-data";

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4">
      <span className="text-frost">{icon}</span>
      <div className="leading-tight">
        <div className="text-[9px] sm:text-[10px] tracking-wider text-ice-200/70 font-semibold uppercase">
          {label}
        </div>
        <div className="text-xs sm:text-sm font-bold text-ice-100 font-display">
          {value}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl glass-panel px-3 py-2.5 sm:px-5">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <PenguinMark className="h-9 w-9 sm:h-10 sm:w-10 drop-shadow-[0_0_10px_rgba(127,227,255,0.35)]" />
          <div className="leading-tight">
            <div className="font-display text-base sm:text-lg font-extrabold tracking-wide text-ice-100">
              $FAMILY
            </div>
            <div className="hidden sm:block text-[10px] tracking-[0.18em] text-frost/80 font-semibold uppercase">
              One ledger. One family.
            </div>
          </div>
        </Link>

        <div className="order-3 w-full sm:order-2 sm:w-auto flex flex-1 flex-wrap items-center justify-center gap-1 rounded-xl chip px-1 py-1 sm:flex-nowrap sm:gap-0 sm:divide-x sm:divide-ice-300/10">
          <StatItem
            icon={<Users size={16} />}
            label="Holders"
            value={globalStats.holders}
          />
          <StatItem
            icon={<Droplet size={16} />}
            label="LP Value"
            value={globalStats.lpValue}
          />
          <StatItem
            icon={<ShieldCheck size={16} />}
            label="Vault Value"
            value={globalStats.vaultValue}
          />
          <StatItem
            icon={<Lock size={16} />}
            label="Next Unlock"
            value={globalStats.nextUnlock}
          />
        </div>

        <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0">
          <button
            aria-label="Telegram"
            className="grid h-9 w-9 place-items-center rounded-full chip text-ice-100 transition hover:text-frost hover:glow-frost"
          >
            <Send size={16} />
          </button>
          <button
            aria-label="X"
            className="grid h-9 w-9 place-items-center rounded-full chip text-ice-100 transition hover:text-frost hover:glow-frost"
          >
            <span className="text-sm font-bold">𝕏</span>
          </button>
          <button
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-full chip text-ice-100 transition hover:text-frost hover:glow-frost"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
