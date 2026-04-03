/**
 * Home — Main page layout
 * Design: Deep Space / Data Observatory
 * Features: Full-screen map, collapsible side panels, context menu for direct status selection
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

const SPACE_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663486188563/YAoDdP5gYB78su3x7qjuBc/space-bg-VJFRQVFzPdnLvRn2e2AKML.webp";

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
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
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
      className="relative flex flex-col h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {/* Space background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${SPACE_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.6,
        }}
      />
      {/* Dark overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: "rgba(8,12,22,0.55)" }}
      />
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b flex-shrink-0"
        style={{
          background: "rgba(8,12,22,0.88)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(30,58,95,0.6)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.2)",
              boxShadow: "0 0 12px rgba(0,212,255,0.1)",
            }}
          >
            <Map size={18} style={{ color: "#00d4ff" }} />
          </div>
          <div>
            <h1
              className="text-base sm:text-lg font-bold leading-none tracking-tight"
              style={{
                color: "#e2e8f0",
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              My U.S. Footprint Map
            </h1>
            <p
              className="text-[11px] mt-0.5 hidden sm:block"
              style={{
                color: "#475569",
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
                    background: `${config.color}cc`,
                    border: `1px solid ${config.glowColor}33`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: config.glowColor,
                      boxShadow: `0 0 4px ${config.glowColor}`,
                    }}
                  />
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: config.glowColor }}
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
              style={{ color: "#00d4ff", textShadow: "0 0 16px rgba(0,212,255,0.5)" }}
            >
              {stats.visited}
            </span>
            <span className="text-xs sm:text-sm font-mono text-slate-500">
              / 56
            </span>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-lg transition-all duration-200 text-slate-600 hover:text-red-400 hover:border-red-900/40"
            style={{ border: "1px solid rgba(30,58,95,0.4)" }}
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
              background: "rgba(8,12,22,0.88)",
              backdropFilter: "blur(16px)",
              borderRight: "1px solid rgba(30,58,95,0.5)",
            }}
          >
            <div className="p-3 flex flex-col gap-4 min-h-full">
              <StatsPanel stats={stats} onReset={handleReset} />
              <div
                className="border-t"
                style={{ borderColor: "rgba(30,58,95,0.4)" }}
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
            background: "rgba(13,21,38,0.92)",
            border: "1px solid rgba(30,58,95,0.5)",
            borderLeft: "none",
            color: "#475569",
          }}
        >
          {leftPanelOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Map area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
            <USMap
              getStatus={getStatus}
              onStateClick={handleStateClick}
              onStateRightClick={handleStateRightClick}
              width={960}
              height={600}
            />
          </div>

          {/* Bottom hint */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-700 pointer-events-none whitespace-nowrap"
          >
            Left click: cycle status · Right click: set directly
          </div>
        </div>

        {/* Right Panel — Territories */}
        <div
          className="relative flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
          style={{ width: rightPanelOpen ? "180px" : "0px" }}
        >
          <div
            className="absolute inset-y-0 right-0 overflow-y-auto"
            style={{
              width: "180px",
              background: "rgba(8,12,22,0.88)",
              backdropFilter: "blur(16px)",
              borderLeft: "1px solid rgba(30,58,95,0.5)",
            }}
          >
            <div className="p-3">
              <TerritoriesPanel
                getStatus={getStatus}
                onTerritoryClick={handleTerritoryClick}
                onTerritoryRightClick={handleTerritoryRightClick}
              />
            </div>
          </div>
        </div>

        {/* Right panel toggle */}
        <button
          onClick={() => setRightPanelOpen((v) => !v)}
          className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-10 rounded-l-lg transition-all duration-300"
          style={{
            right: rightPanelOpen ? "180px" : "0px",
            background: "rgba(13,21,38,0.92)",
            border: "1px solid rgba(30,58,95,0.5)",
            borderRight: "none",
            color: "#475569",
          }}
        >
          {rightPanelOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Mobile bottom bar */}
      <div
        className="sm:hidden relative z-10 flex items-center justify-around px-4 py-2 border-t flex-shrink-0"
        style={{
          background: "rgba(8,12,22,0.95)",
          borderColor: "rgba(30,58,95,0.4)",
        }}
      >
        <div className="text-center">
          <div
            className="text-xl font-bold font-mono"
            style={{ color: "#00d4ff" }}
          >
            {stats.visited}
          </div>
          <div className="text-[10px] font-mono text-slate-500">Visited</div>
        </div>
        <div className="w-px h-8" style={{ background: "rgba(30,58,95,0.5)" }} />
        <div className="text-center">
          <div className="text-xl font-bold font-mono text-slate-300">
            {stats.total - stats.visited}
          </div>
          <div className="text-[10px] font-mono text-slate-500">Remaining</div>
        </div>
        <div className="w-px h-8" style={{ background: "rgba(30,58,95,0.5)" }} />
        <div className="text-center">
          <div className="text-xl font-bold font-mono text-slate-300">
            {Math.round((stats.visited / stats.total) * 100)}%
          </div>
          <div className="text-[10px] font-mono text-slate-500">Complete</div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            background: "rgba(8,12,22,0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(30,58,95,0.7)",
            boxShadow: "0 0 30px rgba(0,0,0,0.6), 0 0 1px rgba(0,212,255,0.2)",
            minWidth: "190px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "rgba(30,58,95,0.5)" }}
          >
            <span
              className="text-[12px] font-semibold text-slate-200 truncate"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {contextMenu.regionName}
            </span>
            <button
              onClick={() =>
                setContextMenu((prev) => ({ ...prev, visible: false }))
              }
              className="text-slate-600 hover:text-slate-400 ml-2 flex-shrink-0"
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-white/5"
                  style={{
                    background: isCurrent ? "rgba(0,212,255,0.06)" : "transparent",
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{
                      background: config.color,
                      border: `1px solid ${
                        status === "unvisited"
                          ? "rgba(30,58,95,0.6)"
                          : `${config.glowColor}66`
                      }`,
                      boxShadow:
                        status !== "unvisited"
                          ? `0 0 4px ${config.glowColor}66`
                          : "none",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-mono text-slate-300">
                      {config.labelZh}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-1.5">
                      {config.label}
                    </span>
                  </div>
                  {isCurrent && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: "#00d4ff",
                        boxShadow: "0 0 4px #00d4ff",
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
