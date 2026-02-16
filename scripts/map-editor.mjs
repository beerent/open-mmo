/**
 * Map editor utilities for programmatic editing of Shireland's town.json.
 * Import these functions in inline Node scripts during map design sessions.
 *
 * Usage:
 *   import { loadMap, saveMap, setTile, fillRect, ... } from './scripts/map-editor.mjs';
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const DEFAULT_MAP_PATH = resolve(
  import.meta.dirname,
  "../apps/client/public/assets/maps/town.json"
);

// ── Core I/O ────────────────────────────────────────────────

export function loadMap(path = DEFAULT_MAP_PATH) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveMap(map, path = DEFAULT_MAP_PATH) {
  writeFileSync(path, JSON.stringify(map));
  console.log(`[map-editor] Saved map (${map.width}x${map.height}, ${map.layers.length} layers)`);
}

// ── Layer helpers ───────────────────────────────────────────

export function getLayer(map, name) {
  const layer = map.layers.find((l) => l.name === name);
  if (!layer) throw new Error(`Layer "${name}" not found. Available: ${map.layers.map(l => l.name).join(", ")}`);
  return layer;
}

export function addLayer(map, name, afterLayerName = null) {
  // Check if already exists
  if (map.layers.find((l) => l.name === name)) {
    console.log(`[map-editor] Layer "${name}" already exists`);
    return getLayer(map, name);
  }

  const layer = {
    name,
    type: "tilelayer",
    width: map.width,
    height: map.height,
    visible: true,
    data: new Array(map.width * map.height).fill(0),
  };

  if (afterLayerName) {
    const idx = map.layers.findIndex((l) => l.name === afterLayerName);
    if (idx >= 0) {
      map.layers.splice(idx + 1, 0, layer);
    } else {
      map.layers.push(layer);
    }
  } else {
    // Insert before collision layer
    const collIdx = map.layers.findIndex((l) => l.name === "collision");
    if (collIdx >= 0) {
      map.layers.splice(collIdx, 0, layer);
    } else {
      map.layers.push(layer);
    }
  }

  console.log(`[map-editor] Added layer "${name}"`);
  return layer;
}

export function ensureLayer(map, name) {
  try {
    return getLayer(map, name);
  } catch {
    return addLayer(map, name);
  }
}

// ── Tile index helpers ──────────────────────────────────────

function tileIndex(map, x, y) {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
    throw new Error(`Tile (${x}, ${y}) out of bounds (map is ${map.width}x${map.height})`);
  }
  return y * map.width + x;
}

// ── Tile placement ──────────────────────────────────────────

export function setTile(map, layerName, x, y, gid) {
  const layer = getLayer(map, layerName);
  layer.data[tileIndex(map, x, y)] = gid;
}

export function getTile(map, layerName, x, y) {
  const layer = getLayer(map, layerName);
  return layer.data[tileIndex(map, x, y)];
}

export function fillRect(map, layerName, x, y, w, h, gid) {
  const layer = getLayer(map, layerName);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = tileIndex(map, x + dx, y + dy);
      layer.data[idx] = gid;
    }
  }
  console.log(`[map-editor] fillRect ${layerName} (${x},${y}) ${w}x${h} gid=${gid}`);
}

/**
 * Stamp a 2D pattern of GIDs onto a layer.
 * pattern is an array of rows, each row is an array of GIDs.
 * GID 0 in pattern = skip (don't overwrite existing tile).
 * GID -1 in pattern = clear (set to 0).
 */
export function stampPattern(map, layerName, x, y, pattern) {
  const layer = getLayer(map, layerName);
  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      const gid = pattern[row][col];
      if (gid === 0) continue; // skip
      const idx = tileIndex(map, x + col, y + row);
      layer.data[idx] = gid === -1 ? 0 : gid;
    }
  }
  const h = pattern.length;
  const w = pattern[0]?.length ?? 0;
  console.log(`[map-editor] stampPattern ${layerName} (${x},${y}) ${w}x${h}`);
}

// ── Collision ───────────────────────────────────────────────

export function setCollision(map, x, y, solid = true) {
  const layer = getLayer(map, "collision");
  layer.data[tileIndex(map, x, y)] = solid ? 1 : 0;
}

export function fillCollision(map, x, y, w, h, solid = true) {
  const layer = getLayer(map, "collision");
  const val = solid ? 1 : 0;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      layer.data[tileIndex(map, x + dx, y + dy)] = val;
    }
  }
  console.log(`[map-editor] fillCollision (${x},${y}) ${w}x${h} solid=${solid}`);
}

// ── Clearing ────────────────────────────────────────────────

export function clearRect(map, layerName, x, y, w, h) {
  fillRect(map, layerName, x, y, w, h, 0);
}

export function clearAllLayers(map, x, y, w, h) {
  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;
    if (layer.name === "collision") continue;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const idx = tileIndex(map, x + dx, y + dy);
        layer.data[idx] = 0;
      }
    }
  }
  console.log(`[map-editor] clearAllLayers (${x},${y}) ${w}x${h}`);
}

// ── Map resize ──────────────────────────────────────────────

export function resizeMap(map, newWidth, newHeight, fillGid = 740) {
  const oldWidth = map.width;
  const oldHeight = map.height;

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;

    const newData = new Array(newWidth * newHeight).fill(
      layer.name === "ground" ? fillGid : 0
    );

    // Copy existing data
    for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
      for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
        newData[y * newWidth + x] = layer.data[y * oldWidth + x];
      }
    }

    layer.data = newData;
    layer.width = newWidth;
    layer.height = newHeight;
  }

  map.width = newWidth;
  map.height = newHeight;
  console.log(`[map-editor] Resized map: ${oldWidth}x${oldHeight} → ${newWidth}x${newHeight}`);
}

// ── Info / Debug ────────────────────────────────────────────

export function printMapInfo(map) {
  console.log(`Map: ${map.width}x${map.height}`);
  console.log(`Tilesets: ${map.tilesets.length}`);
  for (const ts of map.tilesets) {
    console.log(`  ${ts.name}: GIDs ${ts.firstgid}–${ts.firstgid + ts.tilecount - 1}`);
  }
  console.log(`Layers: ${map.layers.length}`);
  for (const l of map.layers) {
    if (!l.data) continue;
    const nonzero = l.data.filter((g) => g !== 0).length;
    console.log(`  ${l.name}: ${nonzero}/${l.data.length} tiles`);
  }
}

export function findTilesInRange(map, layerName, minGid, maxGid) {
  const layer = getLayer(map, layerName);
  const results = [];
  for (let i = 0; i < layer.data.length; i++) {
    const gid = layer.data[i];
    if (gid >= minGid && gid <= maxGid) {
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      results.push({ x, y, gid });
    }
  }
  return results;
}
