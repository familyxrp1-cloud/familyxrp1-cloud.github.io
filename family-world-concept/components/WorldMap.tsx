"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { worldAreas } from "@/lib/demo-data";
import { ZonePin } from "./ZonePin";
import { AreaIcon } from "./icons";
import { SnowOverlay } from "./SnowOverlay";
import { PenguinMark } from "./PenguinMark";

const center = { top: 50, left: 50 };

export function WorldMap() {
  return (
    <div className="glass-panel relative overflow-hidden">
      {/* Desktop / tablet: isometric-feel island map */}
      <div className="world-terrain relative hidden aspect-[16/10] w-full sm:block">
        <div className="aurora absolute -top-10 left-1/4 h-40 w-2/3 -rotate-6 rounded-full bg-frost/10 blur-3xl" />
        <div
          className="aurora absolute -top-6 right-1/4 h-32 w-1/2 rotate-6 rounded-full bg-mint/10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <SnowOverlay count={26} />

        {/* connective paths from village centre to each zone */}
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {worldAreas
            .filter((a) => a.id !== "missions")
            .map((a) => {
              const x1 = `${center.left}%`;
              const y1 = `${center.top}%`;
              const x2 = a.position.left;
              const y2 = a.position.top;
              return (
                <line
                  key={a.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(143,191,230,0.18)"
                  strokeWidth={1.5}
                  strokeDasharray="3 6"
                  strokeLinecap="round"
                />
              );
            })}
        </svg>

        {/* central village fire glow */}
        <div
          className="pulse-glow absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/30 blur-2xl"
          style={{ top: `${center.top}%`, left: `${center.left}%` }}
        />

        {worldAreas.map((area, i) => (
          <ZonePin
            key={area.id}
            area={area}
            index={i}
            style={{ top: area.position.top, left: area.position.left }}
          />
        ))}

        {/* decorative penguins */}
        <PenguinMark className="float-y absolute bottom-[8%] left-[8%] h-8 w-8 opacity-80" />
        <PenguinMark
          className="float-y absolute bottom-[14%] right-[10%] h-6 w-6 opacity-70"
          style={{ animationDelay: "1.2s" }}
        />
        <span className="absolute top-[10%] right-[6%] text-lg opacity-60">❄️</span>
        <span className="absolute top-[8%] left-[6%] text-lg opacity-60">❄️</span>
      </div>

      {/* Mobile: stacked list of zone cards */}
      <div className="relative grid grid-cols-2 gap-3 p-4 sm:hidden">
        <SnowOverlay count={14} />
        {worldAreas.map((area, i) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={area.href}
              className="glass-panel-soft flex h-full flex-col items-center gap-1.5 px-3 py-4 text-center active:scale-95 transition-transform"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl chip">
                <AreaIcon name={area.icon} className="h-5 w-5 text-frost" />
              </span>
              <div className="font-display text-xs font-bold text-ice-100">
                {area.name}
              </div>
              <div className="text-[10px] leading-tight text-ice-200/60">
                {area.tagline}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
