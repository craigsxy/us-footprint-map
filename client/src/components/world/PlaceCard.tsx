/**
 * PlaceCard — what is selected and how well you know it. Either one region, or
 * a whole country for countries that are lit as one piece.
 */
import { Check, X } from "lucide-react";
import type { FootprintStatus } from "@/lib/footprintData";
import type { CountryInfo, RegionInfo } from "@/lib/worldData";
import { LIT, LIT_ORDER } from "@/lib/worldTheme";

interface Props {
  /** the region, or null when the whole country is selected */
  region: RegionInfo | null;
  country: CountryInfo;
  /** status of the region; for a whole country, the status all its regions share ("unvisited" if none or mixed) */
  status: FootprintStatus;
  /** how many of the country's regions are lit */
  countryLit: number;
  /** an overseas territory of a country lit as one piece: nothing country-wide to offer */
  onItsOwn: boolean;
  /** false for countries that are always lit by province */
  canSwitchDetail: boolean;
  onSet(status: FootprintStatus): void;
  onSetCountry(status: FootprintStatus): void;
  onSwitchDetail(on: boolean): void;
  onClose(): void;
}

export default function PlaceCard({
  region,
  country,
  status,
  countryLit,
  onItsOwn,
  canSwitchDetail,
  onSet,
  onSetCountry,
  onSwitchDetail,
  onClose,
}: Props) {
  const total = country.regions.length;
  const mainland = country.mainland.length;
  const single = total === 1;
  const lit = status !== "unvisited";
  const partial = !region && countryLit > 0 && !lit;
  const quiet = "text-[12px] text-[#8e8e93] underline-offset-2 hover:text-[#3a3a3c] hover:underline";

  return (
    <div className="glass world-rise w-full rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.01em]">
            {region ? region.name : country.name}
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-[#6e6e73]">
            {!region
              ? partial
                ? `${country.nameEn} · 已点亮其中 ${countryLit}/${total} 个地区`
                : country.nameEn
              : single
                ? country.nameEn
                : `${country.name} · ${region.nameEn}`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(118,118,128,0.16)" }}
        >
          <X size={15} color="#6e6e73" strokeWidth={2.5} />
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {LIT_ORDER.map((s) => {
          const on = status === s;
          return (
            <button
              key={s}
              onClick={() => onSet(on ? "unvisited" : s)}
              className="relative rounded-[14px] px-2 py-2.5 text-center transition-all duration-200 active:scale-[0.97]"
              style={{
                background: on ? LIT[s].color : "rgba(118,118,128,0.12)",
                color: on ? "#fff" : "#1d1d1f",
                boxShadow: on ? `0 6px 18px ${LIT[s].color}55` : undefined,
              }}
            >
              <div className="flex items-center justify-center gap-1.5 text-[15px] font-semibold">
                {on ? (
                  <Check size={15} strokeWidth={3} />
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ background: LIT[s].color }} />
                )}
                {LIT[s].label}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ opacity: on ? 0.85 : 0.5 }}>
                {LIT[s].hint}
              </div>
            </button>
          );
        })}
      </div>

      {region && !single && !onItsOwn && (
        <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-[#6e6e73]">
          <span className="tabular-nums">
            {country.name}已点亮 {countryLit}/{total}
          </span>
          {lit ? (
            <button onClick={() => onSetCountry(status)} className="font-medium" style={{ color: "#007aff" }}>
              把{country.name}全部标为{LIT[status as keyof typeof LIT].label}
            </button>
          ) : countryLit > 0 ? (
            <button onClick={() => onSetCountry("unvisited")} className="font-medium" style={{ color: "#ff3b30" }}>
              清除{country.name}的全部标记
            </button>
          ) : null}
        </div>
      )}

      {/* the quiet way in and out of province-level detail */}
      {canSwitchDetail && !onItsOwn && mainland > 1 && (
        <div className="mt-2.5 flex justify-end">
          {region ? (
            <button className={quiet} onClick={() => onSwitchDetail(false)}>
              改回整个国家一起点亮
            </button>
          ) : (
            <button className={quiet} onClick={() => onSwitchDetail(true)}>
              按省份分别点亮（{mainland} 个）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
