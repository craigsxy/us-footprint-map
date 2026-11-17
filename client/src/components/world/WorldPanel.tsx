/**
 * WorldPanel — search, totals, the list of places already lit, and (tucked at
 * the bottom) which countries are lit province by province.
 */
import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import type { FootprintData, FootprintStatus } from "@/lib/footprintData";
import { ALWAYS_DETAIL } from "@/hooks/useDetailSettings";
import {
  CONTINENT_NAMES,
  CONTINENT_ORDER,
  type Continent,
  type CountryInfo,
  type RegionInfo,
  type WorldData,
} from "@/lib/worldData";
import { LIT, LIT_ORDER, type LitStatus } from "@/lib/worldTheme";

export interface WorldStats {
  countries: number;
  /** lit regions, counted only in countries lit by province */
  regions: number;
  regionsTotal: number;
  /** share of the world's land (without Antarctica) that is lit, 0..1 */
  areaShare: number;
  /** places per level: a region in by-province countries, the country itself elsewhere */
  byStatus: Record<LitStatus, number>;
  perCountry: Map<string, number>;
  byContinent: Record<Continent, { lit: number; total: number }>;
}

/**
 * How a country's mainland stands as a whole: how many of its regions are lit, and
 * the status they all share, if they do. Overseas territories are left out; they
 * are always lit on their own.
 */
export function countryState(
  c: CountryInfo,
  data: FootprintData
): { lit: number; uniform: FootprintStatus; main: LitStatus | null } {
  const counts: Partial<Record<LitStatus, number>> = {};
  let lit = 0;
  for (const r of c.mainland) {
    const s = data[r.id];
    if (!s || s === "unvisited") continue;
    lit++;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  let main: LitStatus | null = null;
  for (const s of LIT_ORDER) if (counts[s] && (!main || counts[s]! > counts[main]!)) main = s;
  const uniform = main && counts[main] === c.mainland.length ? main : "unvisited";
  return { lit, uniform, main };
}

export function computeStats(
  world: WorldData,
  data: FootprintData,
  isDetail: (code: string) => boolean
): WorldStats {
  const byStatus = { transit: 0, trip: 0, longstay: 0 } as Record<LitStatus, number>;
  const perCountry = new Map<string, number>();
  const byContinent = Object.fromEntries(
    CONTINENT_ORDER.map((k) => [k, { lit: 0, total: 0 }])
  ) as WorldStats["byContinent"];
  let regions = 0;
  let regionsTotal = 0;
  let area = 0;
  for (const c of world.countryList) {
    const detail = isDetail(c.code);
    if (detail) regionsTotal += c.regions.length;
    byContinent[c.continent].total++;
    let lit = 0;
    for (const r of c.regions) {
      const s = data[r.id];
      if (!s || s === "unvisited") continue;
      lit++;
      if (c.code !== "ATA") area += r.area;
      if (detail) regions++;
      // one place each: a region, an overseas territory, or (below) a whole mainland
      if (detail || r.standalone) byStatus[s]++;
    }
    if (!lit) continue;
    perCountry.set(c.code, lit);
    byContinent[c.continent].lit++;
    if (!detail) {
      const main = countryState(c, data).main;
      if (main) byStatus[main]++;
    }
  }
  return {
    countries: perCountry.size,
    regions,
    regionsTotal,
    areaShare: area / world.landArea,
    byStatus,
    perCountry,
    byContinent,
  };
}

export interface DetailControls {
  all: boolean;
  countries: string[];
  isDetail(code: string): boolean;
  setAll(on: boolean): void;
  setCountry(code: string, on: boolean): void;
}

interface Props {
  world: WorldData;
  data: FootprintData;
  stats: WorldStats;
  /** region id, or "c:CODE" for a whole country */
  selectedKey: string | null;
  detail: DetailControls;
  /** whether opening a country in the list also flies the map there (not when the panel covers the map) */
  flyOnExpand: boolean;
  onCountry(c: CountryInfo): void;
  onRegion(r: RegionInfo): void;
}

function Ring({ share }: { share: number }) {
  const r = 26;
  const len = 2 * Math.PI * r;
  // a sliver of progress should still be visible
  const shown = share > 0 ? Math.max(share, 0.012) : 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0">
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LIT.trip.color} />
          <stop offset="1" stopColor={LIT.longstay.color} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${len * shown} ${len}`}
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.2,0.9,0.25,1)" }}
      />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="#1d1d1f"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {share >= 0.1 ? Math.round(share * 100) : (share * 100).toFixed(1)}%
      </text>
    </svg>
  );
}

function StatusDot({ status, size = 8 }: { status?: string | null; size?: number }) {
  const color = status && status in LIT ? LIT[status as LitStatus].color : "rgba(0,0,0,0.14)";
  return (
    <span
      className="inline-block flex-shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

/** Small switch, sized for a settings row. */
function Switch({ on, onChange, label }: { on: boolean; onChange(on: boolean): void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors duration-200"
      style={{ background: on ? "#34c759" : "rgba(120,120,128,0.28)" }}
    >
      <span
        className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-all duration-200"
        style={{ left: on ? 18 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
      />
    </button>
  );
}

/** Which countries are lit province by province. Collapsed by default: few people need it. */
function DetailSettings({ world, detail }: { world: WorldData; detail: DetailControls }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? world.countryList
        .filter(
          (c) =>
            c.regions.length > 1 &&
            !ALWAYS_DETAIL.has(c.code) &&
            !detail.countries.includes(c.code) &&
            (c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q))
        )
        .slice(0, 5)
    : [];
  const summary = detail.all
    ? "所有国家"
    : detail.countries.length
      ? `中国、美国和另外 ${detail.countries.length} 个`
      : "仅中国、美国";

  return (
    <div className="mx-3 mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-[12px] text-[#6e6e73]"
      >
        <ChevronRight
          size={12}
          style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.2s" }}
        />
        <span>按省份点亮：{summary}</span>
      </button>
      {open && (
        <div className="mt-1.5 rounded-2xl bg-white/55 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px]">所有国家都按省份点亮</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-[#6e6e73]">
                关闭时，中美以外的国家点一下就整个点亮
              </div>
            </div>
            <Switch on={detail.all} onChange={detail.setAll} label="所有国家都按省份点亮" />
          </div>

          {!detail.all && (
            <div className="mt-3 border-t border-black/[0.07] pt-3">
              <div className="text-[12px] text-[#6e6e73]">只给个别国家开启</div>
              {detail.countries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.countries.map((code) => {
                    const c = world.countries.get(code);
                    if (!c) return null;
                    return (
                      <span
                        key={code}
                        className="flex items-center gap-1 rounded-full bg-black/[0.06] py-1 pl-2.5 pr-1.5 text-[12px]"
                      >
                        {c.name}
                        <button
                          onClick={() => detail.setCountry(code, false)}
                          aria-label={`${c.name}改回整国点亮`}
                          className="rounded-full p-0.5 text-[#6e6e73] hover:bg-black/10 hover:text-black"
                        >
                          <X size={11} strokeWidth={2.5} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入国家名添加"
                className="mt-2 h-8 w-full rounded-lg bg-black/[0.05] px-2.5 text-[13px] outline-none placeholder:text-[#aeaeb2]"
                style={{ userSelect: "text", WebkitUserSelect: "text" }}
              />
              {matches.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    detail.setCountry(c.code, true);
                    setQuery("");
                  }}
                  className="world-row mt-1 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px]"
                >
                  <span>{c.name}</span>
                  <span className="text-[11.5px] text-[#6e6e73]">{c.regions.length} 个地区</span>
                </button>
              ))}
              {q && matches.length === 0 && (
                <p className="mt-2 px-1 text-[12px] text-[#aeaeb2]">没有可添加的国家</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorldPanel({
  world,
  data,
  stats,
  selectedKey,
  detail,
  flyOnExpand,
  onCountry,
  onRegion,
}: Props) {
  const [query, setQuery] = useState("");
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const { isDetail } = detail;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hit = (name: string, en: string) => name.toLowerCase().includes(q) || en.toLowerCase().includes(q);
    const countries = world.countryList.filter((c) => hit(c.name, c.nameEn)).slice(0, 8);
    const regions: RegionInfo[] = [];
    for (const r of Array.from(world.regions.values())) {
      // regions are on offer where the country is lit by province; overseas territories always
      if ((isDetail(r.c) || r.standalone) && world.countries.get(r.c)!.regions.length > 1 && hit(r.name, r.nameEn))
        regions.push(r);
    }
    const rank = (r: RegionInfo) =>
      (r.name.toLowerCase().startsWith(q) || r.nameEn.toLowerCase().startsWith(q) ? 0 : 1e9) - r.area;
    regions.sort((a, b) => rank(a) - rank(b));
    return { countries, regions: regions.slice(0, 40) };
  }, [query, world, isDetail]);

  /** Countries whose row opens into a list: lit by province, or with overseas territories. */
  const canExpand = (c: CountryInfo) =>
    c.regions.length > 1 && (isDetail(c.code) || c.regions.some((r) => r.standalone));
  const pinned = (c: CountryInfo) => (c.code === "CHN" ? 0 : c.code === "USA" ? 1 : 2);
  /** 0 = 长住, 1 = 短途, 2 = 路过, 3 = not lit */
  const level = (id: string) => {
    const i = LIT_ORDER.indexOf(data[id] as LitStatus);
    return i < 0 ? 3 : LIT_ORDER.length - 1 - i;
  };
  const best = (regions: RegionInfo[]) => Math.min(3, ...regions.map((r) => level(r.id)));

  const visited = useMemo(
    () =>
      world.countryList
        .filter((c) => stats.perCountry.has(c.code))
        // China, then the U.S.; then countries that open into a list; within each
        // group by how well you know them (长住 > 短途 > 路过), then by pinyin
        .sort(
          (a, b) =>
            pinned(a) - pinned(b) ||
            Number(canExpand(b)) - Number(canExpand(a)) ||
            best(a.regions) - best(b.regions) ||
            a.name.localeCompare(b.name, "zh-Hans-CN")
        ),
    [world, stats, data, isDetail]
  );

  const regionChips = (c: CountryInfo) => (
    <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
      {(isDetail(c.code) ? c.regions : c.regions.filter((r) => r.standalone))
        .slice()
        .sort((a, b) => level(a.id) - level(b.id) || a.name.localeCompare(b.name, "zh-Hans-CN"))
        .map((r) => (
        <button
          key={r.id}
          onClick={() => onRegion(r)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors"
          style={{
            background: r.id === selectedKey ? "#1d1d1f" : "rgba(0,0,0,0.055)",
            color: r.id === selectedKey ? "#fff" : "#3a3a3c",
          }}
        >
          <StatusDot status={data[r.id]} size={7} />
          {r.name}
        </button>
      ))}
    </div>
  );

  /** right-hand side of a country row: progress by province, or just its level */
  const countryMeta = (c: CountryInfo) => {
    const lit = stats.perCountry.get(c.code) ?? 0;
    const total = c.regions.length;
    if (isDetail(c.code) && total > 1)
      return (
        <>
          <div className="h-[5px] w-16 overflow-hidden rounded-full bg-black/[0.07]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(lit / total) * 100}%`, background: LIT.trip.color }}
            />
          </div>
          <span className="w-11 text-right text-[12px] text-[#6e6e73] tabular-nums">
            {lit}/{total}
          </span>
        </>
      );
    if (!lit) return null;
    const state = countryState(c, data);
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
        <StatusDot status={state.main ?? c.regions.map((r) => data[r.id]).find(Boolean)} />
        {state.uniform !== "unvisited" ? LIT[state.uniform].label : state.lit ? `部分 ${lit}/${total}` : `仅海外属地 ${lit}`}
      </span>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* search */}
      <div className="px-3 pb-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ background: "rgba(118,118,128,0.14)", height: 38 }}
        >
          <Search size={15} color="#6e6e73" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索国家、省、州"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#6e6e73]"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="清除搜索">
              <X size={15} color="#6e6e73" />
            </button>
          )}
        </div>
      </div>

      <div className="world-scroll min-h-0 flex-1">
        {results ? (
          <div className="pb-3">
            {results.countries.length + results.regions.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-[#6e6e73]">
                没有找到“{query.trim()}”
              </p>
            )}
            {results.countries.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setQuery("");
                  onCountry(c);
                }}
                className="world-row flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{c.name}</div>
                  <div className="truncate text-[12px] text-[#6e6e73]">{c.nameEn}</div>
                </div>
                {countryMeta(c)}
              </button>
            ))}
            {results.regions.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setQuery("");
                  onRegion(r);
                }}
                className="world-row flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <StatusDot status={data[r.id]} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{r.name}</div>
                  <div className="truncate text-[12px] text-[#6e6e73]">
                    {world.countries.get(r.c)!.name} · {r.nameEn}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="pb-4">
            {/* totals */}
            <div className="mx-3 flex items-center gap-4 rounded-2xl bg-white/55 px-4 py-3.5">
              <Ring share={stats.areaShare} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold leading-none tabular-nums">
                    {stats.countries}
                  </span>
                  <span className="text-[13px] text-[#6e6e73]">
                    / {world.countries.size} 国家和地区
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[17px] font-semibold leading-none tabular-nums">
                    {stats.regions}
                  </span>
                  <span className="text-[13px] text-[#6e6e73]">/ {stats.regionsTotal} 省级地区</span>
                </div>
                <div className="mt-1.5 text-[11.5px] text-[#6e6e73]">圆环：点亮的陆地面积占比</div>
              </div>
            </div>

            {/* by level */}
            <div className="mx-3 mt-2 grid grid-cols-3 gap-2">
              {LIT_ORDER.map((s) => (
                <div key={s} className="rounded-xl bg-white/55 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
                    <StatusDot status={s} />
                    {LIT[s].label}
                  </div>
                  <div className="mt-0.5 text-[18px] font-semibold tabular-nums">{stats.byStatus[s]}</div>
                </div>
              ))}
            </div>

            {/* by continent */}
            <div className="mx-3 mt-2 rounded-2xl bg-white/55 px-4 py-3">
              {CONTINENT_ORDER.map((k) => {
                const { lit, total } = stats.byContinent[k];
                return (
                  <div key={k} className="flex items-center gap-3 py-[5px]">
                    <span className="w-14 text-[13px]">{CONTINENT_NAMES[k]}</span>
                    <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(lit / total) * 100}%`,
                          background: `linear-gradient(90deg, ${LIT.trip.color}, ${LIT.longstay.color})`,
                          transition: "width 0.5s cubic-bezier(0.2,0.9,0.25,1)",
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-[12px] text-[#6e6e73] tabular-nums">
                      {lit}/{total}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* visited list */}
            <div className="mt-4 px-4 text-[12px] font-medium text-[#6e6e73]">去过的地方</div>
            {visited.length === 0 ? (
              <p className="px-4 py-6 text-[13px] leading-relaxed text-[#6e6e73]">
                还没有点亮任何地方。在地球上点一个国家，或者先在上面搜索。
              </p>
            ) : (
              <div className="mx-3 mt-1.5 overflow-hidden rounded-2xl bg-white/55">
                {visited.map((c, i) => {
                  const expandable = canExpand(c);
                  const open = expandable && openCountry === c.code;
                  return (
                    <div key={c.code} style={{ borderTop: i ? "0.5px solid rgba(0,0,0,0.08)" : undefined }}>
                      <button
                        onClick={() => {
                          if (expandable) setOpenCountry(open ? null : c.code);
                          // on a phone the panel covers the map: opening a row just opens it
                          if (!open && (flyOnExpand || !expandable)) onCountry(c);
                        }}
                        className="world-row flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <ChevronRight
                          size={14}
                          color="#aeaeb2"
                          style={{
                            transform: open ? "rotate(90deg)" : undefined,
                            transition: "transform 0.2s",
                            visibility: expandable ? "visible" : "hidden",
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[14.5px]">{c.name}</span>
                        {countryMeta(c)}
                      </button>
                      {open && regionChips(c)}
                    </div>
                  );
                })}
              </div>
            )}

            <DetailSettings world={world} detail={detail} />
          </div>
        )}
      </div>
    </div>
  );
}
