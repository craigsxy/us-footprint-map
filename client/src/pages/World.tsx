/**
 * World — the globe page. Every country at first-level (state / province) detail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Globe2, Minus, Navigation, Plus, RotateCcw } from "lucide-react";
import BackupMenu from "@/components/BackupMenu";
import ModeSwitch from "@/components/world/ModeSwitch";
import PlaceCard from "@/components/world/PlaceCard";
import Starfield from "@/components/world/Starfield";
import WorldMap, { type WorldMapHandle } from "@/components/world/WorldMap";
import WorldPanel, { computeStats, countryState } from "@/components/world/WorldPanel";
import "@/components/world/world.css";
import { ALWAYS_DETAIL, useDetailSettings } from "@/hooks/useDetailSettings";
import { useFootprintStore } from "@/hooks/useFootprint";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { FootprintStatus } from "@/lib/footprintData";
import { loadWorld, zoomForArea, type CountryInfo, type RegionInfo, type WorldData } from "@/lib/worldData";
import { LIT, LIT_ORDER, UI_FONT, type LitStatus } from "@/lib/worldTheme";

const PANEL_WIDTH = 364;

export default function World() {
  const { all, setOne, setMany, replaceAll } = useFootprintStore();
  const [world, setWorld] = useState<WorldData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detail = useDetailSettings();
  /** null = tapping a region opens its card; otherwise tapping paints this status */
  const [brush, setBrush] = useState<LitStatus | null>(null);
  const [bearing, setBearing] = useState(0);
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [panelOpen, setPanelOpen] = useState(isLg);
  const mapRef = useRef<WorldMapHandle>(null);

  const load = useCallback(() => {
    setLoadError(false);
    loadWorld().then(setWorld, () => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const prev = document.title;
    document.title = "足迹 · 世界";
    return () => {
      document.title = prev;
    };
  }, []);

  const { isDetail } = detail;
  const stats = useMemo(
    () => (world ? computeStats(world, all, isDetail) : null),
    [world, all, isDetail]
  );

  // what is selected: one region, or a whole country ("c:CODE") where the country is lit as one piece
  const selectedCountry =
    world && selectedKey
      ? world.countries.get(selectedKey.startsWith("c:") ? selectedKey.slice(2) : world.regions.get(selectedKey)?.c ?? "")
      : undefined;
  const selectedRegion =
    world && selectedKey && !selectedKey.startsWith("c:") ? world.regions.get(selectedKey) : undefined;
  const selectedFeature = useMemo(() => {
    if (!world || !selectedKey) return null;
    return selectedKey.startsWith("c:")
      ? world.countryOutline(selectedKey.slice(2))
      : world.features.get(selectedKey) ?? null;
  }, [world, selectedKey]);

  const detailCodes = useMemo(
    () => (world ? world.countryList.filter((c) => isDetail(c.code)).map((c) => c.code) : []),
    [world, isDetail]
  );
  // whole-country countries that are fully lit in one status get a single outline
  const wholeLit = useMemo(() => {
    const out: [string, string][] = [];
    if (!world || !stats) return out;
    for (const code of Array.from(stats.perCountry.keys())) {
      if (isDetail(code)) continue;
      const s = countryState(world.countries.get(code)!, all).uniform;
      if (s !== "unvisited") out.push([code, s]);
    }
    return out;
  }, [world, stats, all, isDetail]);

  /** The selection key a region stands for under the current settings. */
  const keyFor = useCallback(
    (r: RegionInfo) => (isDetail(r.c) || r.standalone ? r.id : "c:" + r.c),
    [isDetail]
  );

  const stateRef = useRef({ all, brush, world, keyFor });
  stateRef.current = { all, brush, world, keyFor };

  const handlePick = useCallback(
    (id: string | null) => {
      const { all, brush, world, keyFor } = stateRef.current;
      const r = id && world ? world.regions.get(id) : undefined;
      if (!r || !world) {
        setSelectedKey(null);
        return;
      }
      const key = keyFor(r);
      if (brush) {
        if (key === r.id) {
          setOne(r.id, all[r.id] === brush ? "unvisited" : brush);
        } else {
          const country = world.countries.get(r.c)!;
          const on = countryState(country, all).uniform === brush;
          setMany(
            country.mainland.map((x) => x.id),
            on ? "unvisited" : brush
          );
        }
        return;
      }
      setSelectedKey(key);
      if (!isLg) setPanelOpen(false);
    },
    [setOne, setMany, isLg]
  );

  const flyToRegion = useCallback(
    (r: RegionInfo) => {
      setSelectedKey(r.id);
      // leave some of the neighbours in view; a lone island needs more of them to be placeable
      mapRef.current?.flyTo(r.x, r.y, Math.min(r.standalone ? 5.5 : 7.5, zoomForArea(r.area) + 0.3));
      if (!isLg) setPanelOpen(false);
    },
    [isLg]
  );

  const flyToCountry = useCallback(
    (c: CountryInfo) => {
      if (c.regions.length === 1) {
        flyToRegion(c.regions[0]);
        return;
      }
      // a country lit as one piece is selected whole; otherwise just go there
      setSelectedKey(isDetail(c.code) ? null : "c:" + c.code);
      mapRef.current?.flyTo(c.x, c.y, Math.min(7, zoomForArea(c.area) + 0.7));
      if (!isLg) setPanelOpen(false);
    },
    [flyToRegion, isDetail, isLg]
  );

  /** Set every mainland region of the selected country (overseas territories are left alone). Asks first when that would overwrite a mix of marks. */
  const setCountry = useCallback(
    (status: FootprintStatus, confirmAlways: boolean) => {
      if (!selectedCountry) return;
      const n = selectedCountry.mainland.length;
      const state = countryState(selectedCountry, all);
      const mixed = state.lit > 0 && state.uniform === "unvisited";
      if (confirmAlways || mixed) {
        const what =
          status === "unvisited"
            ? `清除${selectedCountry.name}全部 ${n} 个地区的标记？`
            : `把${selectedCountry.name}全部 ${n} 个地区标为“${LIT[status].label}”？已有的标记会被覆盖。`;
        if (!window.confirm(what)) return;
      }
      setMany(
        selectedCountry.mainland.map((r) => r.id),
        status
      );
    },
    [selectedCountry, all, setMany]
  );

  /** Switch the selected country between by-province and whole-country, keeping it selected. */
  const switchDetail = useCallback(
    (on: boolean) => {
      if (!selectedCountry) return;
      detail.setCountry(selectedCountry.code, on);
      setSelectedKey(on ? null : "c:" + selectedCountry.code);
    },
    [selectedCountry, detail]
  );

  // a setting changed under the selection (e.g. the all-countries switch): re-point it
  useEffect(() => {
    if (!world || !selectedKey) return;
    if (selectedKey.startsWith("c:")) {
      if (isDetail(selectedKey.slice(2))) setSelectedKey(null);
    } else {
      const r = world.regions.get(selectedKey);
      if (r && !r.standalone && !isDetail(r.c)) setSelectedKey("c:" + r.c);
    }
  }, [world, selectedKey, isDetail]);

  const handleReset = useCallback(() => {
    if (window.confirm("清空全部足迹记录？这个操作不能撤销。")) {
      replaceAll({});
      setSelectedKey(null);
    }
  }, [replaceAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const leftInset = isLg && panelOpen ? PANEL_WIDTH + 16 : 0;

  return (
    <div className="world-root" style={{ fontFamily: UI_FONT }}>
      <Starfield />

      {world && (
        <div className="world-fade absolute inset-0">
          <WorldMap
            ref={mapRef}
            world={world}
            data={all}
            selected={selectedFeature}
            isDetail={isDetail}
            detailCodes={detailCodes}
            wholeLit={wholeLit}
            leftInset={leftInset}
            onPick={handlePick}
            onBearing={setBearing}
          />
        </div>
      )}

      {!world && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          {loadError ? (
            <>
              <p className="text-[15px]">地图数据没有加载成功</p>
              <button onClick={load} className="rounded-full bg-white/15 px-4 py-1.5 text-[14px] text-white">
                重试
              </button>
            </>
          ) : (
            <>
              <Globe2 size={28} className="animate-pulse" />
              <p className="text-[13px] tracking-wide">正在载入地球…</p>
            </>
          )}
        </div>
      )}

      {/* panel: left column on desktop, top sheet on phones */}
      <aside
        className={`glass absolute z-20 flex flex-col ${panelOpen ? "overflow-hidden" : ""}`}
        style={
          isLg
            ? {
                left: 16,
                top: 16,
                width: PANEL_WIDTH,
                maxHeight: "calc(100% - 32px)",
                height: panelOpen ? "calc(100% - 32px)" : undefined,
                borderRadius: 22,
              }
            : {
                left: 10,
                right: 10,
                top: "max(10px, env(safe-area-inset-top))",
                maxHeight: panelOpen ? "68%" : undefined,
                height: panelOpen ? "68%" : undefined,
                borderRadius: 20,
              }
        }
      >
        <div className="flex flex-shrink-0 items-center gap-1.5 px-4 pb-3 pt-3.5">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={panelOpen}
          >
            <h1 className="flex-shrink-0 whitespace-nowrap text-[19px] font-bold tracking-[-0.01em]">世界足迹</h1>
            {stats && !panelOpen && (
              <span className="hidden truncate text-[13px] text-[#6e6e73] tabular-nums min-[420px]:inline">
                {stats.countries} 国 · {stats.regions} 地区
              </span>
            )}
            <ChevronDown
              size={16}
              color="#8e8e93"
              style={{ transform: panelOpen ? "rotate(180deg)" : undefined, transition: "transform 0.25s" }}
            />
          </button>
          {[
            ["/cn", "中国地图"],
            ["/us", "美国地图"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-medium"
              style={{ color: "#007aff", background: "rgba(0,122,255,0.1)" }}
            >
              {label}
            </Link>
          ))}
          <BackupMenu data={all} replaceAll={replaceAll} />
          <button
            onClick={handleReset}
            title="清空全部记录"
            aria-label="清空全部记录"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            style={{ border: "1px solid #e5e7eb" }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
        {panelOpen && world && stats && (
          <WorldPanel
            world={world}
            data={all}
            stats={stats}
            selectedKey={selectedKey}
            detail={detail}
            flyOnExpand={isLg}
            onCountry={flyToCountry}
            onRegion={flyToRegion}
          />
        )}
      </aside>

      {/* map controls */}
      <div
        className="absolute right-3 z-10 flex flex-col gap-2.5 lg:right-4"
        style={{ bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 76px)" }}
      >
        {Math.abs(bearing) > 0.5 && (
          <div className="glass-thin overflow-hidden rounded-[14px]">
            <button className="world-btn" onClick={() => mapRef.current?.resetNorth()} title="朝北" aria-label="朝北">
              <Navigation size={17} style={{ transform: `rotate(${-bearing - 45}deg)` }} />
            </button>
          </div>
        )}
        <div className="glass-thin overflow-hidden rounded-[14px]">
          <button className="world-btn" onClick={() => mapRef.current?.home()} title="回到全球" aria-label="回到全球">
            <Globe2 size={18} />
          </button>
        </div>
        <div className="glass-thin hidden overflow-hidden rounded-[14px] lg:block">
          <button className="world-btn" onClick={() => mapRef.current?.zoomBy(1)} title="放大" aria-label="放大">
            <Plus size={18} />
          </button>
          <button className="world-btn" onClick={() => mapRef.current?.zoomBy(-1)} title="缩小" aria-label="缩小">
            <Minus size={18} />
          </button>
        </div>
      </div>

      {/* bottom: place card over the mode switch */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-2.5 px-3"
        style={{
          bottom: "max(16px, env(safe-area-inset-bottom))",
          paddingLeft: leftInset ? leftInset + 12 : undefined,
        }}
      >
        {selectedCountry && stats && (
          <div className="pointer-events-auto w-full max-w-[400px]">
            <PlaceCard
              key={selectedKey}
              region={selectedRegion ?? null}
              country={selectedCountry}
              status={
                selectedRegion
                  ? all[selectedRegion.id] ?? "unvisited"
                  : countryState(selectedCountry, all).uniform
              }
              countryLit={stats.perCountry.get(selectedCountry.code) ?? 0}
              onItsOwn={!!selectedRegion?.standalone && !isDetail(selectedCountry.code)}
              canSwitchDetail={!ALWAYS_DETAIL.has(selectedCountry.code) && !detail.all}
              onSet={(s) => (selectedRegion ? setOne(selectedRegion.id, s) : setCountry(s, false))}
              onSetCountry={(s) => setCountry(s, true)}
              onSwitchDetail={switchDetail}
              onClose={() => setSelectedKey(null)}
            />
          </div>
        )}

        <ModeSwitch
          value={brush}
          onChange={(v) => {
            setBrush(v);
            if (v) setSelectedKey(null);
          }}
        />
        {brush && (
          <p className="world-rise glass-dark pointer-events-none -mt-1 rounded-full px-3 py-1 text-[12px] text-white">
            连点模式：点一下直接标为“{LIT[brush].label}”，再点一次取消
          </p>
        )}
      </div>
    </div>
  );
}
