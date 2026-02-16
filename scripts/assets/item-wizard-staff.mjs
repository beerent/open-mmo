/**
 * Generate wizard staff item sprites: icon.png + world.png.
 * Both 16x16 pixel art.
 *
 * Output: sprites/items/wizard_staff/icon.png, sprites/items/wizard_staff/world.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(() => {
  // Staff color palette (matching wizard-directions.mjs)
  const STAFF_LIGHT = [203, 195, 188]; // tip / highlights
  const STAFF_MID   = [124, 108, 94];  // shaft
  const STAFF_DARK  = [71, 55, 43];    // shadow
  const STAFF_KNOB  = [147, 45, 139];  // purple crystal at top
  const STAFF_GLOW  = [200, 120, 220]; // crystal glow
  const OUTLINE     = [20, 20, 18];

  function setPixel(data, x, y, w, color) {
    if (x < 0 || x >= w || y < 0 || y >= w) return;
    const i = (y * w + x) * 4;
    data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = 255;
  }

  // === Icon (16x16) — vertical staff for inventory ===
  const icon = createCanvas('icon', 16, 16);
  const ictx = icon.getContext('2d');
  const idata = ictx.createImageData(16, 16);
  const id = idata.data;

  // Vertical staff, centered at x=7-8, from y=1 to y=14
  // Crystal at top (y=1-3)
  setPixel(id, 7, 1, 16, STAFF_GLOW);
  setPixel(id, 8, 1, 16, STAFF_GLOW);
  setPixel(id, 6, 2, 16, OUTLINE);
  setPixel(id, 7, 2, 16, STAFF_KNOB);
  setPixel(id, 8, 2, 16, STAFF_KNOB);
  setPixel(id, 9, 2, 16, OUTLINE);
  setPixel(id, 6, 3, 16, OUTLINE);
  setPixel(id, 7, 3, 16, STAFF_KNOB);
  setPixel(id, 8, 3, 16, STAFF_GLOW);
  setPixel(id, 9, 3, 16, OUTLINE);
  setPixel(id, 7, 4, 16, OUTLINE);
  setPixel(id, 8, 4, 16, OUTLINE);

  // Shaft (y=5 to y=13)
  for (let y = 5; y <= 13; y++) {
    setPixel(id, 7, y, 16, STAFF_MID);
    setPixel(id, 8, y, 16, STAFF_DARK);
  }
  // Highlight on shaft
  setPixel(id, 7, 5, 16, STAFF_LIGHT);
  setPixel(id, 7, 6, 16, STAFF_LIGHT);

  // Bottom nub
  setPixel(id, 7, 14, 16, STAFF_DARK);
  setPixel(id, 8, 14, 16, STAFF_DARK);

  ictx.putImageData(idata, 0, 0);

  // === World sprite (16x16) — staff lying diagonal on ground ===
  const world = createCanvas('world', 16, 16);
  const wctx = world.getContext('2d');
  const wdata = wctx.createImageData(16, 16);
  const wd = wdata.data;

  // Diagonal staff from bottom-left to upper-right
  // Crystal end at upper-right
  const staffPixels = [
    // shaft (bottom-left to upper-right)
    [2, 13, STAFF_DARK],
    [3, 12, STAFF_MID],
    [4, 11, STAFF_MID],
    [5, 10, STAFF_MID],
    [6, 9,  STAFF_MID],
    [7, 8,  STAFF_LIGHT],
    [8, 7,  STAFF_LIGHT],
    [9, 6,  STAFF_MID],
    [10, 5, STAFF_MID],
    [11, 4, STAFF_MID],
    // crystal
    [12, 3, OUTLINE],
    [11, 3, STAFF_KNOB],
    [12, 2, STAFF_KNOB],
    [13, 3, STAFF_GLOW],
    [12, 4, OUTLINE],
    [13, 2, STAFF_GLOW],
  ];

  for (const [x, y, color] of staffPixels) {
    setPixel(wd, x, y, 16, color);
  }

  wctx.putImageData(wdata, 0, 0);
});

await saveCanvas(page, '#icon', 'apps/client/public/assets/sprites/items/wizard_staff/icon.png');
await saveCanvas(page, '#world', 'apps/client/public/assets/sprites/items/wizard_staff/world.png');
await savePreview(page, ['#icon', '#world'], '/tmp/wizard-staff-items-preview.png');

console.log('\n[item-wizard-staff] Done! Preview at /tmp/wizard-staff-items-preview.png');
await cleanup();
