/**
 * Build the starter map: grass field + cottage + trees + collision borders
 */
import { loadMap, saveMap, fillRect, stampPattern, ensureLayer, fillCollision } from './map-editor.mjs';

const map = loadMap();

// ── 1. Clear everything ──
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer' || !layer.data) continue;
  layer.data.fill(0);
}
console.log('Cleared all layers');

// ── 2. Fill ground with solid grass ──
// Try GID 794 (row 9 col 0 of Tileset_Ground) — should be solid bright green
fillRect(map, 'ground', 0, 0, 40, 40, 794);

// ── 3. Create new layers for buildings and trees ──
ensureLayer(map, 'buildings');
ensureLayer(map, 'trees');

// ── 4. Border collision (can't walk off the map edges — 2 tile thick) ──
fillCollision(map, 0, 0, 40, 2, true);   // top
fillCollision(map, 0, 38, 40, 2, true);  // bottom
fillCollision(map, 0, 0, 2, 40, true);   // left
fillCollision(map, 38, 0, 2, 40, true);  // right

// ── 5. Place small cottage at (17, 14) — near center-north ──
// Buildings.png: 13 cols per row, firstgid=1
// Small cottage occupies rows 0–5, cols 0–6 (7 wide × 6 tall)
const cottage = [
  [1,  2,  3,  4,  5,  6,  7],
  [14, 15, 16, 17, 18, 19, 20],
  [27, 28, 29, 30, 31, 32, 33],
  [40, 41, 42, 43, 44, 45, 46],
  [53, 54, 55, 56, 57, 58, 59],
  [66, 67, 68, 69, 70, 71, 72],
];
stampPattern(map, 'buildings', 17, 14, cottage);

// Collision for cottage — solid except door area at bottom center
fillCollision(map, 17, 14, 7, 6, true);
// Clear door area (roughly center of bottom row, cols 19-21)
fillCollision(map, 19, 19, 3, 1, false);

// ── 6. Place trees ──
// Pine tree: 3 wide × 4 tall (cols 0-2, rows 0-3)
const pine = [
  [5340, 5341, 5342],
  [5364, 5365, 5366],
  [5388, 5389, 5390],
  [5412, 5413, 5414],
];

// Deciduous tree: 2 wide × 4 tall (cols 4-5, rows 0-3)
const deciduous = [
  [5344, 5345],
  [5368, 5369],
  [5392, 5393],
  [5416, 5417],
];

// Large oak: 4 wide × 3 tall (cols 8-11, rows 0-2) — these looked OK
const oak = [
  [5348, 5349, 5350, 5351],
  [5372, 5373, 5374, 5375],
  [5396, 5397, 5398, 5399],
];

// Scatter trees around the map — keep them visible from spawn
const trees = [
  // Near cottage
  { pattern: pine, x: 14, y: 15 },
  { pattern: pine, x: 26, y: 16 },
  // Mid-field
  { pattern: deciduous, x: 10, y: 22 },
  { pattern: deciduous, x: 28, y: 22 },
  { pattern: deciduous, x: 20, y: 28 },
  // Further out
  { pattern: oak, x: 6, y: 10 },
  { pattern: oak, x: 30, y: 10 },
  { pattern: pine, x: 8, y: 32 },
];

for (const t of trees) {
  stampPattern(map, 'trees', t.x, t.y, t.pattern);
  const w = t.pattern[0].length;
  const h = t.pattern.length;
  fillCollision(map, t.x, t.y, w, h, true);
}

saveMap(map);
console.log('Map built: grass field + cottage + 8 trees + collision borders');
