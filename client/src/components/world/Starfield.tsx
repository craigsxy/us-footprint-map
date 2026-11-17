/** Static star field behind the globe. Drawn once per resize. */
import { useEffect, useRef } from "react";

// small deterministic PRNG so the sky is the same on every visit
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const rand = mulberry32(20261116);
      const count = Math.round((w * h) / 2600);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const m = rand() ** 3; // most stars are faint
        const r = 0.35 + m * 1.15;
        const tint = rand();
        const color = tint < 0.15 ? "255,224,196" : tint < 0.35 ? "196,216,255" : "255,255,255";
        ctx.fillStyle = `rgba(${color},${0.25 + m * 0.75})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (m > 0.82) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
          g.addColorStop(0, `rgba(${color},0.28)`);
          g.addColorStop(1, `rgba(${color},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return <canvas ref={ref} className="world-stars" />;
}
