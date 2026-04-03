/**
 * useFootprint — Custom hook for managing footprint state
 * Handles localStorage persistence and state cycling
 */
import { useCallback, useState } from "react";
import {
  FootprintData,
  FootprintStatus,
  getNextStatus,
  loadFootprintData,
  saveFootprintData,
  STATUS_ORDER,
} from "@/lib/footprintData";

export function useFootprint() {
  const [data, setData] = useState<FootprintData>(() => loadFootprintData());

  const getStatus = useCallback(
    (id: string): FootprintStatus => {
      return data[id] ?? "unvisited";
    },
    [data]
  );

  const cycleStatus = useCallback(
    (id: string) => {
      setData((prev) => {
        const current = prev[id] ?? "unvisited";
        const next = getNextStatus(current);
        const updated = { ...prev };
        if (next === "unvisited") {
          delete updated[id];
        } else {
          updated[id] = next;
        }
        saveFootprintData(updated);
        return updated;
      });
    },
    []
  );

  const setStatus = useCallback((id: string, status: FootprintStatus) => {
    setData((prev) => {
      const updated = { ...prev };
      if (status === "unvisited") {
        delete updated[id];
      } else {
        updated[id] = status;
      }
      saveFootprintData(updated);
      return updated;
    });
  }, []);

  const resetAll = useCallback(() => {
    setData({});
    saveFootprintData({});
  }, []);

  // Statistics
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

  return { data, getStatus, cycleStatus, setStatus, resetAll, stats };
}
