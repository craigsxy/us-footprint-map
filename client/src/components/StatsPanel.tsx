/**
 * StatsPanel — Shows visit statistics with animated counters
 * Design: Clean Light / Cartographic
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
          background: "#f0f9ff",
          border: "1px solid #bfdbfe",
        }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest mb-2"
          style={{ color: "#6b7280" }}
        >
          Visited
        </div>
        <div className="flex items-end gap-1.5 mb-2">
          <span
            className="text-4xl font-bold font-mono leading-none"
            style={{
              color: "#0369a1",
            }}
          >
            {stats.visited}
          </span>
          <span
            className="font-mono text-sm mb-1"
            style={{ color: "#9ca3af" }}
          >
            / {stats.total}
          </span>
        </div>
        <div className="text-[10px] font-mono" style={{ color: "#9ca3af" }}>
          {percentage}% of all 56 regions
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="rounded-full overflow-hidden h-1.5"
        style={{ background: "#e5e7eb" }}
      >
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #06b6d4, #0369a1, #3b82f6)",
          }}
        />
      </div>

      {/* Breakdown */}
      {activeStatuses.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "#6b7280" }}
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
                        background: config.borderColor,
                      }}
                    />
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: "#6b7280" }}
                    >
                      {config.labelZh}
                    </span>
                  </div>
                  <span
                    className="text-[12px] font-mono font-semibold"
                    style={{ color: config.borderColor }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  className="h-0.5 rounded-full overflow-hidden"
                  style={{ background: "#e5e7eb" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: config.borderColor,
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
          className="rounded-lg p-2 text-center"
          style={{
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
          }}
        >
          <div className="text-[10px] font-mono" style={{ color: "#9ca3af" }}>
            Click any state to begin
          </div>
        </div>
      )}
    </div>
  );
}
