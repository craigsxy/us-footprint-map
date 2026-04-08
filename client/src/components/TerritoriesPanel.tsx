/**
 * TerritoriesPanel — Displays 5 US territories with click handlers
 * Design: Clean Light / Cartographic
 */
import { useCallback } from "react";
import {
  getStatusConfig,
  US_STATES,
  US_TERRITORIES,
  FootprintStatus,
} from "@/lib/footprintData";

interface TerritoriesPanelProps {
  getStatus: (id: string) => FootprintStatus;
  onTerritoryClick: (id: string) => void;
  onTerritoryRightClick: (id: string, x: number, y: number) => void;
  /** sidebar: left rail under legend (vertical, zh) · dock: vertical on map · mobileWrap: wrap rows */
  layout?: "sidebar" | "dock" | "mobileWrap";
  /**
   * Desktop sidebar: title becomes「首都及海外领地」and D.C. is listed first (same row style as territories).
   */
  dcSidebar?: {
    fips: string;
    onClick: () => void;
    onRightClick: (clientX: number, clientY: number) => void;
  };
}

type DcSidebarConfig = NonNullable<TerritoriesPanelProps["dcSidebar"]>;

function SidebarDcRow({
  dcSidebar,
  dcInfo,
  getStatus,
}: {
  dcSidebar: DcSidebarConfig;
  dcInfo: (typeof US_STATES)[number];
  getStatus: (id: string) => FootprintStatus;
}) {
  const status = getStatus(dcSidebar.fips);
  const config = getStatusConfig(status);
  const isVisited = status !== "unvisited";
  return (
    <button
      type="button"
      onClick={() => dcSidebar.onClick()}
      onContextMenu={(e) => {
        e.preventDefault();
        dcSidebar.onRightClick(e.clientX, e.clientY);
      }}
      className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150"
      style={{
        background: isVisited ? `${config.color}22` : "#f9fafb",
        border: `1px solid ${
          isVisited ? `${config.borderColor}33` : "#e5e7eb"
        }`,
      }}
      title={`${dcInfo.name} / ${dcInfo.nameZh} — 左键循环 · 右键直接设置`}
    >
      <span
        className="text-xl leading-none flex-shrink-0 w-8 text-center font-mono font-bold"
        style={{ color: "#0369a1" }}
      >
        {dcInfo.abbr}
      </span>
      <div className="flex flex-1 min-w-0 flex-col justify-center text-left">
        {!isVisited ? (
          <div
            className="text-xl leading-tight font-semibold truncate"
            style={{
              color: "#57534e",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {dcInfo.nameZh}
          </div>
        ) : (
          <>
            <div
              className="text-[12px] font-semibold leading-tight truncate"
              style={{
                color: "#1f2937",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {dcInfo.nameZh}
            </div>
            <div
              className="text-[9px] font-mono leading-tight mt-0.5 truncate"
              style={{ color: config.borderColor }}
            >
              {config.labelZh}
            </div>
          </>
        )}
      </div>
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
        style={{
          background: isVisited ? config.borderColor : "#d1d5db",
        }}
      />
    </button>
  );
}

export default function TerritoriesPanel({
  getStatus,
  onTerritoryClick,
  onTerritoryRightClick,
  layout = "sidebar",
  dcSidebar,
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
  const sidebar = layout === "sidebar";

  const titleZh = dock || mobileWrap || sidebar;
  const hintZh = dock || mobileWrap || sidebar;

  const sectionTitle =
    !titleZh
      ? "Territories"
      : sidebar && dcSidebar
        ? "首都及海外领地"
        : titleZh
          ? "海外领地"
          : "Territories";

  const dcInfo = dcSidebar
    ? US_STATES.find((s) => s.fips === dcSidebar.fips)
    : undefined;

  /** Desktop-style tiles: unvisited = one large zh line; visited = name + status */
  const richTileLabels = sidebar || dock;

  return (
    <div
      className={
        dock
          ? "flex flex-col gap-2 w-[188px] max-w-full"
          : mobileWrap || sidebar
            ? "flex flex-col gap-2 w-full"
            : "flex flex-col gap-2"
      }
    >
      <div
        className={
          dock
            ? "text-[9px] font-mono uppercase tracking-wider px-1 text-right"
            : mobileWrap || sidebar
              ? "text-[9px] font-mono uppercase tracking-wider"
              : "text-[10px] font-mono uppercase tracking-widest px-1"
        }
        style={{ color: "#6b7280" }}
      >
        {sectionTitle}
      </div>
      <div
        className={
          mobileWrap
            ? "flex flex-row flex-wrap gap-2 w-full"
            : "flex flex-col gap-2 w-full"
        }
      >
        {sidebar && dcSidebar && dcInfo ? (
          <SidebarDcRow
            dcSidebar={dcSidebar}
            dcInfo={dcInfo}
            getStatus={getStatus}
          />
        ) : null}
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
              <span className="text-xl leading-none flex-shrink-0 w-9 text-center">
                {territory.flag}
              </span>
              <div className="flex flex-1 min-w-0 flex-col justify-center text-left">
                {richTileLabels ? (
                  !isVisited ? (
                    <div
                      className="text-xl leading-tight font-semibold truncate"
                      style={{
                        color: "#57534e",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {territory.nameZh}
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-[12px] font-semibold leading-tight truncate"
                        style={{
                          color: "#1f2937",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {territory.nameZh}
                      </div>
                      <div
                        className="text-[9px] font-mono leading-tight mt-0.5 truncate"
                        style={{ color: config.borderColor }}
                      >
                        {config.labelZh}
                      </div>
                    </>
                  )
                ) : (
                  <>
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
                  </>
                )}
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
            : mobileWrap || sidebar
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
