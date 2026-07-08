import { Fish, Clock } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function FishingDockPage() {
  return (
    <PageShell
      icon={<Fish size={22} />}
      title="Fishing Dock"
      tagline="Daily game · win rewards"
    >
      <div className="flex flex-col items-center py-6 text-center">
        <div className="pulse-glow grid h-24 w-24 place-items-center rounded-full chip">
          <Fish size={40} className="text-frost" />
        </div>
        <h2 className="mt-5 font-display text-lg font-extrabold text-ice-100">
          Coming Soon
        </h2>
        <p className="mt-2 max-w-sm text-sm text-ice-200/60">
          A daily fishing mini-game is being built for the Family. Check in
          daily and complete Missions to be first in line when it launches.
        </p>
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full chip px-3 py-1.5 text-xs font-bold text-ice-200/70">
          <Clock size={13} />
          In development
        </div>
      </div>
    </PageShell>
  );
}
