/**
 * WorldMap — the globe. MapLibre GL (WebGL) with a self-hosted shaded-relief
 * raster underneath and one polygon per first-level region on top; which regions
 * are lit is pushed in as feature-state so the geometry is never rebuilt.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import type { Feature } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FootprintData } from "@/lib/footprintData";
import { NINE_DASH_LINE } from "@/lib/nineDashLine";
import { REFERENCE_LINES } from "@/lib/referenceLines";
import type { WorldData } from "@/lib/worldData";
import { LIT, LIT_ORDER, MAP_CJK_FONT, OCEAN } from "@/lib/worldTheme";

export interface WorldMapHandle {
  flyTo(x: number, y: number, zoom: number): void;
  zoomBy(delta: number): void;
  resetNorth(): void;
  home(): void;
}

interface Props {
  world: WorldData;
  data: FootprintData;
  /** outline to draw: one region, or a whole country */
  selected: Feature | null;
  /** whether this country is lit province by province (otherwise as one piece) */
  isDetail(country: string): boolean;
  /** codes of the countries lit by province */
  detailCodes: string[];
  /** whole-country countries whose regions all share one status: [code, status] */
  wholeLit: [string, string][];
  /** px the left panel covers, so the globe is centred in what is left */
  leftInset: number;
  onPick(id: string | null): void;
  onBearing?(bearing: number): void;
}

const litState = ["coalesce", ["feature-state", "s"], ""] as ExpressionSpecification;
const flash = ["coalesce", ["feature-state", "f"], 0] as ExpressionSpecification;
const litColor = [
  "match",
  litState,
  ...LIT_ORDER.flatMap((s) => [s, LIT[s].color]),
  "#ffffff",
] as unknown as ExpressionSpecification;
const isLit = ["!=", litState, ""] as ExpressionSpecification;
const litOpacity = (base: number) =>
  [
    "case",
    isLit,
    ["+", base, ["*", 0.26, flash]],
    ["boolean", ["feature-state", "hover"], false],
    0.22,
    0,
  ] as ExpressionSpecification;

const OCEAN_LABELS = {
  type: "FeatureCollection" as const,
  features: (
    [
      ["太平洋", -150, 8],
      ["太平洋", 165, 22],
      ["大西洋", -38, 28],
      ["大西洋", -18, -22],
      ["印度洋", 78, -22],
      ["北冰洋", -150, 79],
      ["南大洋", 25, -60],
      ["南海", 114.5, 13.5],
    ] as const
  ).map(([name, x, y]) => ({
    type: "Feature" as const,
    properties: { name },
    geometry: { type: "Point" as const, coordinates: [x, y] },
  })),
};

/** below this zoom a whole-country country shows no internal borders */
const QUIET_ZOOM = 5;

/** from this zoom the elevation-based hillshade starts to take over */
const RELIEF_ZOOM = 5.2;

const pad = (left: number) => ({ left, top: 0, right: 0, bottom: 0 });

function countryMinZoom(rank: number): number {
  return Math.max(0.6, (rank - 2) * 0.72 + 0.9);
}
function regionMinZoom(area: number): number {
  if (area > 1e6) return 2.7;
  if (area > 3e5) return 3.3;
  if (area > 1e5) return 3.9;
  if (area > 3e4) return 4.6;
  if (area > 8e3) return 5.4;
  if (area > 1.5e3) return 6.3;
  return 7.2;
}

function buildStyle(world: WorldData): StyleSpecification {
  for (const f of world.countryLabels.features)
    f.properties!.minzoom = countryMinZoom(f.properties!.rank);
  for (const f of world.regionLabels.features)
    f.properties!.minzoom = regionMinZoom(f.properties!.area);

  return {
    version: 8,
    projection: { type: "globe" },
    glyphs: `${location.origin}/world/fonts/{fontstack}/{range}.pbf`,
    sky: {
      "sky-color": "#0b1530",
      "horizon-color": "#cfe6ff",
      "fog-color": "#ffffff",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.3,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.85, 6.5, 0],
    },
    light: { anchor: "viewport", position: [1.4, 210, 35], intensity: 0.4 },
    sources: {
      terrain: {
        type: "raster",
        tiles: [`${location.origin}/world/tiles/{z}/{x}/{y}.webp`],
        tileSize: 512,
        maxzoom: 6,
        attribution: "Natural Earth",
      },
      // Elevation, for relief that stays sharp when zoomed past what the painted
      // terrain holds. Public "Terrain Tiles" dataset on AWS Open Data.
      dem: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 12,
        attribution: "Terrain Tiles (Mapzen, AWS Open Data)",
      },
      regions: { type: "geojson", data: world.fills, promoteId: "rid", tolerance: 0.2, buffer: 4 },
      "country-borders": { type: "geojson", data: world.countryBorders, tolerance: 0.2 },
      "region-borders": { type: "geojson", data: world.regionBorders, tolerance: 0.2 },
      "country-labels": { type: "geojson", data: world.countryLabels },
      "region-labels": { type: "geojson", data: world.regionLabels },
      selected: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      "ocean-labels": { type: "geojson", data: OCEAN_LABELS },
      "nine-dash": { type: "geojson", data: NINE_DASH_LINE },
      "reference-lines": { type: "geojson", data: REFERENCE_LINES },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": OCEAN } },
      {
        id: "terrain",
        type: "raster",
        source: "terrain",
        paint: {
          "raster-saturation": 0.3,
          "raster-contrast": 0.1,
          "raster-resampling": "linear",
          "raster-fade-duration": 250,
        },
      },
      {
        // computed hillshade fades in as the painted relief runs out of detail
        id: "relief",
        type: "hillshade",
        source: "dem",
        minzoom: RELIEF_ZOOM,
        paint: {
          "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], RELIEF_ZOOM, 0, RELIEF_ZOOM + 1.5, 0.4, 10, 0.55],
          "hillshade-illumination-direction": 315,
          "hillshade-shadow-color": "rgba(52, 62, 58, 0.9)",
          "hillshade-highlight-color": "rgba(255, 255, 250, 0.7)",
          "hillshade-accent-color": "rgba(70, 80, 70, 0.5)",
        },
      },
      {
        id: "region-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": litColor,
          // zoom has to be the outermost expression: stronger from space, terrain shows through up close
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 1.5, litOpacity(0.74), 5, litOpacity(0.6), 8, litOpacity(0.5)],
          "fill-antialias": false,
        },
      },
      {
        // pale casing so the thin province lines stay readable over busy relief
        id: "region-borders-casing",
        type: "line",
        source: "region-borders",
        minzoom: 3,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0, 4.5, 0.35, 7, 0.5],
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 6, 2.6, 9, 3.6],
        },
      },
      {
        id: "region-borders",
        type: "line",
        source: "region-borders",
        minzoom: 2.2,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#55606c",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 2.2, 0, 3.4, 0.5, 6, 0.75],
          "line-width": ["interpolate", ["linear"], ["zoom"], 2.2, 0.35, 5, 0.8, 8, 1.3],
        },
      },
      {
        id: "country-borders",
        type: "line",
        source: "country-borders",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#3a4350",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.38, 3, 0.55, 7, 0.7],
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 3, 0.9, 6, 1.5, 9, 2.2],
        },
      },
      {
        id: "nine-dash-casing",
        type: "line",
        source: "nine-dash",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 4, 4, 8, 6.5],
        },
      },
      {
        id: "nine-dash",
        type: "line",
        source: "nine-dash",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#3a4350",
          "line-opacity": 0.85,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 4, 2, 8, 3.6],
        },
      },
      {
        // soft halo around lit regions
        id: "lit-glow",
        type: "line",
        source: "regions",
        layout: { "line-join": "round" },
        paint: {
          "line-color": litColor,
          "line-opacity": ["case", isLit, ["+", 0.5, ["*", 0.5, flash]], 0],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["+", 1.5, ["*", 5, flash]],
            6,
            ["+", 5, ["*", 10, flash]],
          ],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 6],
        },
      },
      {
        id: "lit-edge",
        type: "line",
        source: "regions",
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": ["case", isLit, 0.85, 0],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 4, 0.8, 8, 1.4],
        },
      },
      {
        id: "selected-shadow",
        type: "line",
        source: "selected",
        layout: { "line-join": "round" },
        paint: { "line-color": "#0b1220", "line-opacity": 0.35, "line-width": 7, "line-blur": 5 },
      },
      {
        id: "selected-line",
        type: "line",
        source: "selected",
        layout: { "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 2.4 },
      },
      {
        // equator and date line: thin white dashes
        id: "reference-lines",
        type: "line",
        source: "reference-lines",
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 1.3],
          "line-dasharray": [4, 3],
        },
      },
      {
        id: "reference-line-labels",
        type: "symbol",
        source: "reference-lines",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 520,
          "text-field": ["get", "name"],
          "text-font": ["sans-regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 12.5],
          "text-letter-spacing": 0.2,
          "text-offset": [0, -0.9],
          "text-keep-upright": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-opacity": 0.85,
          "text-halo-color": "rgba(30, 70, 110, 0.55)",
          "text-halo-width": 1.1,
        },
      },
      {
        id: "ocean-labels",
        type: "symbol",
        source: "ocean-labels",
        maxzoom: 6,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["sans-regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 12, 4, 17],
          "text-letter-spacing": 0.35,
        },
        paint: {
          "text-color": "#2a5f8c",
          "text-opacity": 0.6,
        },
      },
      {
        id: "region-labels",
        type: "symbol",
        source: "region-labels",
        minzoom: 2.6,
        filter: [">=", ["zoom"], ["get", "minzoom"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["sans-regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 7, 13.5],
          "text-max-width": 7,
          "text-padding": 6,
          "symbol-sort-key": ["-", 0, ["get", "area"]],
        },
        paint: {
          "text-color": "#4b5563",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.3,
          "text-halo-blur": 0.4,
        },
      },
      {
        id: "country-labels",
        type: "symbol",
        source: "country-labels",
        filter: [">=", ["zoom"], ["get", "minzoom"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["sans-medium"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["case", ["<=", ["get", "rank"], 2.5], 13, 11],
            5,
            ["case", ["<=", ["get", "rank"], 2.5], 19, 15],
            8,
            21,
          ],
          "text-letter-spacing": 0.04,
          "text-max-width": 8,
          "text-padding": 10,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": "#1f2430",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.6,
          "text-halo-blur": 0.5,
          // step back once the regions inside are the subject
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 1, 7.5, 0.55],
        },
      },
    ],
  };
}

/** Where to open: the centre of what is already lit, else a view of Eurasia. */
function initialCenter(world: WorldData, data: FootprintData): [number, number] {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (const id of Object.keys(data)) {
    const r = world.regions.get(id);
    if (!r) continue;
    // average on the sphere so regions either side of the antimeridian do not cancel out
    const lon = (r.x * Math.PI) / 180;
    const lat = (r.y * Math.PI) / 180;
    sx += Math.cos(lat) * Math.cos(lon);
    sy += Math.cos(lat) * Math.sin(lon);
    sz += Math.sin(lat);
    n++;
  }
  if (!n) return [60, 28];
  const lon = (Math.atan2(sy, sx) * 180) / Math.PI;
  const lat = (Math.atan2(sz, Math.hypot(sx, sy)) * 180) / Math.PI;
  return [lon, Math.max(-50, Math.min(55, lat))];
}

const WorldMap = forwardRef<WorldMapHandle, Props>(function WorldMap(
  { world, data, selected, isDetail, detailCodes, wholeLit, leftInset, onPick, onBearing },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const appliedRef = useRef<FootprintData>({});
  const dataRef = useRef(data);
  dataRef.current = data;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const isDetailRef = useRef(isDetail);
  isDetailRef.current = isDetail;
  const detailCodesRef = useRef(detailCodes);
  detailCodesRef.current = detailCodes;
  const wholeLitRef = useRef(wholeLit);
  wholeLitRef.current = wholeLit;
  const cb = useRef({ onPick, onBearing });
  cb.current = { onPick, onBearing };
  const insetRef = useRef(leftInset);
  insetRef.current = leftInset;
  const homeRef = useRef<{ center: [number, number]; zoom: number }>({ center: [60, 28], zoom: 1.8 });

  /** Push lit statuses into feature-state; newly changed regions flash. */
  const syncData = (animate: boolean) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const next = dataRef.current;
    const prev = appliedRef.current;
    const changed: string[] = [];
    for (const id of Object.keys(prev)) {
      if (!(id in next)) {
        map.removeFeatureState({ source: "regions", id }, "s");
        map.removeFeatureState({ source: "regions", id }, "f");
      }
    }
    for (const [id, s] of Object.entries(next)) {
      if (prev[id] === s) continue;
      map.setFeatureState({ source: "regions", id }, { s });
      changed.push(id);
    }
    appliedRef.current = next;
    if (!animate || !changed.length || changed.length > 400) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const f = (1 - t) ** 2;
      for (const id of changed) {
        if (appliedRef.current[id]) map.setFeatureState({ source: "regions", id }, { f });
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /**
   * Countries lit as one piece read as one shape: their internal borders and
   * province labels only come in once zoomed close, and a lit one is edged
   * around the whole country rather than around each province.
   */
  const syncDetail = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    // overseas territories are always handled on their own
    const byProvince = [
      "any",
      ["in", ["get", "c"], ["literal", detailCodesRef.current]],
      ["==", ["get", "t"], 1],
    ] as ExpressionSpecification;
    const asOnePiece = ["!", byProvince] as ExpressionSpecification;
    for (const id of ["region-borders", "region-borders-casing", "lit-glow", "lit-edge"])
      map.setFilter(id, byProvince);
    map.setFilter("region-borders-quiet", asOnePiece);
    map.setFilter("region-labels", [
      "all",
      [">=", ["zoom"], ["get", "minzoom"]],
      ["any", byProvince, [">=", ["zoom"], QUIET_ZOOM + 0.6]],
    ]);
  };

  const syncWholeLit = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("lit-countries") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: wholeLitRef.current.map(([code, s]) => ({
        ...world.countryOutline(code),
        properties: { s },
      })),
    });
  };

  const syncSelected = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const f = selectedRef.current;
    (map.getSource("selected") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: f ? [f] : [],
    });
  };

  useEffect(() => {
    const container = containerRef.current!;
    const center = initialCenter(world, dataRef.current);
    const narrow = container.clientWidth < 700;
    const zoom = narrow ? 1.25 : 2.15;
    homeRef.current = { center, zoom };

    const map = new maplibregl.Map({
      container,
      style: buildStyle(world),
      center: [center[0] - 75, Math.max(-20, center[1] - 25)],
      zoom: zoom - 0.9,
      minZoom: 0.7,
      maxZoom: 11,
      maxPitch: 60,
      attributionControl: { compact: true },
      localIdeographFontFamily: MAP_CJK_FONT,
      fadeDuration: 250,
    });
    mapRef.current = map;
    map.setPadding(pad(insetRef.current));
    map.touchZoomRotate.enableRotation();
    map.keyboard.enable();

    // what lights up under the pointer: one region, or every region of a whole-country country
    let hoveredKey: string | null = null;
    let hoveredIds: string[] = [];
    const setHover = (id: string | null) => {
      const r = id ? world.regions.get(id) : undefined;
      const whole = r && !r.standalone && !isDetailRef.current(r.c);
      const key = r ? (whole ? "c:" + r.c : r.id) : null;
      if (key === hoveredKey) return;
      for (const h of hoveredIds) map.setFeatureState({ source: "regions", id: h }, { hover: false });
      hoveredKey = key;
      hoveredIds = r ? (whole ? world.countries.get(r.c)!.mainland.map((x) => x.id) : [r.id]) : [];
      for (const h of hoveredIds) map.setFeatureState({ source: "regions", id: h }, { hover: true });
      map.getCanvas().style.cursor = id ? "pointer" : "";
    };
    const regionAt = (point: maplibregl.PointLike): string | null => {
      const f = map.queryRenderedFeatures(point, { layers: ["region-fill"] })[0];
      return (f?.properties?.rid as string) ?? null;
    };

    map.on("load", () => {
      readyRef.current = true;
      // internal borders of whole-country countries: absent from afar, faint up close
      map.addLayer(
        {
          id: "region-borders-quiet",
          type: "line",
          source: "region-borders",
          minzoom: QUIET_ZOOM,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#55606c",
            "line-opacity": ["interpolate", ["linear"], ["zoom"], QUIET_ZOOM, 0, QUIET_ZOOM + 1, 0.45],
            "line-width": ["interpolate", ["linear"], ["zoom"], QUIET_ZOOM, 0.5, 8, 1],
          },
        },
        "country-borders"
      );
      map.addSource("lit-countries", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      const litCountryColor = [
        "match",
        ["get", "s"],
        ...LIT_ORDER.flatMap((s) => [s, LIT[s].color]),
        "#ffffff",
      ] as unknown as ExpressionSpecification;
      map.addLayer(
        {
          id: "lit-country-glow",
          type: "line",
          source: "lit-countries",
          layout: { "line-join": "round" },
          paint: {
            "line-color": litCountryColor,
            "line-opacity": 0.5,
            "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.5, 6, 5],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 6],
          },
        },
        "selected-shadow"
      );
      map.addLayer(
        {
          id: "lit-country-edge",
          type: "line",
          source: "lit-countries",
          layout: { "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.85,
            "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 4, 0.8, 8, 1.4],
          },
        },
        "selected-shadow"
      );
      syncDetail();
      syncWholeLit();
      syncData(false);
      syncSelected();
      // arrive from space
      map.flyTo({
        center,
        zoom,
        duration: 3200,
        essential: true,
        curve: 1,
        easing: (t) => 1 - (1 - t) ** 3,
        padding: pad(insetRef.current),
      }, { intro: true });
    });

    map.on("mousemove", (e) => {
      const tip = tipRef.current!;
      const id = map.isMoving() ? null : regionAt(e.point);
      setHover(id);
      const r = id ? world.regions.get(id) : null;
      if (!r) {
        tip.style.opacity = "0";
        return;
      }
      const country = world.countries.get(r.c)!;
      tip.textContent = !r.standalone && !isDetailRef.current(r.c)
        ? country.name
        : country.regions.length > 1
          ? `${r.name} · ${country.name}`
          : r.name;
      tip.style.opacity = "1";
      tip.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 16}px)`;
    });
    // Until the first touch the globe drifts slowly eastward, so the page is alive on arrival.
    let drifting = false;
    let last = 0;
    const stopDrift = () => {
      drifting = false;
    };
    const drift = (now: number) => {
      if (!drifting || !mapRef.current) return;
      const dt = Math.min(64, now - last);
      last = now;
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng + dt * 0.0022, c.lat] });
      if (now - driftStart < 90_000) requestAnimationFrame(drift);
    };
    let driftStart = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.on("moveend", (e: maplibregl.MapLibreEvent & { intro?: boolean }) => {
      if (!e.intro || stopped || reduceMotion) return;
      drifting = true;
      driftStart = last = performance.now();
      requestAnimationFrame(drift);
    });
    let stopped = false;
    const onFirstInput = () => {
      stopped = true;
      stopDrift();
    };
    for (const ev of ["pointerdown", "wheel", "keydown", "touchstart"])
      window.addEventListener(ev, onFirstInput, { once: true, passive: true });

    map.on("mouseout", () => {
      setHover(null);
      tipRef.current!.style.opacity = "0";
    });
    map.on("movestart", () => {
      tipRef.current!.style.opacity = "0";
    });
    map.on("click", (e) => {
      // the second click of a double-click zooms; it must not pick again
      if ((e.originalEvent as MouseEvent).detail > 1) return;
      cb.current.onPick(regionAt(e.point));
    });
    map.on("rotate", () => cb.current.onBearing?.(map.getBearing()));

    // Holding the wheel (middle button) drags the map, like the left button does.
    const canvas = map.getCanvasContainer();
    let mid: { x: number; y: number } | null = null;
    const midDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault(); // no browser auto-scroll cursor
      map.stop();
      mid = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };
    const midMove = (e: MouseEvent) => {
      if (!mid) return;
      map.panBy([mid.x - e.clientX, mid.y - e.clientY], { animate: false });
      mid = { x: e.clientX, y: e.clientY };
    };
    const midUp = () => {
      if (!mid) return;
      mid = null;
      canvas.style.cursor = "";
    };
    canvas.addEventListener("mousedown", midDown);
    window.addEventListener("mousemove", midMove);
    window.addEventListener("mouseup", midUp);
    map.once("remove", () => {
      window.removeEventListener("mousemove", midMove);
      window.removeEventListener("mouseup", midUp);
    });
    map.on("error", (e) => console.error("[world map]", e.error?.message ?? e));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    return () => {
      ro.disconnect();
      onFirstInput();
      readyRef.current = false;
      appliedRef.current = {};
      mapRef.current = null;
      map.remove();
    };
  }, [world]);

  useEffect(() => syncData(true), [data]);
  useEffect(() => syncSelected(), [selected]);
  useEffect(() => syncDetail(), [detailCodes]);
  useEffect(() => syncWholeLit(), [wholeLit]);
  useEffect(() => {
    mapRef.current?.easeTo({ padding: pad(leftInset), duration: 450 });
  }, [leftInset]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(x, y, zoom) {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({
          center: [x, y],
          zoom,
          bearing: 0,
          pitch: 0,
          duration: 1800,
          curve: 1.3,
          essential: true,
          padding: pad(insetRef.current),
        });
      },
      zoomBy(delta) {
        const map = mapRef.current;
        map?.easeTo({ zoom: map.getZoom() + delta, duration: 350 });
      },
      resetNorth() {
        mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
      },
      home() {
        const { center, zoom } = homeRef.current;
        mapRef.current?.flyTo({ center, zoom, bearing: 0, pitch: 0, duration: 1600, essential: true });
      },
    }),
    []
  );

  return (
    <div className="absolute inset-0">
      {/* inline: maplibre-gl.css sets position: relative on its container */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={tipRef} className="world-tip" />
    </div>
  );
});

export default WorldMap;
