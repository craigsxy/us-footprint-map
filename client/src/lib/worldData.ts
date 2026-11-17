/**
 * World regions: loads /world/regions.json (TopoJSON built by scripts/world) and
 * derives everything the map and the panels need.
 */
import { feature, merge, mesh } from "topojson-client";
import type { Feature, FeatureCollection, MultiLineString, Point } from "geojson";

export interface RegionInfo {
  id: string;
  /** country code (Natural Earth ADM0_A3, plus XAD) */
  c: string;
  name: string;
  nameEn: string;
  /** label point */
  x: number;
  y: number;
  /** km² */
  area: number;
  /** an overseas territory: lit on its own even where its country is lit as one piece */
  standalone: boolean;
}

export type Continent = "AS" | "EU" | "AF" | "NA" | "SA" | "OC" | "AN";

export interface CountryInfo {
  code: string;
  name: string;
  nameEn: string;
  continent: Continent;
  x: number;
  y: number;
  /** label rank, 2 (largest) .. 8 */
  rank: number;
  /** sovereign state code when this entry is a dependency / territory */
  sovereign?: string;
  regions: RegionInfo[];
  /** the regions lit together when the country is lit as one piece (everything but overseas territories) */
  mainland: RegionInfo[];
  area: number;
}

export interface WorldData {
  regions: Map<string, RegionInfo>;
  countries: Map<string, CountryInfo>;
  /** countries sorted by Chinese name */
  countryList: CountryInfo[];
  features: Map<string, Feature>;
  fills: FeatureCollection;
  countryBorders: Feature<MultiLineString>;
  /** internal borders, one feature per country (property c) so they can be shown per country */
  regionBorders: FeatureCollection<MultiLineString>;
  countryLabels: FeatureCollection<Point>;
  regionLabels: FeatureCollection<Point>;
  /** land area excluding Antarctica, km² */
  landArea: number;
  /** a country's mainland as one shape, without its internal borders */
  countryOutline(code: string): Feature;
}

export const CONTINENT_NAMES: Record<Continent, string> = {
  AS: "亚洲",
  EU: "欧洲",
  AF: "非洲",
  NA: "北美洲",
  SA: "南美洲",
  OC: "大洋洲",
  AN: "南极洲",
};
export const CONTINENT_ORDER: Continent[] = ["AS", "EU", "NA", "SA", "AF", "OC", "AN"];

/**
 * Map labels are drawn from a Latin glyph file plus locally rendered CJK, so keep
 * only characters one of those two can draw.
 */
function labelText(s: string): string {
  return s
    .normalize("NFKC") // full-width punctuation -> ASCII
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\u0020-\u00ff\u3040-\u30ff\u4e00-\u9fff]/g, "")
    .trim();
}

let cache: Promise<WorldData> | null = null;

export function loadWorld(): Promise<WorldData> {
  cache ??= fetch("/world/regions.json")
    .then((r) => {
      if (!r.ok) throw new Error(`regions.json ${r.status}`);
      return r.json();
    })
    .then(build)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

function build(topo: any): WorldData {
  const obj = topo.objects.regions;
  const fills = feature(topo, obj) as unknown as FeatureCollection;
  const regions = new Map<string, RegionInfo>();
  const countries = new Map<string, CountryInfo>();
  const features = new Map<string, Feature>();

  for (const [code, m] of Object.entries<any>(topo.countries)) {
    countries.set(code, {
      code,
      name: m.z || m.n,
      nameEn: m.n,
      continent: m.k,
      x: m.x,
      y: m.y,
      rank: m.r,
      sovereign: m.s,
      regions: [],
      mainland: [],
      area: 0,
    });
  }

  for (const f of fills.features) {
    const p = f.properties as any;
    const r: RegionInfo = {
      id: p.rid,
      c: p.c,
      name: p.z || p.n,
      nameEn: p.n,
      x: p.x,
      y: p.y,
      area: p.a || 0,
      standalone: p.t === 1,
    };
    regions.set(r.id, r);
    features.set(r.id, f);
    const country = countries.get(r.c)!;
    country.regions.push(r);
    if (!r.standalone) country.mainland.push(r);
    country.area += r.area;
    // keep feature properties minimal: only what style expressions read
    f.properties = { rid: r.id, c: r.c, t: r.standalone ? 1 : 0 };
  }

  let landArea = 0;
  const countryList = Array.from(countries.values());
  for (const c of countryList) {
    c.regions.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    if (c.code !== "ATA") landArea += c.area;
  }
  countryList.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  const countryBorders = {
    type: "Feature",
    properties: {},
    geometry: mesh(topo, obj, (a: any, b: any) => a !== b && a.properties.c !== b.properties.c),
  } as Feature<MultiLineString>;
  const regionBorders: FeatureCollection<MultiLineString> = {
    type: "FeatureCollection",
    features: countryList
      .filter((c) => c.regions.length > 1)
      .map((c) => ({
        type: "Feature",
        properties: { c: c.code },
        geometry: mesh(
          topo,
          obj,
          (a: any, b: any) => a !== b && a.properties.c === c.code && b.properties.c === c.code
        ),
      })),
  };

  const countryLabels: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: countryList
      .map((c) => ({
        type: "Feature",
        properties: {
          code: c.code,
          name: labelText(c.name),
          // dependencies and specks label later than sovereign states of the same rank
          rank: c.rank + (c.sovereign ? 1.5 : 0),
          area: c.area,
        },
        geometry: { type: "Point", coordinates: [c.x, c.y] },
      })),
  };

  const regionLabels: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: Array.from(regions.values())
      // single-region countries already have a country label
      .filter((r) => countries.get(r.c)!.regions.length > 1)
      .map((r) => ({
        type: "Feature",
        properties: { rid: r.id, c: r.c, t: r.standalone ? 1 : 0, name: labelText(r.name), area: r.area },
        geometry: { type: "Point", coordinates: [r.x, r.y] },
      })),
  };

  const outlines = new Map<string, Feature>();
  const countryOutline = (code: string): Feature => {
    let f = outlines.get(code);
    if (!f) {
      f = {
        type: "Feature",
        properties: {},
        geometry: merge(
          topo,
          obj.geometries.filter((g: any) => g.properties.c === code && g.properties.t !== 1)
        ),
      };
      outlines.set(code, f);
    }
    return f;
  };

  return {
    countryOutline,
    regions,
    countries,
    countryList,
    features,
    fills,
    countryBorders,
    regionBorders,
    countryLabels,
    regionLabels,
    landArea,
  };
}

/** A zoom level that frames something of the given area (km²). */
export function zoomForArea(area: number): number {
  const z = 2 + (7 - Math.log10(Math.max(area, 1))) * 1.45;
  return Math.min(9, Math.max(1.6, z));
}
