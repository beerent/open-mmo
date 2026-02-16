---
name: asset-design
description: Create, composite, and edit pixel-art game assets (sprites, tiles, buildings). Use when the user wants to generate new character sprites, recolor tiles, create terrain, or modify any visual game asset.
argument-hint: [description of asset to create or modify]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Shireland Asset Designer

You are creating or editing pixel-art game assets using a Playwright-based canvas compositing tool.

## Context Files (read as needed)

1. **Tile Catalog** — GID ranges and visual descriptions:
   `~/.claude/projects/-Users-thedevdad-Documents-shireland/memory/TILE-CATALOG.md`

2. **Memory** — Project conventions and sprite notes:
   `~/.claude/projects/-Users-thedevdad-Documents-shireland/memory/MEMORY.md`

## Tool: Asset Studio

`scripts/asset-studio.mjs` — Playwright-based canvas environment for asset creation.

```javascript
import { openStudio, saveCanvas, savePreview } from '../../scripts/asset-studio.mjs';

const { page, cleanup } = await openStudio();

// All drawing happens inside page.evaluate():
await page.evaluate(async () => {
  // Load reference images
  const img = await loadImg('/assets/path/to/image.png');

  // Sample colors
  const pixel = getPixel(img, x, y);           // → { r, g, b, a }
  const palette = getPalette(img, x, y, w, h);  // → [{ r, g, b, a, count }]

  // Create output canvas
  const canvas = createCanvas('output', 384, 64);
  const ctx = canvas.getContext('2d');

  // Draw, composite, pixel-manipulate...
  ctx.drawImage(img, 0, 0);
});

// Save results
await saveCanvas(page, '#output', 'apps/client/public/assets/sprites/class/Output.png');
await savePreview(page, ['#output'], '/tmp/asset-preview.png');
await cleanup();
```

### Browser-Side Functions (available inside page.evaluate)

| Function | Description |
|----------|-------------|
| `loadImg(url)` | Load image from `/assets/` path → HTMLImageElement |
| `getPixel(img, x, y)` | Sample one pixel → `{ r, g, b, a }` |
| `getPalette(img, x, y, w, h)` | Get dominant colors in region → sorted array |
| `getImageData(img)` | Get full ImageData for pixel manipulation |
| `createCanvas(id, w, h)` | Create a canvas element on the page |
| `findFrameBounds(imgData, fx, fw, fh)` | Bounding box of opaque pixels in one frame |
| `measureSpriteMetrics(img, fw, fh, count)` | Measure foot Y, head Y, width across frames |
| `shiftAndExpand(srcImg, opts)` | Shift + bulk-expand a sprite sheet (see below) |
| `compareFeaturePalettes(refImg, targetImg, fw, fh, count)` | Compare color groups between reference and target sprites — returns `{ onlyInRef, onlyInTarget, shared, summary }` |
| `auditFeatures(refImg, targetImg, fw, fh, count)` | Wrapper: calls `compareFeaturePalettes` and logs formatted summary via `console.warn` |

## Critical: Sprite Alignment Rules

**Different sprite sources have different positioning within their 64×64 frames.** Failing to account for this creates size/position mismatches between directions.

### The Problem

| Sprite Source | Feet Y Position | Content Width | Vertical Range |
|--------------|-----------------|---------------|----------------|
| NPC sprites (Knight, Wizzard) | ~y63 (frame bottom) | ~24px | y35–y63 |
| Body_A base body | ~y47 (frame middle) | ~15px | y18–y47 |

If you composite equipment onto Body_A and use it as a directional sprite alongside the NPC side-view, the front/back sprites will appear **smaller and floating higher** than the side-view.

### The Fix: `shiftAndExpand()`

**Always** use this function when compositing a different body source onto a new direction:

```javascript
// 1. Measure the reference sprite (the one already used in-game)
const refMetrics = measureSpriteMetrics(knightImg, 64, 64, 6);
const srcMetrics = measureSpriteMetrics(bodyDownImg, 64, 64, 6);

// 2. Compute the shift needed to align feet
const yShift = refMetrics.avgFootY - srcMetrics.avgFootY;

// 3. Shift body down + expand silhouette for equipment bulk
const imgData = shiftAndExpand(bodyDownImg, {
  yShift,                          // align feet to reference
  bulkPasses: 2,                   // 2px of added bulk
  fillColors: [                    // pass 0 = outline, pass 1 = fill
    [20, 20, 18],                  // near-black outline
    [59, 83, 94],                  // dark armor fill
  ],
  sheetW: 384,
  frameW: 64,
  frameH: 64,
  frameCount: 6,
});

// 4. Now recolor the shifted+expanded pixels
const d = imgData.data;
// ... pixel manipulation ...

// 5. Put the result on a canvas
const canvas = createCanvas('output', 384, 64);
canvas.getContext('2d').putImageData(imgData, 0, 0);
```

### Why Separate Buffers Matter

The silhouette expansion works by growing opaque pixels outward 1px per pass. **Each pass MUST use a snapshot of the previous state as its read buffer and write to a fresh copy.** If you read and write the same buffer, newly added pixels cascade within the same pass, creating a flood-fill artifact (a huge dark blob instead of a clean 1px border).

`shiftAndExpand()` handles this correctly. If you implement expansion manually, always follow:
```javascript
for (let pass = 0; pass < N; pass++) {
  const readBuf = current;                        // snapshot (read-only)
  const writeBuf = new Uint8ClampedArray(readBuf); // fresh copy (write target)
  // ... check readBuf neighbors, write to writeBuf ...
  current = writeBuf; // advance
}
```

## Iteration Workflow

For every asset creation/modification:

1. **View reference assets** — Use the Read tool to see existing sprites/tiles as images
2. **Analyze colors/structure** — Run a quick script to sample palettes from reference art
3. **Measure alignment** — Use `measureSpriteMetrics()` on both the reference sprite (already in-game) and the source sprite (being composited). Compute the Y shift needed.
4. **Audit reference features** — Body_A has NO equipment, so every NPC feature must be explicitly drawn.
   1. Run `compareFeaturePalettes(npcRef, bodyBase, 64, 64, 6)` to see which color groups exist in the reference but not the base body
   2. Map each "onlyInRef" color group to a visual feature (e.g., "white/near-white" → beard, "purple/violet" → robe, "warm-orange" → hat brim)
   3. Document as a **FEATURE MANIFEST** comment in the script header listing every feature and its color constants
   4. Use the manifest as a checklist when implementing drawing code — every listed feature must have corresponding draw logic
5. **Write generation script** — Create `scripts/assets/<name>.mjs` importing asset-studio
6. **Run it** — Outputs PNG file(s) + preview to `/tmp/`
   ```bash
   node scripts/assets/<name>.mjs
   ```
7. **View preview** — Read `/tmp/<name>-preview.png` to visually inspect output
8. **Compare side-by-side** — The preview shows reference + new sprites at 1x/4x/8x. Check that:
   - Feet align at the same Y position across directions
   - Character width/bulk is comparable across directions
   - Colors are consistent with the reference
   - Run `auditFeatures(refSide, generatedDown, 64, 64, 6)` to verify no major color groups are missing from the output. Any "onlyInRef" entries indicate features that may not have been drawn.
9. **Test in-game** — Use Playwright to walk in all 4 directions and screenshot:
   ```bash
   node scripts/assets/test-directions.mjs
   ```
10. **Iterate** — Adjust drawing code, re-run, re-inspect until quality matches

## Asset Conventions

| Asset Type | Frame Size | Sheet Format |
|------------|-----------|--------------|
| Character sprites | 64×64 px | 384×64 (6 frames horizontal) |
| Walk cycle | 64×64 px | 256×64 (4 frames: indices 0,1,3,4 from run) |
| Idle sprites | 32×32 px | 128×32 (4 frames horizontal) |
| Map tiles | 16×16 px | Varies by tileset |

- Always use nearest-neighbor scaling (no anti-aliasing)
- Characters: feet aligned to bottom of frame
- Sprite sheets: frames arranged horizontally, left to right
- **New directional sprites must match the existing side-view's position/scale in-frame**

## Reference Asset Locations

### Character Base Body (all 3 directions)
```
assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/
├── Run_Base/     Run_{Down,Side,Up}-Sheet.png   (384×64, 6 frames)
├── Idle_Base/    Idle_{Down,Side,Up}-Sheet.png   (128×32, 4 frames)
├── Walk_Base/    Walk_{Down,Side,Up}-Sheet.png
├── Death_Base/   Death_{Down,Side,Up}-Sheet.png
└── ... (14 animation types total)
```

### NPC Sprites (side-view only)
```
assets/Art/Pixel Crawler/Entities/Npc's/
├── Knight/   Run/, Idle/, Death/ — Run-Sheet.png (384×64, 6 frames)
└── Wizzard/  Run/, Idle/, Death/ — Run-Sheet.png (384×64, 6 frames)
```

### In-Game Sprites (what the client loads)
```
assets/sprites/
├── warrior/  Run.png, Run_Down.png, Run_Up.png, Idle.png
└── wizard/   Run.png, Run_Down.png, Run_Up.png, Idle.png
```

### Other Art Assets
```
assets/Art/Buildings/          Building atlas sheets
assets/tilesets/               Map tilesets (16×16 tiles)
assets/Art/Pixel Crawler/      Full Pixel Crawler asset pack
```

## Testing Script

`scripts/assets/test-directions.mjs` — Playwright script that joins the game, walks in all 4 directions, and saves screenshots to `/tmp/test-dir-{down,right,up,left}.png`. Requires server (:4000) and client (:4001) running.

## Common Pitfalls

### Direction Feature Mismatch

Body_A is a **naked base body** — it has skin, eyes, and an outline, but **no equipment features at all** (no hat, no beard, no staff, no armor, no robe). When generating front/back sprites by compositing onto Body_A, you must **manually draw every single feature** that appears in the NPC reference sprite. It is not enough to just recolor Body_A — features like beards, staffs, armor plates, and hats don't exist in the base and must be explicitly added with drawing code.

**How to prevent:** Follow step 4 (Audit reference features) to create a FEATURE MANIFEST before writing drawing code. Use `compareFeaturePalettes()` to identify color groups present in the NPC reference but absent from Body_A. Each missing group typically maps to a visual feature that needs to be drawn.

**How to catch:** After generating sprites, run `auditFeatures()` (step 8) to verify all reference color groups appear in the output. Any "onlyInRef" entries are likely missing features.

## Tips

- The Body_A base body has skin-tone pixels. Equipment sprites overlay or replace these.
- When compositing equipment onto a different body direction, sample colors from the
  side-view NPC sprite and paint them onto the base body pose.
- Use `getImageData()` + manual pixel loops for precise color replacement.
- For pixel art, work at 1x resolution — never scale up during drawing, only for preview.
- Test that sprites look correct at actual game size (tiny) as well as zoomed in.
- **Always measure and align before compositing** — never assume two sprite sources share the same frame positioning.

## User Request

$ARGUMENTS
