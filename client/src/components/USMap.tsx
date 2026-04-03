/**
 * USMap — Main D3-powered SVG map component
 * Design: Deep Space / Data Observatory
 * Uses US Atlas TopoJSON (10m resolution) for accurate state boundaries
 * AlbersUSA projection handles AK/HI insets automatically
 *
 * DC Strategy: DC is tiny and near the right edge of the SVG.
 * We render the DC callout as a React DOM overlay (not inside SVG) so it
 * is never clipped, and we compute its screen position from the SVG's
 * current bounding rect + projection centroid.
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

// DC callout overlay position (in % of SVG container)
interface DCOverlayPos {
  dotPctX: number; // % from left of SVG container
  dotPctY: number; // % from top of SVG container
  ready: boolean;
}

interface USMapProps {
  getStatus: (id: string) => FootprintStatus;
  onStateClick: (fips: string) => void;
  onStateRightClick?: (fips: string, x: number, y: number) => void;
  width?: number;
  height?: number;
}

// Build FIPS → info lookup
const fipsToInfo: Record<string, { name: string; abbr: string }> = {};
US_STATES.forEach((s) => {
  fipsToInfo[s.fips] = { name: s.name, abbr: s.abbr };
});

export default function USMap({
  getStatus,
  onStateClick,
  onStateRightClick,
  width = 960,
  height = 600,
}: USMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
    dotPctX: 0,
    dotPctY: 0,
    ready: false,
  });
  const [dcHover, setDcHover] = useState(false);

  // Keep a ref to getStatus to avoid re-drawing the whole map on every status change
  const getStatusRef = useRef(getStatus);
  getStatusRef.current = getStatus;

  // Compute DC overlay position from projection centroid → SVG viewBox → screen %
  const computeDcPos = useCallback(
    (projection: d3.GeoProjection, features: GeoJSON.Feature[]) => {
      const dcFeature = features.find(
        (f) => String(f.id).padStart(2, "0") === DC_FIPS
      );
      if (!dcFeature) return;
      const path = d3.geoPath().projection(projection);
      const centroid = path.centroid(dcFeature as any);
      if (!centroid || isNaN(centroid[0])) return;
      // centroid is in viewBox coords (0..width, 0..height)
      setDcPos({
        dotPctX: (centroid[0] / width) * 100,
        dotPctY: (centroid[1] / height) * 100,
        ready: true,
      });
    },
    [width, height]
  );

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

    const g = svg.append("g");

    const features = (states as unknown as GeoJSON.FeatureCollection).features;

    // Draw state paths (excluding DC — handled by overlay)
    g.selectAll<SVGPathElement, GeoJSON.Feature>("path.state")
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
      .on("mouseenter", function (event, d) {
        const fips = String(d.id).padStart(2, "0");
        // DC click is handled by overlay; skip hover highlight for DC path
        if (fips === DC_FIPS) return;
        const status = getStatusRef.current(fips);
        const config = getStatusConfig(status);
        const svgRect = svgRef.current!.getBoundingClientRect();
        const scaleX = width / svgRect.width;
        const scaleY = height / svgRect.height;

        d3.select(this)
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
              : `drop-shadow(0 0 6px ${config.glowColor}99) brightness(1.3)`
          );

        const info = fipsToInfo[fips] ?? { name: `State ${fips}`, abbr: fips };
        setTooltip({
          x: (event.clientX - svgRect.left) * scaleX,
          y: (event.clientY - svgRect.top) * scaleY,
          name: info.name,
          abbr: info.abbr,
          status,
          visible: true,
        });
      })
      .on("mousemove", function (_, d) {
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS) return;
      })
      .on("mouseleave", function (_, d) {
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS) return;
        const status = getStatusRef.current(fips);
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", getStatusConfig(status).color)
          .attr("filter", null);
        setTooltip((prev) => ({ ...prev, visible: false }));
      })
      .on("click", function (_, d) {
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS) return; // handled by overlay
        onStateClick(fips);
      })
      .on("contextmenu", function (event, d) {
        event.preventDefault();
        const fips = String(d.id).padStart(2, "0");
        if (fips === DC_FIPS) return; // handled by overlay
        onStateRightClick?.(fips, event.clientX, event.clientY);
      });

    // State borders
    g.append("path")
      .datum(borders)
      .attr("class", "borders")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#0a0e1a")
      .attr("stroke-width", 0.7)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none");

    // Nation outline
    const nation = topojson.feature(topoData, topoData.objects.nation);
    g.append("path")
      .datum(nation)
      .attr("class", "nation")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#1e3a5f")
      .attr("stroke-width", 1.2)
      .style("pointer-events", "none");

    // Compute DC overlay position
    computeDcPos(projection, features);
  }, [topoData, width, height, onStateClick, onStateRightClick, computeDcPos]);

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

  const tooltipConfig = getStatusConfig(tooltip.status);
  const dcStatus = getStatus(DC_FIPS);
  const dcConfig = getStatusConfig(dcStatus);
  const dcVisited = dcStatus !== "unvisited";

  // DC overlay: dot is at (dotPctX%, dotPctY%) of SVG container
  // Label pill is offset to upper-left to avoid right-edge clipping
  // We use a generous hit area (button) around both dot + label

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#1e3a5f", borderTopColor: "#00d4ff" }}
          />
          <div className="text-xs font-mono" style={{ color: "#475569" }}>
            Loading map data...
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ display: loading ? "none" : "block" }}
      />

      {/* DC Callout Overlay — rendered outside SVG to avoid clipping */}
      {dcPos.ready && !loading && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${dcPos.dotPctX}%`,
            top: `${dcPos.dotPctY}%`,
            // Shift so the dot is at the anchor point
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Invisible large hit area button */}
          <button
            className="absolute pointer-events-auto"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "80px",
              height: "80px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              zIndex: 10,
            }}
            onClick={() => onStateClick(DC_FIPS)}
            onContextMenu={(e) => {
              e.preventDefault();
              onStateRightClick?.(DC_FIPS, e.clientX, e.clientY);
            }}
            onMouseEnter={() => setDcHover(true)}
            onMouseLeave={() => setDcHover(false)}
            title="Washington D.C."
          />

          {/* SVG mini-callout rendered as inline SVG for crisp lines */}
          <svg
            width="90"
            height="75"
            viewBox="0 0 90 75"
            style={{
              position: "absolute",
              // Position so anchor dot is at (75, 60) within this mini-SVG
              left: "50%",
              top: "50%",
              transform: "translate(-75px, -60px)",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            {/* Dashed leader line from label to dot */}
            <line
              x1="44"
              y1="32"
              x2="73"
              y2="57"
              stroke={dcHover ? "#cbd5e1" : "#64748b"}
              strokeWidth="1"
              strokeDasharray="3,2"
            />
            {/* Arrow head at dot end */}
            <polyline
              points="67,54 73,57 70,51"
              fill="none"
              stroke={dcHover ? "#cbd5e1" : "#64748b"}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Label pill background */}
            <rect
              x="12"
              y="10"
              width="36"
              height="22"
              rx="5"
              fill={
                dcVisited
                  ? `${dcConfig.color}ee`
                  : dcHover
                  ? "#0e1a2e"
                  : "#0a0e1a"
              }
              stroke={
                dcVisited
                  ? `${dcConfig.glowColor}88`
                  : dcHover
                  ? "#94a3b8"
                  : "#1e3a5f"
              }
              strokeWidth="1"
            />
            {/* "DC" label */}
            <text
              x="30"
              y="21"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={
                dcVisited
                  ? dcConfig.glowColor
                  : dcHover
                  ? "#e2e8f0"
                  : "#94a3b8"
              }
              fontSize="9"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="700"
              letterSpacing="0.08em"
            >
              DC
            </text>
            {/* Status label below DC when visited */}
            {dcVisited && (
              <text
                x="30"
                y="29"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={dcConfig.glowColor}
                fontSize="6.5"
                fontFamily="'JetBrains Mono', monospace"
                opacity="0.85"
              >
                {dcConfig.labelZh}
              </text>
            )}
            {/* Anchor dot at DC location */}
            <circle
              cx="75"
              cy="60"
              r={dcHover ? 5 : 3.5}
              fill={
                dcVisited
                  ? dcConfig.glowColor
                  : dcHover
                  ? "#00d4ff"
                  : "#38bdf8"
              }
              stroke="#0a0e1a"
              strokeWidth="1"
              style={{ transition: "r 0.15s, fill 0.15s" }}
            />
            {/* Glow ring on hover */}
            {dcHover && (
              <circle
                cx="75"
                cy="60"
                r="9"
                fill="none"
                stroke={dcVisited ? dcConfig.glowColor : "#00d4ff"}
                strokeWidth="1"
                opacity="0.3"
              />
            )}
          </svg>

          {/* Hover tooltip for DC */}
          {dcHover && (
            <div
              className="pointer-events-none absolute z-50"
              style={{
                left: "50%",
                top: "-10px",
                transform: "translate(-50%, -100%)",
                whiteSpace: "nowrap",
              }}
            >
              <div
                className="rounded-xl px-3.5 py-2.5 shadow-2xl"
                style={{
                  background: "rgba(8,12,22,0.96)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${
                    dcVisited
                      ? `${dcConfig.glowColor}44`
                      : "rgba(30,58,95,0.6)"
                  }`,
                  boxShadow: dcVisited
                    ? `0 0 20px ${dcConfig.glowColor}22, 0 4px 20px rgba(0,0,0,0.5)`
                    : "0 4px 20px rgba(0,0,0,0.5)",
                  minWidth: "160px",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(30,58,95,0.4)",
                      color: "#94a3b8",
                    }}
                  >
                    DC
                  </span>
                  <span
                    className="text-[13px] font-semibold leading-tight"
                    style={{
                      color: "#e2e8f0",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Washington D.C.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{
                      background: dcConfig.color,
                      border: `1px solid ${
                        dcVisited
                          ? `${dcConfig.glowColor}66`
                          : "rgba(30,58,95,0.6)"
                      }`,
                      boxShadow: dcVisited
                        ? `0 0 4px ${dcConfig.glowColor}`
                        : "none",
                    }}
                  />
                  <span
                    className="text-[11px] font-mono"
                    style={{
                      color: dcVisited ? dcConfig.glowColor : "#475569",
                    }}
                  >
                    {dcConfig.labelZh} · {dcConfig.label}
                  </span>
                </div>
                <div
                  className="text-[10px] font-mono mt-1.5 pt-1.5 border-t"
                  style={{
                    color: "#334155",
                    borderColor: "rgba(30,58,95,0.3)",
                  }}
                >
                  Left click: next · Right click: choose
                </div>
              </div>
            </div>
          )}
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
            className="rounded-xl px-3.5 py-2.5 shadow-2xl"
            style={{
              background: "rgba(8,12,22,0.96)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${
                tooltip.status === "unvisited"
                  ? "rgba(30,58,95,0.6)"
                  : `${tooltipConfig.glowColor}44`
              }`,
              boxShadow:
                tooltip.status !== "unvisited"
                  ? `0 0 20px ${tooltipConfig.glowColor}22, 0 4px 20px rgba(0,0,0,0.5)`
                  : "0 4px 20px rgba(0,0,0,0.5)",
              minWidth: "140px",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(30,58,95,0.4)",
                  color: "#94a3b8",
                }}
              >
                {tooltip.abbr}
              </span>
              <span
                className="text-[13px] font-semibold leading-tight"
                style={{
                  color: "#e2e8f0",
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
                      ? "rgba(30,58,95,0.6)"
                      : `${tooltipConfig.glowColor}66`
                  }`,
                  boxShadow:
                    tooltip.status !== "unvisited"
                      ? `0 0 4px ${tooltipConfig.glowColor}`
                      : "none",
                }}
              />
              <span
                className="text-[11px] font-mono"
                style={{
                  color:
                    tooltip.status === "unvisited"
                      ? "#475569"
                      : tooltipConfig.glowColor,
                }}
              >
                {tooltipConfig.labelZh} · {tooltipConfig.label}
              </span>
            </div>
            <div
              className="text-[10px] font-mono mt-1.5 pt-1.5 border-t"
              style={{
                color: "#334155",
                borderColor: "rgba(30,58,95,0.3)",
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
                background: "rgba(8,12,22,0.96)",
                border: `1px solid ${
                  tooltip.status === "unvisited"
                    ? "rgba(30,58,95,0.6)"
                    : `${tooltipConfig.glowColor}44`
                }`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
