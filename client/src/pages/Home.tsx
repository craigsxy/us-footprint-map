/**
 * Home — Main page layout
 * Design: Clean Light / Cartographic
 * Features: Full-screen map, collapsible left panel, territories dock on map, context menu
 */
import { useState, useCallback, useRef, useEffect } from "react";
import USMap from "@/components/USMap";
import TerritoriesPanel from "@/components/TerritoriesPanel";
import Legend from "@/components/Legend";
import StatsPanel from "@/components/StatsPanel";
import { useFootprint } from "@/hooks/useFootprint";
import {
  FootprintStatus,
  getStatusConfig,
  STATUS_ORDER,
  US_STATES,
  US_TERRITORIES,
} from "@/lib/footprintData";
import { Map, RotateCcw, ChevronLeft, ChevronRight, X } from "lucide-react";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  regionId: string;
  regionName: string;
}

export default function Home() {
  const { getStatus, cycleStatus, setStatus, resetAll, stats } = useFootprint();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    regionId: "",
    regionName: "",
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () =>
      setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
    };
  }, []);

  const handleStateClick = useCallback(
    (fips: string) => {
      cycleStatus(fips);
    },
    [cycleStatus]
  );

  const handleStateRightClick = useCallback(
    (fips: string, x: number, y: number) => {
      const state = US_STATES.find((s) => s.fips === fips);
      setContextMenu({
        visible: true,
        x,
        y,
        regionId: fips,
        regionName: state?.name ?? fips,
      });
    },
    []
  );

  const handleTerritoryClick = useCallback(
    (id: string) => {
      cycleStatus(id);
    },
    [cycleStatus]
  );

  const handleTerritoryRightClick = useCallback(
    (id: string, x: number, y: number) => {
      const territory = US_TERRITORIES.find((t) => t.id === id);
      setContextMenu({
        visible: true,
        x,
        y,
        regionId: id,
        regionName: territory?.name ?? id,
      });
    },
    []
  );

  const handleReset = useCallback(() => {
    if (window.confirm("Reset all footprint data? This cannot be undone.")) {
      resetAll();
    }
  }, [resetAll]);

  const handleContextMenuSelect = useCallback(
    (status: FootprintStatus) => {
      setStatus(contextMenu.regionId, status);
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [contextMenu.regionId, setStatus]
  );

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-screen overflow-hidden select-none bg-white"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b flex-shrink-0"
        style={{
          background: "#ffffff",
          borderColor: "#e5e7eb",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{
              background: "#f0f9ff",
              border: "1px solid #bfdbfe",
            }}
          >
            <Map size={18} style={{ color: "#0369a1" }} />
          </div>
          <div>
            <h1
              className="text-base sm:text-lg font-bold leading-none tracking-tight"
              style={{
                color: "#1f2937",
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              My U.S. Footprint Map
            </h1>
            <p
              className="text-[11px] mt-0.5 hidden sm:block"
              style={{
                color: "#9ca3af",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Click to cycle · Right-click to set directly
            </p>
          </div>
        </div>

        {/* Header stats */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Mini status pills */}
          <div className="hidden lg:flex items-center gap-2">
            {STATUS_ORDER.filter((s) => s !== "unvisited").map((status) => {
              const count = stats.byStatus[status] ?? 0;
              if (count === 0) return null;
              const config = getStatusConfig(status);
              return (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full"
                  style={{
                    background: `${config.color}22`,
                    border: `1px solid ${config.borderColor}66`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: config.borderColor,
                    }}
                  />
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: config.borderColor }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="text-xl sm:text-2xl font-bold font-mono"
              style={{ color: "#0369a1" }}
            >
              {stats.visited}
            </span>
            <span className="text-xs sm:text-sm font-mono text-gray-400">
              / 56
            </span>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-lg transition-all duration-200 text-gray-400 hover:text-red-600 hover:bg-red-50"
            style={{ border: "1px solid #e5e7eb" }}
            title="Reset all data"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left Panel — Stats + Legend */}
        <div
          className="relative flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
          style={{ width: leftPanelOpen ? "220px" : "0px" }}
        >
          <div
            className="absolute inset-y-0 left-0 overflow-y-auto"
            style={{
              width: "220px",
              background: "#ffffff",
              borderRight: "1px solid #e5e7eb",
            }}
          >
            <div className="p-3 flex flex-col gap-4 min-h-full">
              <StatsPanel stats={stats} onReset={handleReset} />
              <div
                className="border-t"
                style={{ borderColor: "#e5e7eb" }}
              />
              <Legend />
            </div>
          </div>
        </div>

        {/* Left panel toggle */}
        <button
          onClick={() => setLeftPanelOpen((v) => !v)}
          className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-10 rounded-r-lg transition-all duration-300"
          style={{
            left: leftPanelOpen ? "220px" : "0px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderLeft: "none",
            color: "#9ca3af",
          }}
        >
          {leftPanelOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Map area */}
        <div className="flex-1 relative overflow-hidden min-h-0" style={{ background: "#f3f4f6" }}>
          <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
            <USMap
              getStatus={getStatus}
              onStateClick={handleStateClick}
              onStateRightClick={handleStateRightClick}
              width={960}
              height={600}
            />
          </div>

          {/* Territories — docked bottom-right on map (replaces right sidebar) */}
          <div
            className="absolute bottom-2 right-2 z-[12] rounded-xl border shadow-sm p-2 sm:p-2.5 pointer-events-auto w-max max-w-[min(calc(100%-8px),220px)]"
            style={{
              background: "rgba(255,255,255,0.96)",
              borderColor: "#e5e7eb",
              backdropFilter: "blur(6px)",
            }}
          >
            <TerritoriesPanel
              layout="dock"
              getStatus={getStatus}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryRightClick={handleTerritoryRightClick}
            />
          </div>

          {/* Bottom hint */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-500 pointer-events-none whitespace-nowrap max-w-[calc(100%-200px)] text-center"
          >
            Left click: cycle status · Right click: set directly
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div
        className="sm:hidden relative z-10 flex items-center justify-around px-4 py-2 border-t flex-shrink-0"
        style={{
          background: "#ffffff",
          borderColor: "#e5e7eb",
        }}
      >
        <div className="text-center">
          <div
            className="text-xl font-bold font-mono"
            style={{ color: "#0369a1" }}
          >
            {stats.visited}
          </div>
          <div className="text-[10px] font-mono text-gray-500">Visited</div>
        </div>
        <div className="w-px h-8" style={{ background: "#e5e7eb" }} />
        <div className="text-center">
          <div className="text-xl font-bold font-mono text-gray-600">
            {stats.total - stats.visited}
          </div>
          <div className="text-[10px] font-mono text-gray-500">Remaining</div>
        </div>
        <div className="w-px h-8" style={{ background: "#e5e7eb" }} />
        <div className="text-center">
          <div className="text-xl font-bold font-mono text-gray-600">
            {Math.round((stats.visited / stats.total) * 100)}%
          </div>
          <div className="text-[10px] font-mono text-gray-500">Complete</div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 rounded-xl overflow-hidden shadow-lg"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            minWidth: "190px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "#e5e7eb" }}
          >
            <span
              className="text-[12px] font-semibold text-gray-900 truncate"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {contextMenu.regionName}
            </span>
            <button
              onClick={() =>
                setContextMenu((prev) => ({ ...prev, visible: false }))
              }
              className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
          {/* Status options */}
          <div className="py-1">
            {STATUS_ORDER.map((status) => {
              const config = getStatusConfig(status);
              const isCurrent = getStatus(contextMenu.regionId) === status;
              return (
                <button
                  key={status}
                  onClick={() => handleContextMenuSelect(status)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-gray-50"
                  style={{
                    background: isCurrent ? "#f0f9ff" : "transparent",
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{
                      background: config.color,
                      border: `1px solid ${config.borderColor}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-mono text-gray-900">
                      {config.labelZh}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-1.5">
                      {config.label}
                    </span>
                  </div>
                  {isCurrent && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: "#0369a1",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
