import { LifeBuoy, ChevronDown } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { helpFaqs } from "@/lib/demo-data";

export default function HelpPage() {
  return (
    <PageShell
      icon={<LifeBuoy size={22} />}
      title="Help Centre"
      tagline="Guides & support"
    >
      <div className="space-y-2">
        {helpFaqs.map((f, i) => (
          <details
            key={i}
            className="group glass-panel-soft overflow-hidden rounded-xl px-4 py-3"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-ice-100">
              {f.q}
              <ChevronDown
                size={16}
                className="shrink-0 text-ice-200/50 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-ice-200/60">
              {f.a}
            </p>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-ice-300/10 bg-ice-800/30 p-4 text-xs text-ice-200/40">
        Need more help? This prototype has no live support channel yet — reach
        the team through the official $FAMILY Telegram once launched.
      </div>
    </PageShell>
  );
}
