import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PreviewCard({
  icon,
  title,
  href,
  cta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-frost">{icon}</span>
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-ice-100">
          {title}
        </h3>
      </div>
      <div className="flex-1">{children}</div>
      <Link
        href={href}
        className="mt-4 flex items-center justify-center gap-1 rounded-xl chip py-2.5 text-xs font-bold text-ice-100 transition hover:text-frost hover:glow-frost"
      >
        {cta}
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}
