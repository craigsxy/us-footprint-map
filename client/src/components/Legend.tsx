/**
 * Legend — Displays status color legend with visual hierarchy
 * Design: Deep Space / Data Observatory
 */
import { STATUS_CONFIGS } from "@/lib/footprintData";

export default function Legend() {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="text-[10px] font-mono uppercase tracking-widest mb-1 px-1"
        style={{ color: "#475569" }}
      >
        Legend
      </div>
      {STATUS_CONFIGS.map((config, idx) => (
        <div
          key={config.id}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors duration-150"
          style={{
            background:
              config.id === "unvisited"
                ? "transparent"
                : `${config.color}66`,
            border:
              config.id === "unvisited"
                ? "1px solid transparent"
                : `1px solid ${config.glowColor}22`,
          }}
        >
          {/* Color swatch */}
          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{
              background: config.color,
              border: `1px solid ${
                config.id === "unvisited"
                  ? "rgba(30,58,95,0.5)"
                  : `${config.glowColor}55`
              }`,
              boxShadow:
                config.id !== "unvisited"
                  ? `0 0 6px ${config.glowColor}66`
                  : "none",
            }}
          />
          {/* Labels */}
          <div className="flex-1 min-w-0">
            <div
              className="text-[11px] font-mono leading-tight"
              style={{
                color:
                  config.id === "unvisited" ? "#475569" : "#cbd5e1",
              }}
            >
              {config.labelZh}
            </div>
            <div
              className="text-[9px] font-mono leading-tight mt-0.5"
              style={{ color: "#334155" }}
            >
              {config.label}
            </div>
          </div>
          {/* Order indicator */}
          <span
            className="text-[9px] font-mono flex-shrink-0"
            style={{ color: "#1e3a5f" }}
          >
            {idx}
          </span>
        </div>
      ))}
      <div
        className="text-[9px] font-mono mt-1 px-1"
        style={{ color: "#1e3a5f" }}
      >
        Numbers indicate click order
      </div>
    </div>
  );
}
