/**
 * StatsPanel — Shows visit statistics with animated counters
 * Design: Deep Space / Data Observatory
 */
import { FootprintStatus, STATUS_CONFIGS } from "@/lib/footprintData";

interface StatsPanelProps {
  stats: {
    total: number;
    visited: number;
    byStatus: Record<FootprintStatus, number>;
  };
  onReset: () => void;
}

export default function StatsPanel({ stats, onReset }: StatsPanelProps) {
  const percentage = Math.round((stats.visited / stats.total) * 100);
  const activeStatuses = STATUS_CONFIGS.filter(
    (c) => c.id !== "unvisited" && (stats.byStatus[c.id] ?? 0) > 0
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Main counter */}
      <div
        className="rounded-xl p-3"
        style={{
          background: "rgba(0, 212, 255, 0.04)",
          border: "1px solid rgba(0, 212, 255, 0.12)",
        }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest mb-2"
          style={{ color: "#475569" }}
        >
          Visited
        </div>
        <div className="flex items-end gap-1.5 mb-2">
          <span
            className="text-4xl font-bold font-mono leading-none"
            style={{
              color: "#00d4ff",
              textShadow: "0 0 20px rgba(0,212,255,0.4)",
            }}
          >
            {stats.visited}
          </span>
          <span
            className="font-mono text-sm mb-1"
            style={{ color: "#334155" }}
          >
            / {stats.total}
          </span>
        </div>
        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(30,58,95,0.4)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${percentage}%`,
              background: "linear-gradient(90deg, #0891b2, #00d4ff)",
              boxShadow: "0 0 8px rgba(0,212,255,0.5)",
            }}
          />
        </div>
        <div
          className="text-[10px] font-mono mt-1.5"
          style={{ color: "#334155" }}
        >
          {percentage}% of all 56 regions
        </div>
      </div>

      {/* Per-status breakdown */}
      {activeStatuses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            className="text-[10px] font-mono uppercase tracking-widest mb-0.5 px-1"
            style={{ color: "#475569" }}
          >
            Breakdown
          </div>
          {activeStatuses.map((config) => {
            const count = stats.byStatus[config.id] ?? 0;
            const pct = Math.round((count / stats.total) * 100);
            return (
              <div key={config.id} className="px-1">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: config.glowColor,
                        boxShadow: `0 0 4px ${config.glowColor}`,
                      }}
                    />
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: "#94a3b8" }}
                    >
                      {config.labelZh}
                    </span>
                  </div>
                  <span
                    className="text-[12px] font-mono font-semibold"
                    style={{ color: config.glowColor }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  className="h-0.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(30,58,95,0.3)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: config.glowColor,
                      boxShadow: `0 0 4px ${config.glowColor}`,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stats.visited === 0 && (
        <div
          className="text-[11px] font-mono px-1 py-2 text-center rounded-lg"
          style={{
            color: "#334155",
            background: "rgba(30,58,95,0.1)",
            border: "1px dashed rgba(30,58,95,0.3)",
          }}
        >
          Click any state to begin
        </div>
      )}

      {/* Reset button */}
      {stats.visited > 0 && (
        <button
          onClick={onReset}
          className="w-full text-[11px] font-mono py-1.5 rounded-lg transition-all duration-200"
          style={{
            color: "#475569",
            border: "1px solid rgba(30,58,95,0.3)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.color = "#ef4444";
            (e.target as HTMLButtonElement).style.borderColor =
              "rgba(239,68,68,0.3)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.color = "#475569";
            (e.target as HTMLButtonElement).style.borderColor =
              "rgba(30,58,95,0.3)";
          }}
        >
          Reset All Data
        </button>
      )}
    </div>
  );
}
