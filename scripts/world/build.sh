#!/usr/bin/env bash
# Rebuilds client/public/world/{regions.json,tiles/} from Natural Earth (public domain).
#
#   WORK=/some/scratch/dir bash scripts/world/build.sh
#
# WORK must contain (unzipped from https://naciscdn.org/naturalearth/):
#   dl/ne_10m_admin_1_states_provinces/*.shp     (10m/cultural)
#   dl/ne_10m_admin_0_countries/*.shp            (10m/cultural)
#   dl/NE1_HR/NE1_HR_LC_SR_W_DR.tif               (10m/raster, NE1_HR_LC_SR_W_DR.zip)
# and a node project with `mapshaper` and `sharp` installed in $WORK/tools.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../client/public/world"
cd "$WORK/tools"
cp "$HERE"/*.mjs .

A1=../dl/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp
A0=../dl/ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp

npx mapshaper "$A1" encoding=utf8 -o format=json ../a1props.json
npx mapshaper "$A0" encoding=utf8 -o format=json ../a0props.json
node build-regions.mjs .. ../lookup.csv ../meta.json

npx mapshaper -i "$A1" encoding=utf8 \
  -join ../lookup.csv keys=ne_id,ne_id fields=rid,c,n,z string-fields=rid,c,n,z \
  -filter 'rid != null' \
  -dissolve rid copy-fields=c,n,z \
  -simplify weighted "${SIMPLIFY:-18%}" keep-shapes \
  -clean \
  -each 'x=Math.round(this.innerX*100)/100, y=Math.round(this.innerY*100)/100, a=Math.round(this.area/1e6)' \
  -rename-layers regions \
  -o format=topojson quantization=1e5 ../regions.topo.json

mkdir -p "$OUT"
node build-finish.mjs ../regions.topo.json ../meta.json "$OUT/regions.json"

if [ "${TILES:-1}" = "1" ]; then
  rm -rf "$OUT/tiles"
  node build-tiles.mjs ../dl/NE1_HR/NE1_HR_LC_SR_W_DR.tif "$OUT/tiles" 6 512 80
fi
