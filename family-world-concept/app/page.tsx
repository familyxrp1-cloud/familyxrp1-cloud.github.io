import { TopBar } from "@/components/TopBar";
import { ProfileCard } from "@/components/ProfileCard";
import { WorldMap } from "@/components/WorldMap";
import { VaultPreview } from "@/components/previews/VaultPreview";
import { LPLakePreview } from "@/components/previews/LPLakePreview";
import { MissionsPreview } from "@/components/previews/MissionsPreview";
import { LeaderboardPreview } from "@/components/previews/LeaderboardPreview";
import { Footer } from "@/components/Footer";
import { DemoBadge } from "@/components/DemoBadge";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col pb-4">
      <TopBar />

      <main className="mx-auto mt-4 w-full max-w-7xl flex-1 px-3 sm:mt-6 sm:px-6">
        <DemoBadge />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <ProfileCard />
          </aside>

          <div className="flex flex-col gap-4">
            {/* Mobile profile summary shown above the map */}
            <div className="lg:hidden">
              <ProfileCard />
            </div>
            <WorldMap />
          </div>
        </div>

        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <VaultPreview />
          <LPLakePreview />
          <MissionsPreview />
          <LeaderboardPreview />
        </section>
      </main>

      <Footer />
    </div>
  );
}
