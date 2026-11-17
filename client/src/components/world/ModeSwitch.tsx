/**
 * ModeSwitch — 查看 / 路过 / 短途 / 长住 as one frosted control. The lit pill
 * slides between segments, and you can drag across the control to move it.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { LIT, LIT_ORDER, type LitStatus } from "@/lib/worldTheme";

interface Props {
  /** null = 查看 */
  value: LitStatus | null;
  onChange(value: LitStatus | null): void;
}

const OPTIONS: (LitStatus | null)[] = [null, ...LIT_ORDER];

export default function ModeSwitch({ value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const index = OPTIONS.indexOf(value);

  useLayoutEffect(() => {
    const measure = () => {
      const el = segRefs.current[index];
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

  /** the segment under a horizontal position, clamped to the ends */
  const optionAt = (clientX: number) => {
    let best = 0;
    segRefs.current.forEach((el, i) => {
      if (el && clientX >= el.getBoundingClientRect().left) best = i;
    });
    return OPTIONS[best];
  };

  const color = value ? LIT[value].color : null;

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label="点亮模式"
      className="glass-thin pointer-events-auto relative flex touch-none items-center rounded-full p-1"
      onPointerDown={(e) => {
        rootRef.current!.setPointerCapture(e.pointerId);
        setDragging(true);
        onChange(optionAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const next = optionAt(e.clientX);
        if (next !== value) onChange(next);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {thumb && (
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-full"
          style={{
            left: 0,
            width: thumb.width,
            transform: `translateX(${thumb.left}px) scale(${dragging ? 1.06 : 1})`,
            transition:
              "transform 0.42s cubic-bezier(0.3, 1.35, 0.5, 1), width 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
            background: color
              ? `linear-gradient(180deg, ${color}e6, ${color}c4)`
              : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.7))",
            boxShadow: color
              ? `0 6px 18px ${color}66, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.35)`
              : "0 3px 10px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        />
      )}
      {OPTIONS.map((opt, i) => {
        const on = opt === value;
        return (
          <button
            key={opt ?? "view"}
            ref={(el) => {
              segRefs.current[i] = el;
            }}
            role="radio"
            aria-checked={on}
            // the pointer handlers on the group do the work; keyboard users get the click
            onClick={(e) => {
              if (e.detail === 0) onChange(opt);
            }}
            title={opt ? `点一下地图上的地方就标为“${LIT[opt].label}”` : "点地图上的地方查看详情"}
            className="relative z-[1] flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium"
            style={{
              color: on ? (opt ? "#fff" : "#1d1d1f") : "#2c2c2e",
              transition: "color 0.25s ease",
              textShadow: on || !opt ? undefined : "0 0 6px rgba(255,255,255,0.6)",
            }}
          >
            {opt && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: on ? "#fff" : LIT[opt].color, transition: "background 0.25s ease" }}
              />
            )}
            {opt ? LIT[opt].label : "查看"}
          </button>
        );
      })}
    </div>
  );
}
