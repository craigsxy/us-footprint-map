/**
 * Reference lines drawn on the globe: the equator and the International Date Line.
 *
 * The date line is the usual simplified course (Bering Strait, the bend around
 * the Aleutians, Kiribati's eastward bulge, Samoa/Tonga). It has no legal
 * definition and maps differ in the details, so treat it as indicative.
 * Longitudes run past 180 on purpose: keeping them continuous stops the line
 * from being drawn the long way round the world.
 */
import type { Feature, FeatureCollection, LineString } from "geojson";

const equator: Feature<LineString> = {
  type: "Feature",
  properties: { name: "赤道" },
  geometry: {
    type: "LineString",
    coordinates: Array.from({ length: 145 }, (_, i) => [-180 + i * 2.5, 0]),
  },
};

const dateLine: Feature<LineString> = {
  type: "Feature",
  properties: { name: "国际日期变更线" },
  geometry: {
    type: "LineString",
    coordinates: [
      [180, 89],
      [180, 75],
      [191, 68], // 169°W: through the Bering Strait
      [191, 65.5],
      [170, 53], // west of the Aleutians
      [180, 48],
      [180, 5],
      [195, 6], // out around Kiribati's Line Islands
      [210, 2],
      [210, -10],
      [195, -11.5],
      [189.2, -13], // between Samoa and American Samoa
      [187.5, -16.5],
      [187.5, -45], // east of Tonga and the Chatham Islands
      [180, -51.5],
      [180, -89],
    ],
  },
};

export const REFERENCE_LINES: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [equator, dateLine],
};
