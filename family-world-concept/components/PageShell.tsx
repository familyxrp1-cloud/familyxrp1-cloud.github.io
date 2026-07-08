import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

export function PageShell({
  icon,
  title,
  tagline,
  accent = "frost",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  accent?: "frost" | "gold" | "mint";
  children: React.ReactNode;
}) {
  const glow =
    accent === "gold"
      ? "glow-gold text-gold"
      : accent === "mint"
        ? "shadow-[0_0_24px_-4px_rgba(126,247,200,0.45)] text-mint"
        : "glow-frost text-frost";

  return (
    <div className="relative flex min-h-screen flex-col pb-8">
      <TopBar />
      <main className="mx-auto mt-4 w-full max-w-4xl flex-1 px-3 sm:mt-6 sm:px-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ice-200/70 transition hover:text-frost"
        >
          <ArrowLeft size={14} />
          Back to World Map
        </Link>

        <div className="glass-panel p-5 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl chip ${glow}`}>
              {icon}
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold text-ice-100 sm:text-2xl">
                {title}
              </h1>
              <p className="text-xs text-ice-200/60 sm:text-sm">{tagline}</p>
            </div>
          </div>

          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
