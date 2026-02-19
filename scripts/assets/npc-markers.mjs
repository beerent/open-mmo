/**
 * Generate 16x16 marker tiles for Tiled from existing character sprites.
 *
 * Takes frame 0 of each Run_Down.png (front-facing), crops to bounding box,
 * and scales down to 16x16 with nearest-neighbor for a pixel-art thumbnail.
 *
 * Output:
 *   sprites/markers/spawn_player.png   — warrior thumbnail (player spawn)
 *   sprites/markers/npc_guard.png      — guard thumbnail
 *   sprites/markers/npc_elder.png      — elder thumbnail
 *   sprites/markers/npc_merchant.png   — merchant thumbnail
 *   sprites/markers/npc_villager.png   — villager thumbnail
 *   sprites/markers/route_N.png        — colored dot (route waypoint, N=0..9)
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const MARKERS = [
  { id: 'spawn_player',  src: '/assets/sprites/warrior/Run_Down.png' },
  { id: 'npc_guard',     src: '/assets/sprites/npcs/guard/Run_Down.png' },
  { id: 'npc_elder',     src: '/assets/sprites/npcs/elder/Run_Down.png' },
  { id: 'npc_merchant',  src: '/assets/sprites/npcs/merchant/Run_Down.png' },
  { id: 'npc_villager',  src: '/assets/sprites/npcs/villager/Run_Down.png' },
];

const { page, cleanup } = await openStudio();

// Generate character thumbnails
for (const marker of MARKERS) {
  await page.evaluate(async ({ id, src }) => {
    const img = await loadImg(src);

    // Extract frame 0 (64x64) from the sprite sheet
    const frameW = 64, frameH = 64;
    const frame = document.createElement('canvas');
    frame.width = frameW;
    frame.height = frameH;
    const fctx = frame.getContext('2d');
    fctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW, frameH);
    const frameData = fctx.getImageData(0, 0, frameW, frameH);

    // Find bounding box of non-transparent pixels
    let minX = frameW, minY = frameH, maxX = 0, maxY = 0;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        if (frameData.data[(y * frameW + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Scale the cropped region into 16x16 using nearest-neighbor
    const out = createCanvas(id, 16, 16);
    const octx = out.getContext('2d');
    const outData = octx.createImageData(16, 16);
    const od = outData.data;

    for (let dy = 0; dy < 16; dy++) {
      for (let dx = 0; dx < 16; dx++) {
        // Map output pixel to source pixel (nearest-neighbor)
        const sx = minX + Math.floor((dx + 0.5) * cropW / 16);
        const sy = minY + Math.floor((dy + 0.5) * cropH / 16);
        const si = (sy * frameW + sx) * 4;
        const di = (dy * 16 + dx) * 4;
        od[di]     = frameData.data[si];
        od[di + 1] = frameData.data[si + 1];
        od[di + 2] = frameData.data[si + 2];
        od[di + 3] = frameData.data[si + 3];
      }
    }

    octx.putImageData(outData, 0, 0);
  }, marker);

  await saveCanvas(page, `#${marker.id}`, `apps/client/public/assets/sprites/markers/${marker.id}.png`);
  console.log(`[npc-markers] Generated ${marker.id}`);
}

// Generate 10 colored route markers — plain colored dots
const ROUTE_COLORS = [
  { name: 'red',     fill: [255, 68, 68],    outline: [160, 20, 20],  hi: [255, 170, 170] },
  { name: 'orange',  fill: [255, 136, 0],    outline: [180, 80, 0],   hi: [255, 200, 140] },
  { name: 'gold',    fill: [255, 200, 0],    outline: [180, 100, 0],  hi: [255, 240, 160] },
  { name: 'yellow',  fill: [255, 255, 68],   outline: [160, 160, 20], hi: [255, 255, 180] },
  { name: 'green',   fill: [68, 255, 68],    outline: [20, 140, 20],  hi: [180, 255, 180] },
  { name: 'cyan',    fill: [68, 255, 255],   outline: [20, 140, 160], hi: [180, 255, 255] },
  { name: 'blue',    fill: [60, 140, 255],   outline: [20, 60, 160],  hi: [160, 210, 255] },
  { name: 'purple',  fill: [136, 68, 255],   outline: [70, 20, 160],  hi: [200, 170, 255] },
  { name: 'magenta', fill: [255, 68, 255],   outline: [160, 20, 160], hi: [255, 180, 255] },
  { name: 'pink',    fill: [255, 136, 170],  outline: [160, 60, 90],  hi: [255, 210, 220] },
];

for (let ci = 0; ci < ROUTE_COLORS.length; ci++) {
  const rc = ROUTE_COLORS[ci];
  const canvasId = `route_${ci}`;
  await page.evaluate(({ id, fill, outline, hi }) => {
    const c = createCanvas(id, 16, 16);
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(16, 16);
    const d = imgData.data;

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4.8) continue;
        const i = (y * 16 + x) * 4;
        const norm = dist / 4.8;
        if (norm > 0.78) {
          d[i] = outline[0]; d[i+1] = outline[1]; d[i+2] = outline[2];
        } else if (dx < -0.5 && dy < -0.5 && dist < 2) {
          d[i] = hi[0]; d[i+1] = hi[1]; d[i+2] = hi[2];
        } else {
          d[i] = fill[0]; d[i+1] = fill[1]; d[i+2] = fill[2];
        }
        d[i+3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, { id: canvasId, fill: rc.fill, outline: rc.outline, hi: rc.hi });

  await saveCanvas(page, `#${canvasId}`, `apps/client/public/assets/sprites/markers/${canvasId}.png`);
  console.log(`[npc-markers] Generated ${canvasId} (${rc.name})`);
}

const routeIds = Array.from({ length: 10 }, (_, i) => `#route_${i}`);
const allIds = [...MARKERS.map(m => `#${m.id}`), ...routeIds];
await savePreview(page, allIds, '/tmp/npc-markers-preview.png');

console.log('\n[npc-markers] Done! Preview at /tmp/npc-markers-preview.png');
await cleanup();
