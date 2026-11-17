/**
 * Which countries are lit province by province. China and the U.S. always are;
 * every other country is lit as one piece unless it is switched on here, either
 * for all countries at once or one by one.
 *
 * This only changes how the map is used. Records are always stored per region,
 * so switching a country back and forth loses nothing.
 */
import { useCallback, useMemo, useState } from "react";

const KEY = "footprint-world-detail-v1";
export const ALWAYS_DETAIL = new Set(["CHN", "USA"]);

interface Stored {
  all: boolean;
  countries: string[];
}

function load(): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object")
      return {
        all: v.all === true,
        countries: Array.isArray(v.countries) ? v.countries.filter((c: unknown) => typeof c === "string") : [],
      };
  } catch {
    // fall through to defaults
  }
  return { all: false, countries: [] };
}

export function useDetailSettings() {
  const [state, setState] = useState<Stored>(load);

  const update = useCallback((fn: (prev: Stored) => Stored) => {
    setState((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setAll = useCallback((all: boolean) => update((p) => ({ ...p, all })), [update]);
  const setCountry = useCallback(
    (code: string, on: boolean) =>
      update((p) => ({
        ...p,
        countries: on ? Array.from(new Set([...p.countries, code])) : p.countries.filter((c) => c !== code),
      })),
    [update]
  );

  const isDetail = useMemo(() => {
    const own = new Set(state.countries);
    return (code: string) => ALWAYS_DETAIL.has(code) || state.all || own.has(code);
  }, [state]);

  return { all: state.all, countries: state.countries, isDetail, setAll, setCountry };
}
