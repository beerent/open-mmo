/**
 * Convert Tiled .tmj output back to our game's town.json format.
 * Handles external .tsx tileset references, embedded tilesets,
 * atlas tilesets, and image collection tilesets.
 *
 * Auto-generates collision from tsx-defined tile shapes, with manual
 * override layers ("collision" to force blocked, "passable" to force open).
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';

const mapsDir = resolve(import.meta.dirname, '../apps/client/public/assets/maps');
const assetsDir = resolve(import.meta.dirname, '../apps/client/public/assets');
const tmjPath = resolve(mapsDir, 'town.tmj');
const outPath = resolve(mapsDir, 'town.json');

const map = JSON.parse(readFileSync(tmjPath, 'utf-8'));

// Tiled encodes flip flags in the high bits of GIDs
const GID_MASK = 0x1FFFFFFF;

/**
 * Resolve a relative image path to a web-accessible /assets/... path.
 * Works for both tsx-relative and tmj-relative paths.
 */
function toWebPath(relativePath, fromDir) {
  const abs = resolve(fromDir, relativePath);
  const rel = relative(assetsDir, abs);
  return '/assets/' + rel.replace(/\\/g, '/');
}

/**
 * Parse collision shapes from tsx XML content.
 * Returns Map<localTileId, Shape[]> where shapes have world-relative coords
 * within the tile's own image space.
 */
function parseCollisionShapes(content) {
  const shapes = new Map();

  // Match all <tile id="N">...</tile> blocks
  const tileBlockRegex = /<tile\s+id="(\d+)"[^>]*>([\s\S]*?)<\/tile>/g;
  let match;

  while ((match = tileBlockRegex.exec(content)) !== null) {
    const tileId = parseInt(match[1]);
    const tileBody = match[2];

    // Look for <objectgroup> within this tile
    const objGroupMatch = tileBody.match(/<objectgroup[\s\S]*?<\/objectgroup>/);
    if (!objGroupMatch) continue;

    const objGroupContent = objGroupMatch[0];
    const tileShapes = [];

    // Parse <object> elements — self-closing (rectangles) or with children (polygon/ellipse)
    const objectRegex = /<object\s([^>]*)(?:\/>|>([\s\S]*?)<\/object>)/g;
    let objMatch;

    while ((objMatch = objectRegex.exec(objGroupContent)) !== null) {
      const attrs = objMatch[1];
      const children = objMatch[2] || '';

      const x = parseFloat(attrs.match(/x="([^"]+)"/)?.[1] || '0');
      const y = parseFloat(attrs.match(/y="([^"]+)"/)?.[1] || '0');
      const w = parseFloat(attrs.match(/width="([^"]+)"/)?.[1] || '0');
      const h = parseFloat(attrs.match(/height="([^"]+)"/)?.[1] || '0');

      if (children.includes('<polygon')) {
        const pointsMatch = children.match(/<polygon\s+points="([^"]+)"/);
        if (pointsMatch) {
          const points = pointsMatch[1].split(/\s+/).map(p => {
            const [px, py] = p.split(',').map(Number);
            return { x: x + px, y: y + py };
          });
          tileShapes.push({ type: 'polygon', points });
        }
      } else if (children.includes('<ellipse')) {
        // Treat ellipse as its bounding rectangle
        tileShapes.push({ type: 'rect', x, y, width: w, height: h });
      } else if (w > 0 && h > 0) {
        // Rectangle
        tileShapes.push({ type: 'rect', x, y, width: w, height: h });
      }
    }

    if (tileShapes.length > 0) {
      shapes.set(tileId, tileShapes);
    }
  }

  return shapes;
}

/**
 * Parse a .tsx file (XML) and extract tileset info + collision shapes.
 */
function parseTsx(tsxPath) {
  const content = readFileSync(tsxPath, 'utf-8');
  const tsxDir = dirname(tsxPath);

  const nameMatch = content.match(/name="([^"]+)"/);
  const tilewidthMatch = content.match(/tilewidth="(\d+)"/);
  const tileheightMatch = content.match(/tileheight="(\d+)"/);
  const tilecountMatch = content.match(/tilecount="(\d+)"/);
  const columnsMatch = content.match(/columns="(\d+)"/);

  const name = nameMatch?.[1] || 'unknown';
  const tilewidth = parseInt(tilewidthMatch?.[1] || '16');
  const tileheight = parseInt(tileheightMatch?.[1] || '16');
  const tilecount = parseInt(tilecountMatch?.[1] || '0');
  const columns = parseInt(columnsMatch?.[1] || '0');

  // Parse collision shapes from all tile blocks
  const collisionShapes = parseCollisionShapes(content);

  // Helper to extract attributes from an <image> tag regardless of order
  function parseImageTag(tag) {
    const src = tag.match(/source="([^"]+)"/);
    const w = tag.match(/width="(\d+)"/);
    const h = tag.match(/height="(\d+)"/);
    if (!src) return null;
    return { source: src[1], width: parseInt(w?.[1] || '0'), height: parseInt(h?.[1] || '0') };
  }

  // Check for single atlas image (not inside a <tile>)
  const topLevelImage = content.match(/<tileset[^>]*>[\s\S]*?(<image\s[^>]+\/>)/);
  let imageMatch = null;
  if (topLevelImage) {
    // Make sure this image is NOT inside a <tile> block
    const beforeImage = content.slice(0, content.indexOf(topLevelImage[1]));
    const tileOpens = (beforeImage.match(/<tile\b/g) || []).length;
    const tileCloses = (beforeImage.match(/<\/tile>/g) || []).length;
    if (tileOpens === tileCloses) {
      imageMatch = parseImageTag(topLevelImage[1]);
    }
  }

  // Check if it's an image collection (multiple <tile id="N"><image .../> entries)
  const tileBlockRegex = /<tile\s+id="(\d+)"[^>]*>\s*\n?\s*<image\s([^>]+)\/>/g;
  const tiles = [];
  let m;
  while ((m = tileBlockRegex.exec(content)) !== null) {
    const parsed = parseImageTag('<image ' + m[2] + '/>');
    if (parsed) {
      tiles.push({
        id: parseInt(m[1]),
        image: toWebPath(parsed.source, tsxDir),
        imagewidth: parsed.width,
        imageheight: parsed.height,
      });
    }
  }

  const base = { name, tilewidth, tileheight, tilecount, columns, collisionShapes };

  if (tiles.length > 0) {
    // Image collection tileset — store per-tile image dimensions for object collision
    const tileImageDims = new Map();
    for (const t of tiles) {
      tileImageDims.set(t.id, { width: t.imagewidth, height: t.imageheight });
    }
    return { ...base, tiles, tileImageDims };
  } else if (imageMatch) {
    return {
      ...base,
      image: toWebPath(imageMatch.source, tsxDir),
      imagewidth: imageMatch.width,
      imageheight: imageMatch.height,
    };
  }

  return base;
}

// ─── Process all tilesets ───────────────────────────────────────────

const tilesets = [];
// Parallel array: collision metadata per tileset (not included in output)
const tilesetMeta = [];

for (const ts of map.tilesets) {
  if (ts.source) {
    // External tileset — read from .tsx file
    const tsxPath = resolve(mapsDir, ts.source);
    try {
      const parsed = parseTsx(tsxPath);
      tilesetMeta.push({
        firstgid: ts.firstgid,
        tilecount: parsed.tilecount,
        collisionShapes: parsed.collisionShapes,
        tileImageDims: parsed.tileImageDims || null,
      });
      if (parsed.tiles) {
        tilesets.push({
          firstgid: ts.firstgid,
          name: parsed.name,
          tilewidth: parsed.tilewidth,
          tileheight: parsed.tileheight,
          tilecount: parsed.tilecount,
          columns: parsed.columns,
          tiles: parsed.tiles,
        });
      } else if (parsed.image) {
        tilesets.push({
          firstgid: ts.firstgid,
          name: parsed.name,
          image: parsed.image,
          imagewidth: parsed.imagewidth,
          imageheight: parsed.imageheight,
          tilewidth: parsed.tilewidth,
          tileheight: parsed.tileheight,
          tilecount: parsed.tilecount,
          columns: parsed.columns,
        });
      }
    } catch (e) {
      console.warn(`WARNING: Failed to read ${ts.source}: ${e.message}`);
    }
  } else if (ts.tiles && !ts.image) {
    // Embedded image collection
    tilesetMeta.push({ firstgid: ts.firstgid, tilecount: ts.tilecount, collisionShapes: new Map() });
    tilesets.push({
      firstgid: ts.firstgid,
      name: ts.name,
      tilewidth: ts.tilewidth || 16,
      tileheight: ts.tileheight || 16,
      tilecount: ts.tilecount,
      columns: ts.columns || 0,
      tiles: ts.tiles.map(t => ({
        id: t.id,
        image: toWebPath(t.image, mapsDir),
        imagewidth: t.imagewidth,
        imageheight: t.imageheight,
      })),
    });
  } else if (ts.image) {
    // Embedded atlas
    tilesetMeta.push({ firstgid: ts.firstgid, tilecount: ts.tilecount, collisionShapes: new Map() });
    tilesets.push({
      firstgid: ts.firstgid,
      name: ts.name,
      image: toWebPath(ts.image, mapsDir),
      imagewidth: ts.imagewidth,
      imageheight: ts.imageheight,
      tilewidth: ts.tilewidth || 16,
      tileheight: ts.tileheight || 16,
      tilecount: ts.tilecount,
      columns: ts.columns,
    });
  }
}

// ─── Build global collision lookup: GID → shapes ────────────────────

const collisionLookup = new Map();

for (const meta of tilesetMeta) {
  if (!meta.collisionShapes || meta.collisionShapes.size === 0) continue;
  for (const [localId, shapes] of meta.collisionShapes) {
    const gid = meta.firstgid + localId;
    collisionLookup.set(gid, { shapes });
  }
}

// ─── Generate collision grid ────────────────────────────────────────

const { width, height, tilewidth: tw, tileheight: th } = map;
const collisionGrid = new Array(width * height).fill(0);

let autoTileCount = 0;
let autoObjectCount = 0;
let manualBlockedCount = 0;
let manualPassableCount = 0;

// Source 1: Auto from tile layers
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer' || !layer.data) continue;
  if (layer.name === 'collision' || layer.name === 'passable') continue;

  for (let i = 0; i < layer.data.length; i++) {
    const gid = layer.data[i] & GID_MASK;
    if (gid === 0) continue;
    if (collisionLookup.has(gid)) {
      if (collisionGrid[i] === 0) autoTileCount++;
      collisionGrid[i] = 1;
    }
  }
}

// Source 2: Auto from object layers
for (const layer of map.layers) {
  if (layer.type !== 'objectgroup') continue;

  for (const obj of layer.objects || []) {
    if (!obj.gid) continue;
    const gid = obj.gid & GID_MASK;
    if (!collisionLookup.has(gid)) continue;

    const info = collisionLookup.get(gid);
    const objTopX = obj.x;
    const objTopY = obj.y - obj.height; // Tiled y = bottom of object

    for (const shape of info.shapes) {
      let minX, minY, maxX, maxY;

      if (shape.type === 'rect') {
        minX = objTopX + shape.x;
        minY = objTopY + shape.y;
        maxX = minX + shape.width;
        maxY = minY + shape.height;
      } else if (shape.type === 'polygon') {
        const xs = shape.points.map(p => objTopX + p.x);
        const ys = shape.points.map(p => objTopY + p.y);
        minX = Math.min(...xs);
        minY = Math.min(...ys);
        maxX = Math.max(...xs);
        maxY = Math.max(...ys);
      } else {
        continue;
      }

      // Convert pixel bounds to grid cells
      const col0 = Math.max(0, Math.floor(minX / tw));
      const row0 = Math.max(0, Math.floor(minY / th));
      const col1 = Math.min(width - 1, Math.floor((maxX - 0.001) / tw));
      const row1 = Math.min(height - 1, Math.floor((maxY - 0.001) / th));

      for (let r = row0; r <= row1; r++) {
        for (let c = col0; c <= col1; c++) {
          if (collisionGrid[r * width + c] === 0) autoObjectCount++;
          collisionGrid[r * width + c] = 1;
        }
      }
    }
  }
}

// Source 3a: Manual "collision" layer — force blocked
const manualCollisionLayer = map.layers.find(
  l => l.name === 'collision' && l.type === 'tilelayer' && l.data
);
if (manualCollisionLayer) {
  for (let i = 0; i < manualCollisionLayer.data.length; i++) {
    if (manualCollisionLayer.data[i] !== 0) {
      if (collisionGrid[i] === 0) manualBlockedCount++;
      collisionGrid[i] = 1;
    }
  }
}

// Source 3b: Manual "passable" layer — force passable (overrides everything above)
const manualPassableLayer = map.layers.find(
  l => l.name === 'passable' && l.type === 'tilelayer' && l.data
);
if (manualPassableLayer) {
  for (let i = 0; i < manualPassableLayer.data.length; i++) {
    if (manualPassableLayer.data[i] !== 0) {
      if (collisionGrid[i] === 1) manualPassableCount++;
      collisionGrid[i] = 0;
    }
  }
}

// Border collision — all edge tiles blocked
for (let x = 0; x < width; x++) {
  collisionGrid[x] = 1;                         // top row
  collisionGrid[(height - 1) * width + x] = 1;  // bottom row
}
for (let y = 0; y < height; y++) {
  collisionGrid[y * width] = 1;                  // left col
  collisionGrid[y * width + (width - 1)] = 1;    // right col
}

// ─── Process layers (exclude collision/passable from visual output) ─

const layers = map.layers
  .filter(l => {
    if (l.name === 'collision' || l.name === 'passable') return false;
    return (l.type === 'tilelayer' && l.data) || (l.type === 'objectgroup' && l.objects);
  })
  .map(l => {
    if (l.type === 'objectgroup') {
      return {
        name: l.name,
        type: l.type,
        width: map.width,
        height: map.height,
        visible: l.visible !== false,
        objects: l.objects.map(o => ({
          gid: o.gid,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
        })),
      };
    }
    return {
      name: l.name,
      type: l.type,
      width: l.width,
      height: l.height,
      visible: l.visible !== false,
      data: l.data,
    };
  });

// Inject generated collision layer
layers.push({
  name: 'collision',
  type: 'tilelayer',
  width,
  height,
  visible: true,
  data: collisionGrid,
});

// ─── Write output ───────────────────────────────────────────────────

const output = {
  width: map.width,
  height: map.height,
  tilewidth: map.tilewidth,
  tileheight: map.tileheight,
  orientation: map.orientation || 'orthogonal',
  renderorder: map.renderorder || 'right-down',
  tilesets,
  layers,
};

writeFileSync(outPath, JSON.stringify(output));

const totalBlocked = collisionGrid.filter(v => v === 1).length;
const totalCells = width * height;

console.log(`Converted town.tmj → town.json`);
console.log(`Map: ${output.width}x${output.height}, ${tilesets.length} tilesets, ${layers.length} layers`);
console.log(`Collision: ${totalBlocked}/${totalCells} cells blocked (${Math.round(totalBlocked / totalCells * 100)}%)`);
console.log(`  tsx tile shapes: ${autoTileCount} cells`);
console.log(`  tsx object shapes: ${autoObjectCount} cells`);
console.log(`  manual blocked: ${manualBlockedCount} cells`);
console.log(`  manual passable: ${manualPassableCount} cells`);
console.log(`  tsx tiles with collision data: ${collisionLookup.size}`);
