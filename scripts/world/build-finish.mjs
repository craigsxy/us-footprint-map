/**
 * Step 3: attach the country table to the TopoJSON and write the file the app loads.
 * Usage: node build-finish.mjs <regions.topo.json> <meta.json> <out.json>
 */
import fs from "fs";
const [, , TOPO, META, OUT] = process.argv;
const topo = JSON.parse(fs.readFileSync(TOPO, "utf8"));
const meta = JSON.parse(fs.readFileSync(META, "utf8"));

const standalone = new Set(meta.standalone);
const geoms = topo.objects.regions.geometries;
const perCountry = {};
for (const g of geoms) {
  const p = g.properties;
  if (!meta.countries[p.c]) throw new Error("unknown country " + p.c);
  perCountry[p.c] = (perCountry[p.c] || 0) + 1;
  if (p.z === p.n) delete p.z; // no Chinese name -> fall back to n in the app
  if (standalone.has(p.rid)) p.t = 1; // lit on its own even where the country is lit as one piece
}
for (const c of Object.keys(meta.countries)) if (!perCountry[c]) delete meta.countries[c];
topo.countries = meta.countries;
fs.writeFileSync(OUT, JSON.stringify(topo));
console.log(`regions ${geoms.length}, countries ${Object.keys(meta.countries).length}, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
