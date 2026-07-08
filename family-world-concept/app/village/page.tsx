import { TreePine } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { villageNews } from "@/lib/demo-data";

const tagColor: Record<string, string> = {
  Announcement: "text-gold bg-gold/10",
  Update: "text-frost bg-frost/10",
  "Coming Soon": "text-mint bg-mint/10",
  Community: "text-ice-200 bg-ice-300/10",
};

export default function VillagePage() {
  return (
    <PageShell
      icon={<TreePine size={22} />}
      title="Village Centre"
      tagline="News · updates · community"
      accent="mint"
    >
      <ul className="space-y-3">
        {villageNews.map((n) => (
          <li key={n.id} className="glass-panel-soft p-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  tagColor[n.tag] ?? "text-ice-200 bg-ice-300/10"
                }`}
              >
                {n.tag}
              </span>
              <span className="text-[10px] text-ice-200/40">{n.date}</span>
            </div>
            <h3 className="font-display text-sm font-extrabold text-ice-100">
              {n.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ice-200/60">
              {n.body}
            </p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
