"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AreaIcon } from "./icons";
import type { WorldArea } from "@/lib/demo-data";

const accentClass: Record<WorldArea["accent"], string> = {
  frost: "text-frost group-hover:text-frost",
  gold: "text-gold group-hover:text-gold",
  mint: "text-mint group-hover:text-mint",
};

const glowClass: Record<WorldArea["accent"], string> = {
  frost: "group-hover:glow-frost",
  gold: "group-hover:glow-gold",
  mint: "group-hover:shadow-[0_0_24px_-4px_rgba(126,247,200,0.45)]",
};

export function ZonePin({
  area,
  index,
  style,
}: {
  area: WorldArea;
  index: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={style}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.06, duration: 0.5, ease: "easeOut" }}
    >
      <Link href={area.href} className="group flex flex-col items-center gap-2">
        <motion.div
          whileHover={{ y: -6, scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          className={`float-y grid h-14 w-14 place-items-center rounded-2xl chip transition-all duration-300 sm:h-16 sm:w-16 ${glowClass[area.accent]}`}
        >
          <AreaIcon
            name={area.icon}
            className={`h-6 w-6 text-ice-100 transition-colors sm:h-7 sm:w-7 ${accentClass[area.accent]}`}
          />
        </motion.div>
        <div className="pointer-events-none rounded-lg bg-ice-950/80 px-2.5 py-1 text-center opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:opacity-100 sm:opacity-100 sm:bg-transparent sm:shadow-none sm:backdrop-blur-0">
          <div className="whitespace-nowrap font-display text-[11px] font-bold text-ice-100 sm:text-xs">
            {area.name}
          </div>
          <div className="hidden whitespace-nowrap text-[9px] text-ice-200/60 sm:block">
            {area.tagline}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
