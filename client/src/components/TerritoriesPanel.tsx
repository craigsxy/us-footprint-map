/**
 * TerritoriesPanel — Displays 5 US territories with click handlers
 * Design: Clean Light / Cartographic
 */
import { useCallback } from "react";
import { getStatusConfig, US_TERRITORIES, FootprintStatus } from "@/lib/footprintData";

interface TerritoriesPanelProps {
  getStatus: (id: string) => FootprintStatus;
  onTerritoryClick: (id: string) => void;
  onTerritoryRightClick: (id: string, x: number, y: number) => void;
}

export default function TerritoriesPanel({
  getStatus,
  onTerritoryClick,
  onTerritoryRightClick,
}: TerritoriesPanelProps) {
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      onTerritoryRightClick(id, e.clientX, e.clientY);
    },
    [onTerritoryRightClick]
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-[10px] font-mono uppercase tracking-widest px-1"
        style={{ color: "#6b7280" }}
      >
        Territories
      </div>
      {US_TERRITORIES.map((territory) => {
        const status = getStatus(territory.id);
        const config = getStatusConfig(status);
        const isVisited = status !== "unvisited";

        return (
          <button
            key={territory.id}
            onClick={() => onTerritoryClick(territory.id)}
            onContextMenu={(e) => handleContextMenu(e, territory.id)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150"
            style={{
              background: isVisited
                ? `${config.color}22`
                : "#f9fafb",
              border: `1px solid ${
                isVisited
                  ? `${config.borderColor}33`
                  : "#e5e7eb"
              }`,
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
                  color: isVisited ? "#1f2937" : "#9ca3af",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {territory.abbr}
              </div>
              <div
                className="text-[9px] font-mono leading-tight mt-0.5 truncate"
                style={{
                  color: isVisited ? config.borderColor : "#9ca3af",
                }}
              >
                {isVisited ? config.labelZh : territory.name.split(" ").slice(0, 2).join(" ")}
              </div>
            </div>
            {/* Status indicator dot */}
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
              style={{
                background: isVisited ? config.borderColor : "#d1d5db",
              }}
            />
          </button>
        );
      })}
      <div
        className="text-[9px] font-mono mt-1 px-1"
        style={{ color: "#d1d5db" }}
      >
        Right-click to set status directly
      </div>
    </div>
  );
}
