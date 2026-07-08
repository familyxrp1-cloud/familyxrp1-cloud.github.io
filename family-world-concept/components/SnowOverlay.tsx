"use client";

import { useMemo } from "react";

// Deterministic pseudo-random so server and client render match (no Math.random at module scope).
function seeded(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export function SnowOverlay({ count = 40 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = seeded(i + 1) * 100;
        const size = 2 + seeded(i + 50) * 3;
        const duration = 10 + seeded(i + 100) * 14;
        const delay = seeded(i + 150) * 14;
        const drift = (seeded(i + 200) - 0.5) * 80;
        const opacity = 0.3 + seeded(i + 250) * 0.5;
        return { left, size, duration, delay, drift, opacity, id: i };
      }),
    [count]
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snowflake"
          style={
            {
              left: `${f.left}%`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
