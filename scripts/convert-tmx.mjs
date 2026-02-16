/**
 * Convert the Fantasy Tileset's "Beginning Fields.tmx" into an embedded Tiled JSON
 * that our renderer can consume. Resolves external .tsx tileset references.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

const BASE = "/tmp/fantasy-tileset/The Fan-tasy Tileset (Free)";
const TMX_PATH = resolve(BASE, "Tiled/Tilemaps/Beginning Fields.tmx");
const OUT_PATH = resolve(
  import.meta.dirname,
  "../apps/client/public/assets/maps/town.json"
);

const tmx = readFileSync(TMX_PATH, "utf-8");

// Parse map attributes
const mapMatch = tmx.match(/<map[^>]*>/);
const width = parseInt(tmx.match(/width="(\d+)"/)[1]);
const height = parseInt(tmx.match(/height="(\d+)"/)[1]);

// Parse tileset references
const tilesetRefs = [...tmx.matchAll(/<tileset firstgid="(\d+)" source="([^"]+)"\/>/g)];

// Image path mapping: tileset image source -> our public path
const IMAGE_MAP = {
  "Buildings.png": "/assets/tilesets/Buildings.png",
  "Tileset_Ground.png": "/assets/tilesets/Tileset_Ground.png",
  "Tileset_Road.png": "/assets/tilesets/Tileset_Road.png",
  "Props.png": "/assets/tilesets/Props.png",
  "Rocks.png": "/assets/tilesets/Rocks.png",
  "Tileset_Shadow.png": "/assets/tilesets/Tileset_Shadow.png",
  "Tileset_Water.png": "/assets/tilesets/Tileset_Water.png",
  "Tileset_RockSlope.png": "/assets/tilesets/Tileset_RockSlope.png",
  "Tileset_RockSlope_Simple.png": "/assets/tilesets/Tileset_RockSlope_Simple.png",
  "Trees_Bushes.png": "/assets/tilesets/Trees_Bushes.png",
  "Campfire.png": "/assets/tilesets/Campfire.png",
  "Flowers_Red.png": "/assets/tilesets/Flowers_Red.png",
  "Flowers_White.png": "/assets/tilesets/Flowers_White.png",
};

const tilesets = [];
for (const [, firstgidStr, tsxRelPath] of tilesetRefs) {
  const firstgid = parseInt(firstgidStr);
  const tsxPath = resolve(dirname(TMX_PATH), tsxRelPath);

  try {
    const tsx = readFileSync(tsxPath, "utf-8");
    const nameMatch = tsx.match(/name="([^"]+)"/);
    const twMatch = tsx.match(/tilewidth="(\d+)"/);
    const thMatch = tsx.match(/tileheight="(\d+)"/);
    const tcMatch = tsx.match(/tilecount="(\d+)"/);
    const colsMatch = tsx.match(/columns="(\d+)"/);
    const imgMatch = tsx.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"\/>/);

    if (!imgMatch) {
      // Object-based tileset (individual images) — skip for tile rendering
      // These use variable-size tiles and are placed as objects
      console.log(`  Skipping object tileset: ${tsxRelPath} (no single image)`);
      continue;
    }

    const imgFilename = imgMatch[1].split("/").pop();
    const mappedImage = IMAGE_MAP[imgFilename];
    if (!mappedImage) {
      console.log(`  Skipping unmapped image: ${imgFilename}`);
      continue;
    }

    tilesets.push({
      firstgid,
      name: nameMatch?.[1] ?? "unknown",
      image: mappedImage,
      imagewidth: parseInt(imgMatch[2]),
      imageheight: parseInt(imgMatch[3]),
      tilewidth: parseInt(twMatch?.[1] ?? "16"),
      tileheight: parseInt(thMatch?.[1] ?? "16"),
      tilecount: parseInt(tcMatch?.[1] ?? "0"),
      columns: parseInt(colsMatch?.[1] ?? "1"),
    });
    console.log(`  Added tileset: ${nameMatch?.[1]} (firstgid=${firstgid}, image=${mappedImage})`);
  } catch (e) {
    console.log(`  Error reading ${tsxRelPath}: ${e.message}`);
  }
}

// Parse layers
const layerRegex = /<layer[^>]*name="([^"]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"[^>]*>\s*<data encoding="csv">\s*([\s\S]*?)\s*<\/data>\s*<\/layer>/g;
const layers = [];
let match;
while ((match = layerRegex.exec(tmx)) !== null) {
  const [, name, lw, lh, csvData] = match;
  const data = csvData.split(",").map((s) => parseInt(s.trim()));

  // Determine layer role
  let layerName = name.toLowerCase();
  // Map the example map's layer names to our convention
  if (layerName === "ground") layerName = "ground";
  else if (layerName === "collision") layerName = "collision";
  else layerName = name; // keep original

  layers.push({
    name: layerName,
    type: "tilelayer",
    width: parseInt(lw),
    height: parseInt(lh),
    visible: true,
    data,
  });
  console.log(`  Layer: ${name} (${lw}x${lh}, ${data.length} tiles)`);
}

// The example map doesn't have a collision layer — generate one
// Mark edges and any tile with a building/tree/rock object as impassable
const hasCollision = layers.some((l) => l.name === "collision");
if (!hasCollision) {
  console.log("  Generating collision layer (all passable — open field map)");
  const collisionData = new Array(width * height).fill(0);
  // Mark border as impassable
  for (let x = 0; x < width; x++) {
    collisionData[x] = 1; // top
    collisionData[(height - 1) * width + x] = 1; // bottom
  }
  for (let y = 0; y < height; y++) {
    collisionData[y * width] = 1; // left
    collisionData[y * width + (width - 1)] = 1; // right
  }
  layers.push({
    name: "collision",
    type: "tilelayer",
    width,
    height,
    visible: false,
    data: collisionData,
  });
}

const output = {
  width,
  height,
  tilewidth: 16,
  tileheight: 16,
  orientation: "orthogonal",
  renderorder: "right-down",
  tilesets,
  layers,
};

writeFileSync(OUT_PATH, JSON.stringify(output));
console.log(`\nWrote ${OUT_PATH} (${tilesets.length} tilesets, ${layers.length} layers)`);
