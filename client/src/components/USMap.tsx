/**
 * USMap — Main D3-powered SVG map component
 * Design: Clean Light / Cartographic
 * Uses US Atlas TopoJSON (10m resolution) for accurate state boundaries
 * AlbersUSA projection handles AK/HI insets automatically
 *
 * DC Strategy: DC is tiny on the map. A small pin marks the true location;
 * the interactive label card sits in the bottom-right of the container so
 * it does not cover nearby states.
 */
import { useEffect, useRef, useState, useCallback } from "react";
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

// DC pin position in px relative to map container (tracks SVG letterboxing / resize)
interface DCOverlayPos {
  dotPxX: number;
  dotPxY: number;
  ready: boolean;
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
  const [dcPos, setDcPos] = useState<DCOverlayPos>({
    dotPxX: 0,
    dotPxY: 0,
    ready: false,
  });
  const dcCentroidVBRef = useRef<[number, number] | null>(null);
  const [dcHoverMap, setDcHoverMap] = useState(false);
  const [dcHoverCorner, setDcHoverCorner] = useState(false);
  const dcHover = dcHoverMap || dcHoverCorner;

  // Keep a ref to getStatus to avoid re-drawing the whole map on every status change
  const getStatusRef = useRef(getStatus);
  getStatusRef.current = getStatus;

  /** Store DC centroid in SVG viewBox coords; pixel overlay synced via getScreenCTM + ResizeObserver */
  const computeDcCentroidVB = useCallback(
    (projection: d3.GeoProjection, features: GeoJSON.Feature[]) => {
      const dcFeature = features.find(
        (f) => String(f.id).padStart(2, "0") === DC_FIPS
      );
      if (!dcFeature) return;
      const path = d3.geoPath().projection(projection);
      const centroid = path.centroid(dcFeature as any);
      if (!centroid || isNaN(centroid[0])) return;
      dcCentroidVBRef.current = [centroid[0], centroid[1]];
    },
    []
  );

  const syncDcPinPosition = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    const vb = dcCentroidVBRef.current;
    if (!svg || !container || !vb) return;
    if (getComputedStyle(svg).display === "none") return;
    const pt = svg.createSVGPoint();
    pt.x = vb[0];
    pt.y = vb[1];
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screen = pt.matrixTransform(ctm);
    const cr = container.getBoundingClientRect();
    setDcPos({
      dotPxX: screen.x - cr.left,
      dotPxY: screen.y - cr.top,
      ready: true,
    });
  }, []);

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

        const centroid = path.centroid(d as any) as [number, number];
        if (!centroid || isNaN(centroid[0])) return;

        const bounds = path.bounds(d as any) as [[number, number], [number, number]];
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

        const gEl = d3.select(this);
        const tx = callout ? lx : cx;
        const yAbbr = callout ? ly - 5 : cy - 4;
        const yZh = callout ? ly + 7 : cy + 6;

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

    computeDcCentroidVB(projection, features);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => syncDcPinPosition());
    });

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
  }, [
    topoData,
    width,
    height,
    onStateClick,
    onStateRightClick,
    computeDcCentroidVB,
    syncDcPinPosition,
  ]);

  useEffect(() => {
    if (loading || !topoData) return;
    const container = containerRef.current;
    if (!container) return;
    syncDcPinPosition();
    const ro = new ResizeObserver(() => syncDcPinPosition());
    ro.observe(container);
    window.addEventListener("resize", syncDcPinPosition);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncDcPinPosition);
    };
  }, [loading, topoData, syncDcPinPosition]);

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
  const dcStatus = getStatus(DC_FIPS);
  const dcConfig = getStatusConfig(dcStatus);
  const dcVisited = dcStatus !== "unvisited";

  const dcRichTooltip = (
    <div
      className="rounded-xl px-3.5 py-2.5 shadow-lg"
      style={{
        background: "#ffffff",
        border: `1px solid ${
          dcVisited ? `${dcConfig.borderColor}44` : "#e5e7eb"
        }`,
        boxShadow: dcVisited
          ? `0 0 20px ${dcConfig.borderColor}11, 0 4px 12px rgba(0,0,0,0.08)`
          : "0 4px 12px rgba(0,0,0,0.08)",
        minWidth: "160px",
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
          DC
        </span>
        <span
          className="text-[13px] font-semibold leading-tight"
          style={{
            color: "#1f2937",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Washington D.C.
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{
            background: dcConfig.color,
            border: `1px solid ${
              dcVisited ? `${dcConfig.borderColor}66` : "rgba(30,58,95,0.6)"
            }`,
            boxShadow: dcVisited ? `0 0 4px ${dcConfig.borderColor}` : "none",
          }}
        />
        <span
          className="text-[11px] font-mono"
          style={{
            color: dcVisited ? dcConfig.borderColor : "#475569",
          }}
        >
          {dcConfig.labelZh} · {dcConfig.label}
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
  );

  // DC map pin: true geographic anchor (small hit target only)
  // DC label card: bottom-right of container — does not overlap the mainland map

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

      {/* DC geographic pin — small target only; label lives in the corner */}
      {!hideDcUi && dcPos.ready && !loading && (
        <div
          className="absolute z-[15]"
          style={{
            left: dcPos.dotPxX,
            top: dcPos.dotPxY,
            transform: "translate(-50%, -50%)",
            width: "28px",
            height: "28px",
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            className="absolute inset-0 pointer-events-auto rounded-full"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => onStateClick(DC_FIPS)}
            onContextMenu={(e) => {
              e.preventDefault();
              onStateRightClick?.(DC_FIPS, e.clientX, e.clientY);
            }}
            onMouseEnter={() => setDcHoverMap(true)}
            onMouseLeave={() => setDcHoverMap(false)}
            title="Washington D.C."
            aria-label="Washington D.C. on map"
          />
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            {dcHover && (
              <circle
                cx="11"
                cy="11"
                r="9"
                fill="none"
                stroke={dcVisited ? dcConfig.borderColor : "#00d4ff"}
                strokeWidth="1"
                opacity="0.35"
              />
            )}
            <circle
              cx="11"
              cy="11"
              r={dcHover ? 5 : 3.5}
              fill={
                dcVisited
                  ? dcConfig.borderColor
                  : dcHover
                    ? "#0369a1"
                    : "#06b6d4"
              }
              stroke="#ffffff"
              strokeWidth="1"
              style={{ transition: "r 0.15s, fill 0.15s" }}
            />
          </svg>
          {dcHoverMap && !dcHoverCorner && (
            <div
              className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2"
              style={{
                top: "calc(100% + 6px)",
                maxWidth: "min(260px, calc(100vw - 48px))",
              }}
            >
              {dcRichTooltip}
            </div>
          )}
        </div>
      )}

      {/* DC label card — same vertical line as map pin; snug to map right edge */}
      {!hideDcUi && dcPos.ready && !loading && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            right: 2,
            top: dcPos.dotPxY,
            transform: "translateY(-50%)",
          }}
        >
          <div className="relative">
            {dcHoverCorner && (
              <div
                className="pointer-events-none absolute z-50 right-0"
                style={{
                  bottom: "calc(100% + 6px)",
                  maxWidth: "min(260px, calc(100vw - 48px))",
                }}
              >
                {dcRichTooltip}
              </div>
            )}
            <button
              type="button"
              className="pointer-events-auto text-left rounded-lg border shadow-sm transition-colors duration-150"
              style={{
                padding: "6px 10px",
                minWidth: "72px",
                background: dcVisited
                  ? `${dcConfig.color}ee`
                  : dcHoverCorner
                    ? "#f3f4f6"
                    : "#ffffff",
                borderColor: dcVisited
                  ? `${dcConfig.borderColor}88`
                  : dcHoverCorner
                    ? "#9ca3af"
                    : "#e5e7eb",
              }}
              onClick={() => onStateClick(DC_FIPS)}
              onContextMenu={(e) => {
                e.preventDefault();
                onStateRightClick?.(DC_FIPS, e.clientX, e.clientY);
              }}
              onMouseEnter={() => setDcHoverCorner(true)}
              onMouseLeave={() => setDcHoverCorner(false)}
              title="Washington D.C."
            >
              <div
                className="text-[10px] font-mono font-bold tracking-wide"
                style={{
                  color: dcVisited
                    ? dcConfig.borderColor
                    : dcHoverCorner
                      ? "#1f2937"
                      : "#9ca3af",
                }}
              >
                DC
              </div>
              <div
                className="text-[9px] font-medium leading-tight mt-0.5"
                style={{
                  color: "#475569",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {fipsToInfo[DC_FIPS]?.nameZh ?? "华盛顿特区"}
              </div>
              {dcVisited && (
                <div
                  className="text-[9px] font-mono leading-tight mt-0.5 opacity-90"
                  style={{ color: dcConfig.borderColor }}
                >
                  {dcConfig.labelZh}
                </div>
              )}
              <div
                className="text-[8px] font-mono mt-1 opacity-60"
                style={{ color: "#64748b" }}
              >
                地图圆点处
              </div>
            </button>
          </div>
        </div>
      )}

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
