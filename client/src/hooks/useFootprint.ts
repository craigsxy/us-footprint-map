/**
 * Footprint state. One localStorage-backed store keyed by world region id;
 * `useFootprint` is the U.S. page's view of it (FIPS / territory ids).
 */
import { useCallback, useMemo, useState } from "react";
import {
  FootprintData,
  FootprintStatus,
  getNextStatus,
  isUsWorldId,
  loadFootprintData,
  pickUsData,
  saveFootprintData,
  STATUS_ORDER,
  usToWorldId,
} from "@/lib/footprintData";

/** The whole store, keyed by world region id. */
export function useFootprintStore() {
  const [all, setAll] = useState<FootprintData>(() => loadFootprintData());

  const update = useCallback((fn: (prev: FootprintData) => FootprintData) => {
    setAll((prev) => {
      const next = fn(prev);
      if (next !== prev) saveFootprintData(next);
      return next;
    });
  }, []);

  /** Set many regions at once; "unvisited" removes the entry. */
  const setMany = useCallback(
    (ids: string[], status: FootprintStatus) => {
      update((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (status === "unvisited") delete next[id];
          else next[id] = status;
        }
        return next;
      });
    },
    [update]
  );

  const setOne = useCallback(
    (id: string, status: FootprintStatus) => setMany([id], status),
    [setMany]
  );

  const cycleOne = useCallback(
    (id: string) => {
      update((prev) => {
        const next = { ...prev };
        const status = getNextStatus(prev[id] ?? "unvisited");
        if (status === "unvisited") delete next[id];
        else next[id] = status;
        return next;
      });
    },
    [update]
  );

  const replaceAll = useCallback((next: FootprintData) => update(() => next), [update]);

  /** Remove every entry whose id matches. */
  const clearWhere = useCallback(
    (match: (id: string) => boolean) => {
      update((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !match(id))));
    },
    [update]
  );

  return { all, setOne, setMany, cycleOne, replaceAll, clearWhere };
}

export function useFootprint() {
  const { all, setOne, cycleOne, replaceAll, clearWhere } = useFootprintStore();
  const data = useMemo(() => pickUsData(all), [all]);

  const getStatus = useCallback(
    (id: string): FootprintStatus => data[id] ?? "unvisited",
    [data]
  );
  const cycleStatus = useCallback((id: string) => cycleOne(usToWorldId(id)), [cycleOne]);
  const setStatus = useCallback(
    (id: string, status: FootprintStatus) => setOne(usToWorldId(id), status),
    [setOne]
  );
  /** Clears the U.S. records only; the rest of the world is left alone. */
  const resetAll = useCallback(() => clearWhere(isUsWorldId), [clearWhere]);

  const stats = {
    total: 56,
    visited: Object.keys(data).length,
    byStatus: STATUS_ORDER.reduce(
      (acc, status) => {
        acc[status] = Object.values(data).filter((s) => s === status).length;
        return acc;
      },
      {} as Record<FootprintStatus, number>
    ),
  };

  return { data, allData: all, getStatus, cycleStatus, setStatus, resetAll, replaceAll, stats };
}
