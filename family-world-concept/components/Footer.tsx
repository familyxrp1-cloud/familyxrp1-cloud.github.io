import { Users, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mx-auto mt-8 mb-6 flex max-w-7xl flex-col items-center gap-2 px-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-ice-200/60 sm:text-xs sm:tracking-widest">
        <Users size={13} className="shrink-0" />
        <span>Together we build. Together we grow. Together we win.</span>
        <Heart size={11} className="shrink-0 text-frost" fill="currentColor" />
        <span className="text-frost">$FAMILY</span>
      </div>
      <p className="max-w-md text-[11px] text-ice-200/40">
        Private concept prototype. Demo data only — no wallet connection, no
        live XRPL data, no backend.
      </p>
    </footer>
  );
}
