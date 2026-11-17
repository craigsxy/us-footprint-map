/**
 * The dashed line around the South China Sea as drawn on maps published in China
 * (nine dashes in the sea, plus the one east of Taiwan).
 *
 * The positions are approximate: placed by hand from the published small-scale
 * maps, not from surveyed coordinates. Good for a world-scale map, not for
 * measuring anything.
 */
import type { Feature, MultiLineString } from "geojson";

// [lon, lat] end points of each dash, clockwise from the coast of central Vietnam
const DASHES: [number, number][][] = [
  [[109.5, 16.2], [110.2, 15.1]],
  [[110.3, 12.3], [110.0, 11.1]],
  [[108.9, 7.6], [108.2, 6.5]],
  [[111.0, 3.9], [112.4, 3.5]],
  [[115.0, 6.6], [115.9, 7.6]],
  [[117.9, 9.9], [118.7, 11.2]],
  [[119.0, 14.6], [119.1, 15.9]],
  [[119.6, 18.0], [120.0, 19.2]],
  [[121.2, 21.2], [122.2, 21.6]],
  [[122.5, 23.4], [122.7, 24.6]],
];

export const NINE_DASH_LINE: Feature<MultiLineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "MultiLineString", coordinates: DASHES },
};
