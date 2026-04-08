/**
 * USMap — Main D3-powered SVG map component
 * Design: Clean Light / Cartographic
 * Uses US Atlas TopoJSON (10m resolution) for accurate state boundaries
 * AlbersUSA projection handles AK/HI insets automatically
 *
 * DC Strategy: DC uses the same dashed leader + label styling as mid-Atlantic
 * states; the label sits just below Maryland. A red star at the true location
 * is the click target (desktop). On small viewports, hideDcUi uses the map polygon + external UI.
 */
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoData = any;
import {
  FootprintStatus,
  getStatusConfig,
  US_STATES,
} from "@/lib/footprintData";

const TOPO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663486188563/YAoDdP5gYB78su3x7qjuBc/us-states-10m_e6984906.json";

// DC FIPS code
const DC_FIPS = "11";

interface TooltipState {
  x: number;
  y: number;
  name: string;
  abbr: string;
  status: FootprintStatus;
  visible: boolean;
}

interface USMapProps {
  getStatus: (id: string) => FootprintStatus;
  onStateClick: (fips: string) => void;
  onStateRightClick?: (fips: string, x: number, y: number) => void;
  width?: number;
  height?: number;
  /** Mobile: hide pin + corner card; DC is controlled outside / on-map path */
  hideDcUi?: boolean;
  /** Mobile: pinch / wheel zoom on map graphics */
  enablePinchZoom?: boolean;
}

// Build FIPS → info lookup
const fipsToInfo: Record<string, { name: string; abbr: string; nameZh: string }> = {};
US_STATES.forEach((s) => {
  fipsToInfo[s.fips] = { name: s.name, abbr: s.abbr, nameZh: s.nameZh };
});

/** Northeast / mid-Atlantic: pull label to the right with a leader line */
const CALLOUT_RIGHT_FIPS = new Set([
  "09",
  "10",
  "24",
  "25",
  "33",
  "34",
  "44",
  "50",
]);

/** Always keep label at centroid (no leader to the right) */
const NO_RIGHT_CALLOUT_FIPS = new Set([
  "12", // FL
  "18", // IN
  "23", // ME
  "39", // OH
  "45", // SC
  "54", // WV — keep label inside state
]);

/** Extra horizontal gap for right callout (px) */
const EXTRA_CALLOUT_GAP_X: Record<string, number> = {
  "10": 24,
  "24": 22,
};

/** Fine-tune callout label x after gap (px); negative = left */
const CALLOUT_NUDGE_X: Record<string, number> = {
  "44": -10,
};

/**
 * Vertical shift for callout label + line end (px, positive = down).
 * VT uses custom placement above the map (see label loop).
 */
const CALLOUT_LABEL_DY: Record<string, number> = {
  "09": 28,
  "44": 14,
  "24": 17,
  "10": -5,
};

/** When labels sit at centroid (no right callout): nudge toward state interior. +dx right, +dy down */
const LABEL_CENTER_NUDGE: Record<string, { dx: number; dy: number }> = {
  "12": { dx: 14, dy: 8 }, // FL — nudge right toward peninsula center
  "26": { dx: 10, dy: 14 }, // MI — toward lower peninsula (centroid often in lake)
  "22": { dx: 0, dy: 6 }, // LA — slightly south
};

function wantsRightCallout(
  fips: string,
  centroid: [number, number],
  bounds: [[number, number], [number, number]],
  mapW: number
): boolean {
  if (NO_RIGHT_CALLOUT_FIPS.has(fips)) return false;
  if (fips === DC_FIPS || fips === "02" || fips === "15") return false;
  const bw = bounds[1][0] - bounds[0][0];
  const bh = bounds[1][1] - bounds[0][1];
  const area = bw * bh;
  const eastern = centroid[0] > mapW * 0.46;
  if (!eastern) return false;
  if (CALLOUT_RIGHT_FIPS.has(fips)) return true;
  return bw < 48 || bh < 36 || area < 6800;
}

/** Pentagon star path centered at origin (y-up SVG coords) */
function dcStarPath(outerR: number): string {
  const innerR = outerR * 0.38;
  const parts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    parts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
  }
  return `M${parts[0]}L${parts.slice(1).join("L")}Z`;
}

function computeCalloutLayout(
  d: GeoJSON.Feature,
  fips: string,
  path: d3.GeoPath<SVGSVGElement, d3.GeoPermissibleObjects>,
  width: number
): {
  cx: number;
  cy: number;
  lx: number;
  ly: number;
  anchor: "start" | "middle";
  callout: boolean;
} {
  const centroid = path.centroid(d as d3.GeoPermissibleObjects) as [number, number];
  const bounds = path.bounds(d as d3.GeoPermissibleObjects) as [
    [number, number],
    [number, number],
  ];
  const callout = wantsRightCallout(fips, centroid, bounds, width);
  const [cx, cy] = centroid;
  const bw = bounds[1][0] - bounds[0][0];
  const baseGap = Math.min(72, Math.max(28, 52 - bw * 0.35));
  const extraX = callout ? EXTRA_CALLOUT_GAP_X[fips] ?? 0 : 0;
  let lx = Math.min(cx + baseGap + extraX, width - 4);
  const dyCallout = callout ? CALLOUT_LABEL_DY[fips] ?? 0 : 0;
  let ly = cy + dyCallout;
  let anchor: "start" | "middle" = callout ? "start" : "middle";
  if (fips === "50" && callout) {
    const topY = bounds[0][1];
    ly = Math.max(32, topY - 22);
    lx = cx + 8;
    anchor = "middle";
  }
  if (callout) {
    lx += CALLOUT_NUDGE_X[fips] ?? 0;
  }
  return { cx, cy, lx, ly, anchor, callout };
}

/** Vertical gap from Maryland callout baseline to DC callout baseline (keeps DC below MD text) */
const DC_CALLOUT_BELOW_MD_PX = 26;

export default function USMap({
  getStatus,
  onStateClick,
  onStateRightClick,
  width = 960,
  height = 600,
  hideDcUi = false,
  enablePinchZoom = false,
}: USMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideDcUiRef = useRef(hideDcUi);
  hideDcUiRef.current = hideDcUi;
  /** Tracks hover by hit-target (pointermove), not mouseenter/mouseleave — fixes missed leave in Chrome */
  const hoveredFipsRef = useRef<string | null>(null);
  const [topoData, setTopoData] = useState<TopoData | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0,
    y: 0,
    name: "",
    abbr: "",
    status: "unvisited",
    visible: false,
  });
  const [loading, setLoading] = useState(true);

  // Keep a ref to getStatus to avoid re-drawing the whole map on every status change
  const getStatusRef = useRef(getStatus);
  getStatusRef.current = getStatus;

  // Load TopoJSON once
  useEffect(() => {
    d3.json<TopoData>(TOPO_URL).then((data) => {
      if (data) {
        setTopoData(data);
        setLoading(false);
      }
    });
  }, []);

  // Initial map draw (runs once when topoData is ready)
  useEffect(() => {
    if (!topoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg
      .on("pointermove.statehover", null)
      .on("pointerover.statehover", null)
      .on("pointerleave.statehover", null)
      .on("pointercancel.statehover", null);
    hoveredFipsRef.current = null;

    const projection = d3
      .geoAlbersUsa()
      .scale(1280)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const states = topojson.feature(topoData, topoData.objects.states);
    const borders = topojson.mesh(
      topoData,
      topoData.objects.states,
      (a: unknown, b: unknown) => a !== b
    );

    svg.selectAll("*").remove();

    const zoomRoot = svg.append("g").attr("class", "map-zoom-root");
    const gFills = zoomRoot.append("g").attr("class", "layer-fills");
    const gBorders = zoomRoot.append("g").attr("class", "layer-borders");
    const gLabels = zoomRoot.append("g").attr("class", "layer-labels");

    const features = (states as unknown as GeoJSON.FeatureCollection).features;

    const labelFill = "#0f172a";
    const labelHalo = "#ffffff";
    const labelHaloW = "2.5px";

    // State fills — .raise() only reorders within this layer so labels stay on top
    gFills
      .selectAll<SVGPathElement, GeoJSON.Feature>("path.state")
      .data(features)
      .join("path")
      .attr("class", "state")
      .attr("data-fips", (d) => String(d.id).padStart(2, "0"))
      .attr("d", path as any)
      .attr("fill", (d) => {
        const fips = String(d.id).padStart(2, "0");
        return getStatusConfig(getStatusRef.current(fips)).color;
      })
      .attr("stroke", "none")
      .style("cursor", "pointer")
      .on("click", function (_, d) {
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS && !hideDcUiRef.current) return;
        onStateClick(fips);
      })
      .on("contextmenu", function (event, d) {
        event.preventDefault();
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS && !hideDcUiRef.current) return;
        onStateRightClick?.(fips, event.clientX, event.clientY);
      });

    function hoverTargetFips(el: Element | null): string | null {
      if (!el || typeof el.closest !== "function") return null;
      if (!hideDcUiRef.current && el.closest(".dc-star-hit")) return DC_FIPS;
      const path = el.closest("path.state") as SVGPathElement | null;
      const raw = path?.getAttribute("data-fips") ?? null;
      if (!raw) return null;
      if (raw === DC_FIPS && !hideDcUiRef.current) return null;
      return raw;
    }

    function clearStateHoverVisual(fips: string) {
      gFills.select(`path.state[data-fips="${fips}"]`).each(function () {
        const sel = d3.select(this);
        sel.interrupt();
        const st = getStatusRef.current(fips);
        sel.attr("fill", getStatusConfig(st).color).attr("filter", null);
      });
    }

    function applyStateHoverVisual(fips: string) {
      gFills.select(`path.state[data-fips="${fips}"]`).each(function () {
        const sel = d3.select(this);
        sel.interrupt();
        const status = getStatusRef.current(fips);
        const config = getStatusConfig(status);
        sel
          .raise()
          .transition()
          .duration(100)
          .attr("fill", () =>
            config.id === "unvisited" ? "#1e2d45" : config.color
          )
          .attr(
            "filter",
            config.id === "unvisited"
              ? "brightness(1.5)"
              : `drop-shadow(0 0 6px ${config.borderColor}99) brightness(1.3)`
          );
      });
    }

    function syncTooltipForFips(
      fips: string,
      clientX: number,
      clientY: number
    ) {
      const svgRect = svgRef.current!.getBoundingClientRect();
      const scaleX = width / svgRect.width;
      const scaleY = height / svgRect.height;
      const status = getStatusRef.current(fips);
      const info = fipsToInfo[fips] ?? { name: `State ${fips}`, abbr: fips };
      setTooltip({
        x: (clientX - svgRect.left) * scaleX,
        y: (clientY - svgRect.top) * scaleY,
        name: info.name,
        abbr: info.abbr,
        status,
        visible: true,
      });
    }

    function handlePointerHit(event: PointerEvent) {
      const next = hoverTargetFips(event.target as Element | null);
      const prev = hoveredFipsRef.current;

      if (next === prev) {
        if (next) syncTooltipForFips(next, event.clientX, event.clientY);
        return;
      }

      if (prev) clearStateHoverVisual(prev);
      hoveredFipsRef.current = next;

      if (next) {
        applyStateHoverVisual(next);
        syncTooltipForFips(next, event.clientX, event.clientY);
      } else {
        setTooltip((p) => ({ ...p, visible: false }));
      }
    }

    svg
      .style("touch-action", "none")
      .on("pointermove.statehover", (event) =>
        handlePointerHit(event as PointerEvent)
      )
      .on("pointerover.statehover", (event) =>
        handlePointerHit(event as PointerEvent)
      )
      .on("pointerleave.statehover", function () {
        const prev = hoveredFipsRef.current;
        if (prev) clearStateHoverVisual(prev);
        hoveredFipsRef.current = null;
        setTooltip((p) => ({ ...p, visible: false }));
      })
      .on("pointercancel.statehover", function () {
        const prev = hoveredFipsRef.current;
        if (prev) clearStateHoverVisual(prev);
        hoveredFipsRef.current = null;
        setTooltip((p) => ({ ...p, visible: false }));
      });

    // Shared state boundaries (clearer silhouette per state)
    gBorders
      .append("path")
      .datum(borders)
      .attr("class", "borders")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.05)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none");

    // Outer US outline
    const nation = topojson.feature(topoData, topoData.objects.nation);
    gBorders
      .append("path")
      .datum(nation)
      .attr("class", "nation")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-width", 1.65)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none");

    // Permanent labels (not tied to hover); high-contrast halo; optional right callout
    gLabels
      .selectAll<SVGGElement, GeoJSON.Feature>("g.state-label")
      .data(features)
      .join("g")
      .attr("class", "state-label")
      .attr("data-fips", (d) => String(d.id).padStart(2, "0"))
      .style("pointer-events", "none")
      .each(function (d) {
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS) return;

        const stateInfo = fipsToInfo[fips];
        if (!stateInfo) return;

        const layout = computeCalloutLayout(d, fips, path, width);
        const { cx, cy, lx, ly, anchor, callout } = layout;
        if (isNaN(cx) || isNaN(cy)) return;

        const centerNudge = !callout ? LABEL_CENTER_NUDGE[fips] : undefined;
        const ndx = centerNudge?.dx ?? 0;
        const ndy = centerNudge?.dy ?? 0;

        const gEl = d3.select(this);
        const tx = callout ? lx : cx + ndx;
        const yAbbr = (callout ? ly - 5 : cy - 4) + ndy;
        const yZh = (callout ? ly + 7 : cy + 6) + ndy;

        if (callout) {
          gEl
            .append("line")
            .attr("x1", cx)
            .attr("y1", cy)
            .attr("x2", lx - 1)
            .attr("y2", ly)
            .attr("stroke", "#64748b")
            .attr("stroke-width", 0.85)
            .attr("stroke-dasharray", "3,2.5")
            .attr("opacity", 0.9);
          gEl
            .append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", 2.25)
            .attr("fill", "#ffffff")
            .attr("stroke", "#64748b")
            .attr("stroke-width", 0.6);
        }

        gEl
          .append("text")
          .attr("x", tx)
          .attr("y", yAbbr)
          .attr("text-anchor", anchor)
          .attr("dominant-baseline", "middle")
          .attr("font-family", "'JetBrains Mono', monospace")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .attr("letter-spacing", "0.05em")
          .attr("fill", labelFill)
          .attr("stroke", labelHalo)
          .attr("stroke-width", labelHaloW)
          .attr("paint-order", "stroke fill")
          .text(stateInfo.abbr);

        gEl
          .append("text")
          .attr("x", tx)
          .attr("y", yZh)
          .attr("text-anchor", anchor)
          .attr("dominant-baseline", "middle")
          .attr("font-family", "'Space Grotesk', sans-serif")
          .attr("font-size", "8px")
          .attr("font-weight", "600")
          .attr("fill", labelFill)
          .attr("stroke", labelHalo)
          .attr("stroke-width", labelHaloW)
          .attr("paint-order", "stroke fill")
          .text(stateInfo.nameZh);
      });

    // DC: same dashed leader + typography as mid-Atlantic callouts; label stacked under MD
    if (!hideDcUiRef.current) {
      const mdFeat = features.find(
        (f) => String(f.id).padStart(2, "0") === "24"
      );
      const dcFeat = features.find(
        (f) => String(f.id).padStart(2, "0") === DC_FIPS
      );
      if (mdFeat && dcFeat) {
        const mdLay = computeCalloutLayout(mdFeat, "24", path, width);
        const [cx, cy] = path.centroid(
          dcFeat as d3.GeoPermissibleObjects
        ) as [number, number];
        const dcInfo = fipsToInfo[DC_FIPS];
        if (dcInfo && !isNaN(cx) && !isNaN(cy)) {
          const anchor: "start" = "start";
          let lx = mdLay.lx;
          let ly = mdLay.ly + DC_CALLOUT_BELOW_MD_PX;
          if (!mdLay.callout) {
            const baseGap = 52;
            lx = Math.min(cx + baseGap, width - 4);
            ly = cy + 6;
          }
          const yAbbr = ly - 5;
          const yZh = ly + 7;

          const gDc = gLabels.append("g").attr("class", "dc-callout");

          gDc
            .append("line")
            .attr("x1", cx)
            .attr("y1", cy)
            .attr("x2", lx - 1)
            .attr("y2", ly)
            .attr("stroke", "#64748b")
            .attr("stroke-width", 0.85)
            .attr("stroke-dasharray", "3,2.5")
            .attr("opacity", 0.9)
            .style("pointer-events", "none");

          gDc
            .append("text")
            .attr("x", lx)
            .attr("y", yAbbr)
            .attr("text-anchor", anchor)
            .attr("dominant-baseline", "middle")
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr("font-size", "11px")
            .attr("font-weight", "700")
            .attr("letter-spacing", "0.05em")
            .attr("fill", labelFill)
            .attr("stroke", labelHalo)
            .attr("stroke-width", labelHaloW)
            .attr("paint-order", "stroke fill")
            .style("pointer-events", "none")
            .text(dcInfo.abbr);

          gDc
            .append("text")
            .attr("x", lx)
            .attr("y", yZh)
            .attr("text-anchor", anchor)
            .attr("dominant-baseline", "middle")
            .attr("font-family", "'Space Grotesk', sans-serif")
            .attr("font-size", "8px")
            .attr("font-weight", "600")
            .attr("fill", labelFill)
            .attr("stroke", labelHalo)
            .attr("stroke-width", labelHaloW)
            .attr("paint-order", "stroke fill")
            .style("pointer-events", "none")
            .text(dcInfo.nameZh);

          const starG = gDc
            .append("g")
            .attr("class", "dc-star-interactive")
            .style("cursor", "pointer");

          starG
            .append("circle")
            .attr("class", "dc-star-hit")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", 11)
            .attr("fill", "transparent")
            .on("click", function (e) {
              e.stopPropagation();
              onStateClick(DC_FIPS);
            })
            .on("contextmenu", function (e) {
              e.preventDefault();
              e.stopPropagation();
              onStateRightClick?.(DC_FIPS, e.clientX, e.clientY);
            });

          starG
            .append("path")
            .attr("d", dcStarPath(3.8))
            .attr("transform", `translate(${cx},${cy})`)
            .attr("fill", "#dc2626")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 0.5)
            .attr("paint-order", "stroke fill")
            .style("pointer-events", "none");
        }
      }
    }

    return () => {
      hoveredFipsRef.current = null;
      const node = svgRef.current;
      if (node) {
        d3.select(node)
          .on("pointermove.statehover", null)
          .on("pointerover.statehover", null)
          .on("pointerleave.statehover", null)
          .on("pointercancel.statehover", null);
      }
    };
  }, [topoData, width, height, hideDcUi, onStateClick, onStateRightClick]);

  // Re-color states when footprint data changes
  useEffect(() => {
    if (!svgRef.current || !topoData) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGPathElement, GeoJSON.Feature>("path.state").attr(
      "fill",
      (d) => {
        const fips = String(d.id).padStart(2, "0");
        return getStatusConfig(getStatus(fips)).color;
      }
    );
  }, [getStatus, topoData]);

  useEffect(() => {
    if (!enablePinchZoom || !svgRef.current || loading || !topoData) return;
    const svgEl = svgRef.current;
    const d3svg = d3.select(svgEl);
    const root = d3svg.select<SVGGElement>("g.map-zoom-root");
    if (root.empty()) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.55, 16])
      .filter((event) => {
        if (event.type === "wheel") return (event as WheelEvent).ctrlKey;
        return true;
      })
      .on("zoom", (e) => {
        root.attr("transform", e.transform.toString());
      });

    d3svg.call(zoom);
    d3svg.on("dblclick.zoom", null);

    return () => {
      d3svg.on(".zoom", null);
      root.attr("transform", null);
    };
  }, [enablePinchZoom, loading, topoData]);

  const tooltipConfig = getStatusConfig(tooltip.status);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#e5e7eb", borderTopColor: "#0369a1" }}
          />
          <div className="text-xs font-mono" style={{ color: "#9ca3af" }}>
            Loading map data...
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={enablePinchZoom ? "w-full h-full touch-none" : "w-full h-full"}
        style={{ display: loading ? "none" : "block" }}
      />

      {/* Tooltip for other states */}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
            transform: "translate(-50%, -115%)",
          }}
        >
          <div
            className="rounded-xl px-3.5 py-2.5 shadow-lg"
            style={{
              background: "#ffffff",
              border: `1px solid ${
                tooltip.status === "unvisited"
                  ? "#e5e7eb"
                  : `${tooltipConfig.borderColor}44`
              }`,
              boxShadow:
                tooltip.status !== "unvisited"
                  ? `0 0 20px ${tooltipConfig.borderColor}11, 0 4px 12px rgba(0,0,0,0.08)`
                  : "0 4px 12px rgba(0,0,0,0.08)",
              minWidth: "140px",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: "#f0f9ff",
                  color: "#0369a1",
                }}
              >
                {tooltip.abbr}
              </span>
              <span
                className="text-[13px] font-semibold leading-tight"
                style={{
                  color: "#1f2937",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {tooltip.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-sm"
                style={{
                  background: tooltipConfig.color,
                  border: `1px solid ${
                    tooltip.status === "unvisited"
                      ? "#e5e7eb"
                      : `${tooltipConfig.borderColor}66`
                  }`,
                  boxShadow:
                    tooltip.status !== "unvisited"
                      ? `0 0 4px ${tooltipConfig.borderColor}`
                      : "none",
                }}
              />
              <span
                className="text-[11px] font-mono"
                style={{
                  color:
                    tooltip.status === "unvisited"
                      ? "#9ca3af"
                      : tooltipConfig.borderColor,
                }}
              >
                {tooltipConfig.labelZh} · {tooltipConfig.label}
              </span>
            </div>
            <div
              className="text-[10px] font-mono mt-1.5 pt-1.5 border-t"
              style={{
                color: "#9ca3af",
                borderColor: "#e5e7eb",
              }}
            >
              Left click: next · Right click: choose
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-1.5 overflow-hidden">
            <div
              className="w-3 h-3 rotate-45 -translate-y-1.5 mx-auto"
              style={{
                background: "#ffffff",
                border: `1px solid ${
                  tooltip.status === "unvisited"
                    ? "#e5e7eb"
                    : `${tooltipConfig.borderColor}44`
                }`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
