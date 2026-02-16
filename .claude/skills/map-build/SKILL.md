---
name: map-build
description: Iteratively design and edit the Shireland town map. Use when the user wants to add, move, or modify structures, terrain, or zones on the game map.
argument-hint: [description of what to build or change]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Shireland Map Builder

You are editing the Shireland town map through an iterative visual feedback loop.

## Context Files (read these first)

1. **Map Layout** — what's been built and where:
   `~/.claude/projects/-Users-thedevdad-Documents-shireland/memory/MAP-LAYOUT.md`

2. **Tile Catalog** — GID ranges and visual descriptions for all tilesets:
   `~/.claude/projects/-Users-thedevdad-Documents-shireland/memory/TILE-CATALOG.md`

3. **Current map data**:
   `apps/client/public/assets/maps/town.json`

## Tools

- **Map editor utility**: `scripts/map-editor.mjs`
  Functions: `loadMap`, `saveMap`, `setTile`, `getTile`, `fillRect`, `stampPattern`, `clearAllLayers`, `clearRect`, `setCollision`, `fillCollision`, `ensureLayer`, `addLayer`, `resizeMap`, `printMapInfo`, `findTilesInRange`

- **Screenshot script**: `scripts/map-screenshot.mjs [output-path]`
  Takes a Playwright screenshot of the rendered map. Default output: `/tmp/shireland-map.png`

## Workflow

For every map change request:

1. **Read MAP-LAYOUT.md** to understand current state and named areas
2. **Read TILE-CATALOG.md** to find the right GIDs for the requested tiles
3. **Edit the map** using inline Node.js scripts that import from `scripts/map-editor.mjs`:
   ```bash
   node -e "
   import { loadMap, saveMap, fillRect, ensureLayer, fillCollision } from './scripts/map-editor.mjs';
   const map = loadMap();
   // ... edits ...
   saveMap(map);
   "
   ```
4. **Update collision** — buildings, water, and rocks should be impassable
5. **If collision changed**, restart the server:
   ```bash
   lsof -i :4000 -t | xargs kill 2>/dev/null
   sleep 1
   pnpm --filter @shireland/server dev &
   ```
6. **Screenshot** the result:
   ```bash
   node scripts/map-screenshot.mjs
   ```
7. **Show the screenshot** to the user (read `/tmp/shireland-map.png`)
8. **Update MAP-LAYOUT.md** with any new named areas or structures
9. **Iterate** based on user feedback — repeat steps 3–7

## Layer Convention

Layers render bottom-to-top:
1. `ground` — Base terrain (grass, dirt)
2. `Flowers` — Flower overlays
3. `Road` — Stone road tiles
4. `RockSlopes` — Rock slope base
5. `RockSlopes_Auto` — Rock slope autotile details
6. `Water` — Water body
7. `buildings` — Structures (houses, shops, walls) — add with `ensureLayer(map, 'buildings')`
8. `props` — Decorative objects — add with `ensureLayer(map, 'props')`
9. `trees` — Trees and bushes (render above players) — add with `ensureLayer(map, 'trees')`
10. `collision` — Invisible collision (1=blocked, 0=passable)

## Key Tile Reference (quick lookup)

| What | Tileset | GID Range | Notes |
|------|---------|-----------|-------|
| Grass (solid) | Ground | ~740–743 | Wang autotile center |
| Road (solid) | Road | ~5296 | Cobblestone fill |
| Water (solid) | Water | ~5040–5043 | Wang autotile center |
| Buildings | Buildings | 1–442 | Multi-tile structures, 13 cols |
| Props | Props | 484–663 | Signs, barrels, benches |
| Trees | Trees_Bushes | 5340–5483 | Multi-tile, 2×2 or 4×2 |
| Rocks | Rocks | 664–685 | Boulders, pebbles |
| Campfire | Campfire | 5676–5707 | Animated, 2 rows |

## Important Notes

- Buildings are multi-tile — they span many tiles arranged in a grid. Read the Buildings.png image to plan stamp patterns.
- Always update collision when placing solid structures.
- The map is currently 40×40. Use `resizeMap()` if more space is needed.
- Player spawns near center (~20,20). Design the most interesting area there.
- Ensure both client (:4001) and server (:4000) are running before screenshots.
- After editing, always update MAP-LAYOUT.md with what was placed and where.

## User Request

$ARGUMENTS
