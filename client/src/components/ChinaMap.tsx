/**
 * ChinaMap — flat map of China's 34 province-level regions, laid out the way
 * maps published in China are: Albers conic projection centred on 105°E, with
 * the South China Sea islands in an inset at the lower right.
 *
 * The shapes come from the same region data as the globe (Natural Earth), so
 * this follows the conventions of the standard map but is not a copy of it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Feature } from "geojson";
import { getStatusConfig, type FootprintData } from "@/lib/footprintData";
import { NINE_DASH_LINE } from "@/lib/nineDashLine";
import type { RegionInfo, WorldData } from "@/lib/worldData";

const W = 1080;
/** right edge of the main map; the strip beyond it holds the inset, clear of Taiwan */
const MAIN_RIGHT = 976;
const H = 780;
/** inset frame, lower right */
const INSET = { x: 918, y: 548, w: 150, h: 220 };

const NEIGHBOURS = [
  "MNG", "RUS", "KAZ", "KGZ", "TJK", "UZB", "AFG", "PAK", "IND", "NPL", "BTN", "BGD", "MMR", "LAO", "VNM",
  "THA", "KHM", "PRK", "KOR", "JPN", "PHL", "MYS", "BRN", "IDN",
];

/** island groups too small to show as shapes: [name, lon, lat] */
const SEA_ISLANDS: [string, number, number][] = [
  ["东沙群岛", 116.72, 20.7],
  ["西沙群岛", 111.8, 16.5],
  ["中沙群岛", 114.4, 15.9],
  ["黄岩岛", 117.76, 15.15],
  ["南沙群岛", 114.3, 10.0],
  ["曾母暗沙", 112.28, 3.97],
];
const DIAOYU: [string, number, number] = ["钓鱼岛", 123.47, 25.74];

const shortName = (name: string) =>
  name.replace(/(维吾尔|壮族|回族)?自治区$|特别行政区$|省$|市$/, "") || name;

interface Props {
  world: WorldData;
  data: FootprintData;
  onClick(id: string): void;
  onMenu(id: string, x: number, y: number): void;
}

export default function ChinaMap({ world, data, onClick, onMenu }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<{ r: RegionInfo; x: number; y: number } | null>(null);
  const [k, setK] = useState(1);

  const geo = useMemo(() => {
    const china = world.countries.get("CHN")!;
    const main = d3
      .geoConicEqualArea()
      .parallels([25, 47])
      .rotate([-105, 0])
      .fitExtent(
        [
          [24, 20],
          [MAIN_RIGHT, H - 20],
        ],
        {
          type: "MultiPoint",
          // the four extremes of the mainland and Hainan Island
          coordinates: [
            [73.5, 39.4],
            [135.1, 48.4],
            [123.3, 53.6],
            [109.5, 18.0],
          ],
        }
      );
    const inset = d3.geoMercator().fitExtent(
      [
        [INSET.x + 4, INSET.y + 4],
        [INSET.x + INSET.w - 4, INSET.y + INSET.h - 4],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [106.5, 24.5],
          [122.5, 2.5],
        ],
      }
    );
    const mainPath = d3.geoPath(main);
    const insetPath = d3.geoPath(inset);
    const neighbours = NEIGHBOURS.filter((c) => world.countries.has(c)).map((c) => world.countryOutline(c));
    const outline = world.countryOutline("CHN");
    return {
      main,
      inset,
      regions: china.regions.map((r) => {
        const f = world.features.get(r.id) as Feature;
        return { r, d: mainPath(f) ?? "", dInset: insetPath(f) ?? "", label: main([r.x, r.y]) };
      }),
      neighbours: neighbours.map((f) => mainPath(f) ?? ""),
      neighboursInset: neighbours.map((f) => insetPath(f) ?? ""),
      outline: mainPath(outline) ?? "",
      outlineInset: insetPath(outline) ?? "",
      dash: mainPath(NINE_DASH_LINE) ?? "",
      dashInset: insetPath(NINE_DASH_LINE) ?? "",
    };
  }, [world]);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      // left button or the wheel button drags; the wheel zooms
      .filter((e) => e.type === "wheel" || e.type.startsWith("touch") || e.button === 0 || e.button === 1)
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on("zoom", (e) => {
        d3.select(zoomLayerRef.current).attr("transform", e.transform.toString());
        setK(e.transform.k);
      });
    svg.call(zoom).on("dblclick.zoom", null);
    // holding the wheel button must not start the browser's auto-scroll
    svg.on("mousedown.mid", (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    });
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  // long-press opens the menu on touch screens
  const press = useRef<number | null>(null);
  const pressed = useRef(false);
  const regionProps = (r: RegionInfo) => ({
    onClick: () => {
      if (pressed.current) return;
      onClick(r.id);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onMenu(r.id, e.clientX, e.clientY);
    },
    onPointerDown: (e: React.PointerEvent) => {
      pressed.current = false;
      if (e.pointerType !== "touch") return;
      const { clientX, clientY } = e;
      press.current = window.setTimeout(() => {
        pressed.current = true;
        onMenu(r.id, clientX, clientY);
      }, 500);
    },
    onPointerUp: () => press.current && clearTimeout(press.current),
    onPointerLeave: () => {
      if (press.current) clearTimeout(press.current);
      setHover(null);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (press.current && e.pointerType === "touch") clearTimeout(press.current);
      if (e.pointerType === "mouse") {
        const box = svgRef.current!.getBoundingClientRect();
        setHover({ r, x: e.clientX - box.left, y: e.clientY - box.top });
      }
    },
    style: { cursor: "pointer" },
  });

  const fill = (id: string) => getStatusConfig(data[id] ?? "unvisited").color;
  const stroke = (id: string) => getStatusConfig(data[id] ?? "unvisited").borderColor;
  const s = 1 / k; // keeps strokes and labels the same size on screen while zooming

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none"
        style={{ background: "#eef5fb" }}
      >
        <defs>
          <clipPath id="cn-inset-clip">
            <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} />
          </clipPath>
        </defs>

        <g ref={zoomLayerRef}>
          {geo.neighbours.map((d, i) => (
            <path key={i} d={d} fill="#f6f7f8" stroke="#d5dbe1" strokeWidth={0.6 * s} />
          ))}
          {geo.regions.map(({ r, d }) => (
            <path
              key={r.id}
              d={d}
              fill={fill(r.id)}
              stroke={data[r.id] ? stroke(r.id) : "#9aa7b4"}
              strokeWidth={(hover?.r.id === r.id ? 1.6 : 0.7) * s}
              strokeLinejoin="round"
              {...regionProps(r)}
            />
          ))}
          <path d={geo.outline} fill="none" stroke="#334155" strokeWidth={1.3 * s} strokeLinejoin="round" pointerEvents="none" />
          <path d={geo.dash} fill="none" stroke="#334155" strokeWidth={1.6 * s} strokeLinecap="round" pointerEvents="none" />
          {(() => {
            const p = geo.main([DIAOYU[1], DIAOYU[2]]);
            return p ? (
              <g pointerEvents="none">
                <circle cx={p[0]} cy={p[1]} r={1.6 * s} fill="#334155" />
                <text x={p[0] + 4 * s} y={p[1] + 3 * s} fontSize={8.5 * s} fill="#475569">
                  {DIAOYU[0]}
                </text>
              </g>
            ) : null;
          })()}
          {geo.regions.map(({ r, label }) =>
            label ? (
              <text
                key={r.id}
                x={label[0]}
                y={label[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={(r.area < 20000 ? 8.5 : 11) * s}
                fontWeight={500}
                fill={getStatusConfig(data[r.id] ?? "unvisited").textColor}
                stroke="rgba(255,255,255,0.75)"
                strokeWidth={2.2 * s}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {shortName(r.name)}
              </text>
            ) : null
          )}
        </g>

        {/* South China Sea inset: stays put while the main map zooms */}
        <g>
          <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} fill="#eef5fb" />
          <g clipPath="url(#cn-inset-clip)">
            {geo.neighboursInset.map((d, i) => (
              <path key={i} d={d} fill="#f6f7f8" stroke="#d5dbe1" strokeWidth={0.5} />
            ))}
            {geo.regions.map(({ r, dInset }) => (
              <path
                key={r.id}
                d={dInset}
                fill={fill(r.id)}
                stroke={data[r.id] ? stroke(r.id) : "#9aa7b4"}
                strokeWidth={0.5}
                {...regionProps(r)}
              />
            ))}
            <path d={geo.outlineInset} fill="none" stroke="#334155" strokeWidth={0.8} pointerEvents="none" />
            <path d={geo.dashInset} fill="none" stroke="#334155" strokeWidth={1.4} strokeLinecap="round" pointerEvents="none" />
            {SEA_ISLANDS.map(([name, lon, lat]) => {
              const p = geo.inset([lon, lat])!;
              const hainan = data["CN-HI"];
              return (
                <g key={name} pointerEvents="none">
                  <circle cx={p[0]} cy={p[1]} r={1.5} fill={hainan ? stroke("CN-HI") : "#64748b"} />
                  <text x={p[0] + 4} y={p[1] + 2.5} fontSize={7} fill="#475569">
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
          <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} fill="none" stroke="#64748b" strokeWidth={0.8} />
          <text x={INSET.x + INSET.w / 2} y={INSET.y + INSET.h - 6} textAnchor="middle" fontSize={8.5} fill="#475569">
            南海诸岛
          </text>
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-white"
          style={{ left: hover.x + 14, top: hover.y + 14, background: "rgba(30,41,59,0.88)" }}
        >
          {hover.r.name} · {getStatusConfig(data[hover.r.id] ?? "unvisited").labelZh}
        </div>
      )}
    </div>
  );
}
