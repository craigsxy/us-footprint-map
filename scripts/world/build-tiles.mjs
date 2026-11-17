/**
 * Cut an equirectangular world raster (Natural Earth I, shaded relief + water) into
 * Web-Mercator XYZ tiles: <out>/{z}/{x}/{y}.webp
 *
 * Usage: node build-tiles.mjs <source.tif> <outDir> [maxZoom=6] [tileSize=512] [quality=80] [minZoom=0]
 *
 * Zooms narrower than the source are cut from a Lanczos-downsampled copy. Zooms
 * wider than the source (the last level or so) are sampled bilinearly straight
 * from the full-size source, one row of tiles at a time, so nothing bigger than
 * the source itself is ever held in memory.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const [, , SRC, OUT, MAXZ = "6", TS = "512", Q = "80", MINZ = "0"] = process.argv;
const maxZoom = +MAXZ;
const minZoom = +MINZ;
const T = +TS;
const quality = +Q;

const meta = await sharp(SRC, { limitInputPixels: false }).metadata();
let full = null; // full-size source pixels, loaded only if a zoom needs upsampling

for (let z = minZoom; z <= maxZoom; z++) {
  const n = 2 ** z;
  const W = T * n; // world width in px at this zoom
  const up = W > meta.width;
  // source grid this zoom samples from
  const SW = up ? meta.width : W;
  const SH = up ? meta.height : W / 2;
  let data;
  if (up) {
    full ??= (await sharp(SRC, { limitInputPixels: false }).removeAlpha().raw().toBuffer());
    data = full;
  } else {
    data = await sharp(SRC, { limitInputPixels: false })
      .resize(SW, SH, { kernel: "lanczos3", fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();
  }

  // source row (fractional) for every mercator pixel row
  const rowOf = new Float64Array(W);
  for (let Y = 0; Y < W; Y++) {
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (Y + 0.5)) / W))) * 180) / Math.PI;
    rowOf[Y] = Math.min(SH - 1, Math.max(0, ((90 - lat) / 180) * SH - 0.5));
  }
  // source column (fractional) for every output column; identity when not upsampling
  const colOf = up ? new Float64Array(W) : null;
  if (colOf) for (let X = 0; X < W; X++) colOf[X] = Math.min(SW - 1, Math.max(0, ((X + 0.5) / W) * SW - 0.5));

  let count = 0;
  for (let ty = 0; ty < n; ty++) {
    // one full-width strip of tiles at a time
    const strip = Buffer.allocUnsafe(W * T * 3);
    for (let j = 0; j < T; j++) {
      const v = rowOf[ty * T + j];
      const v0 = Math.floor(v);
      const v1 = Math.min(SH - 1, v0 + 1);
      const f = v - v0;
      const a = v0 * SW * 3;
      const b = v1 * SW * 3;
      const o = j * W * 3;
      if (!colOf) {
        for (let i = 0; i < W * 3; i++) strip[o + i] = data[a + i] * (1 - f) + data[b + i] * f + 0.5;
      } else {
        for (let X = 0; X < W; X++) {
          const u = colOf[X];
          const u0 = Math.floor(u);
          const u1 = Math.min(SW - 1, u0 + 1);
          const g = u - u0;
          for (let c = 0; c < 3; c++) {
            const top = data[a + u0 * 3 + c] * (1 - g) + data[a + u1 * 3 + c] * g;
            const bot = data[b + u0 * 3 + c] * (1 - g) + data[b + u1 * 3 + c] * g;
            strip[o + X * 3 + c] = top * (1 - f) + bot * f + 0.5;
          }
        }
      }
    }
    for (let tx = 0; tx < n; tx++) {
      const dir = path.join(OUT, String(z), String(tx));
      fs.mkdirSync(dir, { recursive: true });
      await sharp(strip, { raw: { width: W, height: T, channels: 3 } })
        .extract({ left: tx * T, top: 0, width: T, height: T })
        .webp({ quality, effort: 5 })
        .toFile(path.join(dir, `${ty}.webp`));
      count++;
    }
  }
  console.log(`z${z}: ${count} tiles`);
}
