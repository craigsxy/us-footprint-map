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
  /** sidebar: left column · dock: vertical on map · mobileWrap: wrap rows, full width */
  layout?: "sidebar" | "dock" | "mobileWrap";
}

export default function TerritoriesPanel({
  getStatus,
  onTerritoryClick,
  onTerritoryRightClick,
  layout = "sidebar",
}: TerritoriesPanelProps) {
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      onTerritoryRightClick(id, e.clientX, e.clientY);
    },
    [onTerritoryRightClick]
  );

  const dock = layout === "dock";
  const mobileWrap = layout === "mobileWrap";

  const titleZh = dock || mobileWrap;
  const hintZh = dock || mobileWrap;

  return (
    <div
      className={
        dock
          ? "flex flex-col gap-2 w-[188px] max-w-full"
          : mobileWrap
            ? "flex flex-col gap-2 w-full"
            : "flex flex-col gap-2"
      }
    >
      <div
        className={
          dock
            ? "text-[9px] font-mono uppercase tracking-wider px-1 text-right"
            : mobileWrap
              ? "text-[9px] font-mono uppercase tracking-wider"
              : "text-[10px] font-mono uppercase tracking-widest px-1"
        }
        style={{ color: "#6b7280" }}
      >
        {titleZh ? "海外领地" : "Territories"}
      </div>
      <div
        className={
          mobileWrap
            ? "flex flex-row flex-wrap gap-2 w-full"
            : "flex flex-col gap-2 w-full"
        }
      >
        {US_TERRITORIES.map((territory) => {
          const status = getStatus(territory.id);
          const config = getStatusConfig(status);
          const isVisited = status !== "unvisited";

          return (
            <button
              key={territory.id}
              onClick={() => onTerritoryClick(territory.id)}
              onContextMenu={(e) => handleContextMenu(e, territory.id)}
              className={
                mobileWrap
                  ? "flex flex-1 items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 min-w-[calc(50%-4px)] sm:min-w-[140px]"
                  : "flex w-full items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150"
              }
              style={{
                background: isVisited
                  ? `${config.color}22`
                  : "#f9fafb",
                border: `1px solid ${
                  isVisited
                    ? `${config.borderColor}33`
                    : "#e5e7eb"
                }`,
                maxWidth: mobileWrap ? "100%" : undefined,
              }}
              title={`${territory.name} / ${territory.nameZh} — 左键循环 · 右键直接设置`}
            >
              <span className="text-xl leading-none flex-shrink-0">
                {territory.flag}
              </span>
              <div className="flex-1 min-w-0 text-left">
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
                  {isVisited ? config.labelZh : territory.nameZh}
                </div>
              </div>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
                style={{
                  background: isVisited ? config.borderColor : "#d1d5db",
                }}
              />
            </button>
          );
        })}
      </div>
      <div
        className={
          dock
            ? "text-[8px] font-mono mt-0.5 px-1 text-right"
            : mobileWrap
              ? "text-[8px] font-mono mt-0.5"
              : "text-[9px] font-mono mt-1 px-1"
        }
        style={{ color: hintZh ? "#9ca3af" : "#d1d5db" }}
      >
        {hintZh ? "左键循环 · 长按或右键设置" : "Right-click to set status directly"}
      </div>
    </div>
  );
}
