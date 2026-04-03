/**
 * TerritoriesPanel — Displays 5 US overseas territories as interactive cards
 * Design: Deep Space / Data Observatory
 */
import { FootprintStatus, getStatusConfig, US_TERRITORIES } from "@/lib/footprintData";

interface TerritoriesPanelProps {
  getStatus: (id: string) => FootprintStatus;
  onTerritoryClick: (id: string) => void;
  onTerritoryRightClick?: (id: string, x: number, y: number) => void;
}

export default function TerritoriesPanel({
  getStatus,
  onTerritoryClick,
  onTerritoryRightClick,
}: TerritoriesPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-[10px] font-mono uppercase tracking-widest mb-1 px-1"
        style={{ color: "#475569" }}
      >
        Territories
      </div>
      <div
        className="text-[9px] font-mono px-1 mb-1"
        style={{ color: "#1e3a5f" }}
      >
        5 overseas territories
      </div>
      {US_TERRITORIES.map((territory) => {
        const status = getStatus(territory.id);
        const config = getStatusConfig(status);
        const isVisited = status !== "unvisited";
        return (
          <button
            key={territory.id}
            onClick={() => onTerritoryClick(territory.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onTerritoryRightClick?.(territory.id, e.clientX, e.clientY);
            }}
            className="group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200"
            style={{
              background: isVisited
                ? `${config.color}dd`
                : "rgba(17,24,39,0.6)",
              border: `1px solid ${
                isVisited
                  ? `${config.glowColor}33`
                  : "rgba(30,58,95,0.3)"
              }`,
              boxShadow: isVisited
                ? `0 0 12px ${config.glowColor}18`
                : "none",
            }}
            title={`${territory.name} — Left click to cycle, right click to set`}
          >
            <span className="text-xl leading-none flex-shrink-0">
              {territory.flag}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="text-[12px] font-semibold leading-tight"
                style={{
                  color: isVisited ? "#e2e8f0" : "#64748b",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {territory.abbr}
              </div>
              <div
                className="text-[9px] font-mono leading-tight mt-0.5 truncate"
                style={{
                  color: isVisited ? config.glowColor : "#334155",
                }}
              >
                {isVisited ? config.labelZh : territory.name.split(" ").slice(0, 2).join(" ")}
              </div>
            </div>
            {/* Status indicator dot */}
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
              style={{
                background: isVisited ? config.glowColor : "#1e3a5f",
                boxShadow: isVisited
                  ? `0 0 6px ${config.glowColor}`
                  : "none",
              }}
            />
          </button>
        );
      })}
      <div
        className="text-[9px] font-mono mt-1 px-1"
        style={{ color: "#1e3a5f" }}
      >
        Right-click to set status directly
      </div>
    </div>
  );
}
