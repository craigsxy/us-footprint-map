/**
 * China — flat map of the 34 province-level regions. Same records as the globe:
 * what is lit here is lit there.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, RotateCcw, X } from "lucide-react";
import BackupMenu from "@/components/BackupMenu";
import ChinaMap from "@/components/ChinaMap";
import Legend from "@/components/Legend";
import StatsPanel from "@/components/StatsPanel";
import { useFootprintStore } from "@/hooks/useFootprint";
import { FootprintStatus, getStatusConfig, STATUS_ORDER } from "@/lib/footprintData";
import { loadWorld, type WorldData } from "@/lib/worldData";

const isChinaId = (id: string) => id.startsWith("CN-");

export default function China() {
  const { all, setOne, cycleOne, replaceAll, clearWhere } = useFootprintStore();
  const [world, setWorld] = useState<WorldData | null>(null);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    loadWorld().then(setWorld, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const prev = document.title;
    document.title = "足迹 · 中国";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const opened = Date.now();
    const close = () => {
      if (Date.now() - opened > 500) setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const regions = world?.countries.get("CHN")?.regions ?? [];
  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<FootprintStatus, number>;
    let visited = 0;
    for (const r of regions) {
      const s = all[r.id];
      if (!s) continue;
      visited++;
      byStatus[s]++;
    }
    return { total: regions.length || 34, visited, byStatus };
  }, [regions, all]);

  const handleReset = useCallback(() => {
    if (window.confirm("清空中国的全部足迹记录？其他国家不受影响，这个操作不能撤销。")) clearWhere(isChinaId);
  }, [clearWhere]);

  const menuRegion = menu && world ? world.regions.get(menu.id) : undefined;

  return (
    <div
      className="relative flex h-screen select-none flex-col overflow-hidden bg-white"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <header
        className="relative z-30 flex flex-shrink-0 items-center justify-between border-b px-3 py-3 sm:px-5"
        style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-0.5 rounded-lg py-1.5 pl-1.5 pr-2.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50"
            style={{ border: "1px solid #bfdbfe" }}
            aria-label="回到世界地图"
          >
            <ChevronLeft size={15} />
            世界
          </Link>
          <div className="min-w-0">
            <h1
              className="truncate text-base font-bold leading-none tracking-tight sm:text-lg"
              style={{ color: "#1f2937", letterSpacing: "-0.02em" }}
            >
              中国足迹地图
            </h1>
            <p
              className="mt-1 hidden text-[11px] lg:block"
              style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}
            >
              点击循环状态 · 右键直接选择
            </p>
            <p
              className="mt-1 text-[10px] leading-snug lg:hidden"
              style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}
            >
              双指缩放 · 点击循环 · 长按选状态
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xl font-bold sm:text-2xl" style={{ color: "#0369a1" }}>
              {stats.visited}
            </span>
            <span className="font-mono text-xs text-gray-400 sm:text-sm">/ {stats.total}</span>
          </div>
          <BackupMenu data={all} replaceAll={replaceAll} />
          <button
            onClick={handleReset}
            className="rounded-lg p-2 text-gray-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            style={{ border: "1px solid #e5e7eb" }}
            title="清空中国的记录"
            aria-label="清空中国的记录"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside
          className="hidden flex-shrink-0 overflow-y-auto lg:block"
          style={{ width: 220, background: "#ffffff", borderRight: "1px solid #e5e7eb" }}
        >
          <div className="flex flex-col gap-4 p-3">
            <StatsPanel stats={stats} onReset={handleReset} />
            <div className="border-t" style={{ borderColor: "#e5e7eb" }} />
            <Legend />
          </div>
        </aside>

        <div className="flex-shrink-0 border-b px-3 py-2.5 lg:hidden" style={{ borderColor: "#e5e7eb" }}>
          <StatsPanel stats={stats} onReset={handleReset} compact />
          <div className="my-2 border-t" style={{ borderColor: "#e5e7eb" }} />
          <Legend compact />
        </div>

        <main className="relative min-h-0 flex-1" style={{ background: "#eef5fb" }}>
          {world ? (
            <ChinaMap
              world={world}
              data={all}
              onClick={cycleOne}
              onMenu={(id, x, y) => setMenu({ id, x, y })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-400">
              {failed ? (
                <>
                  <p>地图数据没有加载成功</p>
                  <button onClick={load} className="rounded-full bg-sky-600 px-4 py-1.5 text-white">
                    重试
                  </button>
                </>
              ) : (
                <p>正在载入地图…</p>
              )}
            </div>
          )}
        </main>
      </div>

      {menu && menuRegion && (
        <div
          className="fixed z-50 overflow-hidden rounded-xl shadow-lg"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 210),
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            minWidth: 190,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "#e5e7eb" }}>
            <span className="truncate text-[12px] font-semibold text-gray-900">{menuRegion.name}</span>
            <button onClick={() => setMenu(null)} className="ml-2 text-gray-400 hover:text-gray-600" aria-label="关闭">
              <X size={12} />
            </button>
          </div>
          <div className="py-1">
            {STATUS_ORDER.map((status) => {
              const config = getStatusConfig(status);
              const current = (all[menu.id] ?? "unvisited") === status;
              return (
                <button
                  key={status}
                  onClick={() => {
                    setOne(menu.id, status);
                    setMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50"
                  style={{ background: current ? "#f0f9ff" : "transparent" }}
                >
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ background: config.color, border: `1px solid ${config.borderColor}` }}
                  />
                  <span className="flex-1 font-mono text-[12px] text-gray-900">{config.labelZh}</span>
                  {current && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#0369a1" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
