/**
 * sync-map.mjs — Convert Tiled .tmx → game-ready town.json
 *
 * Handles infinite (chunk-based) maps, resolves external .tsx tilesets,
 * maps image paths to web paths, and only includes used tilesets.
 *
 * Usage:  node scripts/sync-map.mjs [path-to-tmx]
 * Default: tiled/The Fan-tasy Tileset (Premium)/Tiled/Tilesets/island.tmx
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "apps/client/public");
const OUT_PATH = resolve(PUBLIC_DIR, "assets/maps/town.json");

const TMX_PATH = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, "tiled/The Fan-tasy Tileset (Premium)/Tiled/Tilesets/island.tmx");

const tmx = readFileSync(TMX_PATH, "utf-8");
const tmxDir = dirname(TMX_PATH);

// ── Parse map attributes ───────────────────────────────────────────────────
const isInfinite = /infinite="1"/.test(tmx);
const declaredW = parseInt(tmx.match(/\bwidth="(\d+)"/)?.[1] ?? "40");
const declaredH = parseInt(tmx.match(/\bheight="(\d+)"/)?.[1] ?? "40");
const tileW = parseInt(tmx.match(/tilewidth="(\d+)"/)?.[1] ?? "16");
const tileH = parseInt(tmx.match(/tileheight="(\d+)"/)?.[1] ?? "16");

// ── Parse tilesets ─────────────────────────────────────────────────────────
const tilesetRefs = [...tmx.matchAll(/<tileset firstgid="(\d+)" source="([^"]+)"\/>/g)];

// ── Parse layers (handles both flat and chunk-based) ───────────────────────
function parseTileLayers() {
  const layers = [];
  // Match tile layers
  const layerRegex = /<layer[^>]*?\bid="(\d+)"[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/layer>/g;
  let match;
  while ((match = layerRegex.exec(tmx)) !== null) {
    const [, , name, body] = match;
    layers.push({ name, type: "tilelayer", body });
  }
  return layers;
}

function parseObjectLayers() {
  const layers = [];
  const regex = /<objectgroup[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/objectgroup>/g;
  let match;
  while ((match = regex.exec(tmx)) !== null) {
    const [, name, body] = match;
    const objects = [];
    // Match each <object ...> element (self-closing or with children)
    const objRegex = /<object\b([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/g;
    let om;
    while ((om = objRegex.exec(body)) !== null) {
      const attrs = om[1];
      const inner = om[2] || "";
      const x = attrs.match(/\bx="([^"]+)"/);
      const y = attrs.match(/\by="([^"]+)"/);
      if (!x || !y) continue;

      const gidMatch = attrs.match(/\bgid="(\d+)"/);
      const nameMatch = attrs.match(/\bname="([^"]+)"/);
      const isPoint = /<point\s*\/>/.test(inner);

      if (gidMatch) {
        // Tile object
        const wMatch = attrs.match(/\bwidth="([^"]+)"/);
        const hMatch = attrs.match(/\bheight="([^"]+)"/);
        objects.push({
          gid: parseInt(gidMatch[1]),
          x: parseFloat(x[1]),
          y: parseFloat(y[1]),
          width: parseFloat(wMatch?.[1] ?? "0"),
          height: parseFloat(hMatch?.[1] ?? "0"),
        });
      } else if (isPoint) {
        // Point object
        const obj = {
          x: parseFloat(x[1]),
          y: parseFloat(y[1]),
          point: true,
        };
        if (nameMatch) obj.name = nameMatch[1];
        objects.push(obj);
      }
    }
    layers.push({ name, type: "objectgroup", objects });
  }
  return layers;
}

// Parse chunks from a layer body → flat data array
function flattenChunks(body, mapW, mapH, originX, originY) {
  const data = new Array(mapW * mapH).fill(0);
  const chunkRegex = /<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">\s*([\s\S]*?)\s*<\/chunk>/g;
  let cm;
  while ((cm = chunkRegex.exec(body)) !== null) {
    const cx = parseInt(cm[1]) - originX;
    const cy = parseInt(cm[2]) - originY;
    const cw = parseInt(cm[3]);
    const csv = cm[5];
    const values = csv.split(",").map((s) => parseInt(s.trim())).filter((v) => !isNaN(v));
    for (let i = 0; i < values.length; i++) {
      const lx = cx + (i % cw);
      const ly = cy + Math.floor(i / cw);
      if (lx >= 0 && lx < mapW && ly >= 0 && ly < mapH) {
        data[ly * mapW + lx] = values[i];
      }
    }
  }
  return data;
}

// Parse flat CSV data
function parseFlatData(body) {
  const dataMatch = body.match(/<data encoding="csv">\s*([\s\S]*?)\s*<\/data>/);
  if (!dataMatch) return [];
  return dataMatch[1].split(",").map((s) => parseInt(s.trim())).filter((v) => !isNaN(v));
}

// ── Determine map bounds for infinite maps ─────────────────────────────────
let mapW, mapH, originX, originY;

if (isInfinite) {
  const allChunks = [...tmx.matchAll(/<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">/g)];
  const xs = allChunks.map((c) => parseInt(c[1]));
  const ys = allChunks.map((c) => parseInt(c[2]));
  const ws = allChunks.map((c) => parseInt(c[3]));
  const hs = allChunks.map((c) => parseInt(c[4]));
  originX = Math.min(...xs);
  originY = Math.min(...ys);
  mapW = Math.max(...xs.map((x, i) => x + ws[i])) - originX;
  mapH = Math.max(...ys.map((y, i) => y + hs[i])) - originY;
  console.log(`Map: ${mapW}x${mapH} (infinite, origin=${originX},${originY})`);
} else {
  mapW = declaredW;
  mapH = declaredH;
  originX = 0;
  originY = 0;
  console.log(`Map: ${mapW}x${mapH}`);
}

// ── Build layer data ───────────────────────────────────────────────────────
const tileLayers = parseTileLayers();
const objectLayers = parseObjectLayers();

const allLayerData = []; // { name, data[] } for finding used GIDs
const outputLayers = [];

for (const tl of tileLayers) {
  const data = isInfinite
    ? flattenChunks(tl.body, mapW, mapH, originX, originY)
    : parseFlatData(tl.body);

  allLayerData.push({ name: tl.name, data });
}

// Collect used GIDs
const usedGids = new Set();
for (const ld of allLayerData) {
  for (const gid of ld.data) {
    if (gid !== 0) usedGids.add((gid & 0x1fffffff) >>> 0);
  }
}
for (const ol of objectLayers) {
  for (const obj of ol.objects) {
    if (obj.gid) usedGids.add((obj.gid & 0x1fffffff) >>> 0);
  }
}
console.log(`  ${usedGids.size} unique tile GIDs used`);

// ── Resolve tilesets ───────────────────────────────────────────────────────
const tilesets = [];
let skipped = 0;

for (const [, firstgidStr, tsxRelPath] of tilesetRefs) {
  const firstgid = parseInt(firstgidStr);
  const tsxPath = resolve(tmxDir, tsxRelPath);

  let tsx;
  try {
    tsx = readFileSync(tsxPath, "utf-8");
  } catch {
    console.warn(`  SKIP (not found): ${tsxRelPath}`);
    skipped++;
    continue;
  }

  const nameMatch = tsx.match(/name="([^"]+)"/);
  const twMatch = tsx.match(/tilewidth="(\d+)"/);
  const thMatch = tsx.match(/tileheight="(\d+)"/);
  const tcMatch = tsx.match(/tilecount="(\d+)"/);
  const colsMatch = tsx.match(/columns="(\d+)"/);

  const name = nameMatch?.[1] ?? "unknown";
  const tilewidth = parseInt(twMatch?.[1] ?? "16");
  const tileheight = parseInt(thMatch?.[1] ?? "16");
  const tilecount = parseInt(tcMatch?.[1] ?? "0");
  const columns = parseInt(colsMatch?.[1] ?? "0");

  // Skip unused tilesets
  // For collection tilesets, tilecount in header may be less than max tile id
  const tileIds = [...tsx.matchAll(/<tile id="(\d+)"/g)].map((m) => parseInt(m[1]));
  const maxTileId = tileIds.length > 0 ? Math.max(...tileIds) + 1 : tilecount;
  const maxGid = firstgid + Math.max(tilecount, maxTileId);
  const isUsed = [...usedGids].some((g) => g >= firstgid && g < maxGid);
  if (!isUsed) {
    skipped++;
    continue;
  }

  const imgMatch = tsx.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"\/>/);

  if (imgMatch && columns > 0) {
    // Atlas tileset
    const imgAbsPath = resolve(dirname(tsxPath), imgMatch[1]);

    // Map to web path: try public dir first, then copy location
    let webPath;
    if (imgAbsPath.startsWith(PUBLIC_DIR)) {
      webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1);
    } else {
      // Image is outside public dir — check if it was copied to assets/Art
      const artRelPath = imgMatch[1].replace(/^(\.\.\/)*/, "");
      const publicCopy = resolve(PUBLIC_DIR, "assets", artRelPath);
      try {
        readFileSync(publicCopy);
        webPath = "/assets/" + artRelPath;
      } catch {
        console.warn(`  SKIP (image not in public): ${name} → ${imgAbsPath}`);
        skipped++;
        continue;
      }
    }

    tilesets.push({
      firstgid,
      name,
      image: webPath,
      imagewidth: parseInt(imgMatch[2]),
      imageheight: parseInt(imgMatch[3]),
      tilewidth,
      tileheight,
      tilecount,
      columns,
    });
    console.log(`  Atlas: ${name} (gid=${firstgid}, ${webPath})`);
  } else {
    // Collection tileset
    const tileMatches = [
      ...tsx.matchAll(/<tile id="(\d+)">\s*<image ([^>]+)\/>/g),
    ];
    if (tileMatches.length === 0) { skipped++; continue; }

    const tiles = [];
    for (const [, id, attrs] of tileMatches) {
      const src = attrs.match(/source="([^"]+)"/)?.[1];
      const w = attrs.match(/width="(\d+)"/)?.[1];
      const h = attrs.match(/height="(\d+)"/)?.[1];
      if (!src || !w || !h) continue;
      const tileGid = firstgid + parseInt(id);
      if (!usedGids.has(tileGid)) continue;
      const imgAbsPath = resolve(dirname(tsxPath), src);
      let webPath;
      if (imgAbsPath.startsWith(PUBLIC_DIR)) {
        webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1);
      } else {
        const artRelPath = src.replace(/^(\.\.\/)*/, "");
        webPath = "/assets/" + artRelPath;
      }
      tiles.push({ id: parseInt(id), image: webPath, imagewidth: parseInt(w), imageheight: parseInt(h) });
    }
    if (tiles.length === 0) { skipped++; continue; }

    tilesets.push({ firstgid, name, tilewidth, tileheight, tilecount, columns, tiles });
    console.log(`  Collection: ${name} (gid=${firstgid}, ${tiles.length} tiles)`);
  }
}

// ── Also handle the shireland_tiles tileset if referenced ──────────────────
// Check if any GID maps to a tileset referenced with source containing "shireland"
for (const [, firstgidStr, tsxRelPath] of [...tmx.matchAll(/<tileset firstgid="(\d+)" source="([^"]*shireland[^"]*)"\/>/gi)]) {
  const firstgid = parseInt(firstgidStr);
  // Already processed above, skip
  if (tilesets.some((t) => t.firstgid === firstgid)) continue;

  const tsxPath = resolve(tmxDir, tsxRelPath);
  let tsx;
  try { tsx = readFileSync(tsxPath, "utf-8"); } catch { continue; }

  const imgMatch = tsx.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"\/>/);
  if (imgMatch) {
    tilesets.push({
      firstgid,
      name: "Shireland",
      image: "/assets/shireland_tiles.png",
      imagewidth: parseInt(imgMatch[2]),
      imageheight: parseInt(imgMatch[3]),
      tilewidth: 16,
      tileheight: 16,
      tilecount: 2,
      columns: 2,
    });
  }
}

// ── Build output layers ────────────────────────────────────────────────────
for (const ld of allLayerData) {
  let data = ld.data;

  if (ld.name.toLowerCase() === "collision") {
    data = data.map((v) => (v !== 0 ? 1 : 0));
    for (let x = 0; x < mapW; x++) {
      data[x] = 1;
      data[(mapH - 1) * mapW + x] = 1;
    }
    for (let y = 0; y < mapH; y++) {
      data[y * mapW] = 1;
      data[y * mapW + (mapW - 1)] = 1;
    }
    const blocked = data.filter((v) => v === 1).length;
    console.log(`  Layer: collision (${mapW}x${mapH}, ${blocked} blocked)`);
  } else {
    console.log(`  Layer: ${ld.name} (${mapW}x${mapH})`);
  }

  outputLayers.push({
    name: ld.name,
    type: "tilelayer",
    width: mapW,
    height: mapH,
    visible: true,
    data,
  });
}

// Offset for object positions (infinite maps use negative coords)
const pixelOffsetX = originX * tileW;
const pixelOffsetY = originY * tileH;

for (const ol of objectLayers) {
  const offsetObjects = ol.objects.map((obj) => ({
    ...obj,
    x: obj.x - pixelOffsetX,
    y: obj.y - pixelOffsetY,
  }));
  outputLayers.push({
    name: ol.name,
    type: "objectgroup",
    width: mapW,
    height: mapH,
    visible: true,
    objects: offsetObjects,
  });
  console.log(`  ObjectGroup: ${ol.name} (${ol.objects.length} objects)`);
}

// Ensure collision layer
if (!outputLayers.some((l) => l.name.toLowerCase() === "collision")) {
  console.log("  Generating collision layer (border walls)");
  const data = new Array(mapW * mapH).fill(0);
  for (let x = 0; x < mapW; x++) {
    data[x] = 1;
    data[(mapH - 1) * mapW + x] = 1;
  }
  for (let y = 0; y < mapH; y++) {
    data[y * mapW] = 1;
    data[y * mapW + (mapW - 1)] = 1;
  }
  outputLayers.push({ name: "collision", type: "tilelayer", width: mapW, height: mapH, visible: false, data });
}

// ── Write output ───────────────────────────────────────────────────────────
const output = {
  width: mapW,
  height: mapH,
  tilewidth: tileW,
  tileheight: tileH,
  orientation: "orthogonal",
  renderorder: "right-down",
  tilesets,
  layers: outputLayers,
};

writeFileSync(OUT_PATH, JSON.stringify(output));
console.log(
  `\nWrote ${OUT_PATH}\n  ${tilesets.length} tilesets (${skipped} skipped), ${outputLayers.length} layers`
);
