/**
 * Generate wizard staff equipment overlay sprites.
 * These are transparent 384x64 sprite sheets (6 frames of 64x64) where ONLY
 * the staff pixels are drawn. They get composited on top of any character body.
 *
 * For the side view: extract staff pixels from the existing Wizzard Run-Sheet.
 * For front/back: draw a vertical staff procedurally at the correct position.
 *
 * Output:
 *   sprites/items/wizard_staff/equip/Run.png      (side view)
 *   sprites/items/wizard_staff/equip/Run_Down.png  (front view)
 *   sprites/items/wizard_staff/equip/Run_Up.png    (back view)
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(async () => {
  const wizardSide = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Wizzard/Run/Run-Sheet.png");

  const FRAMES = 6;
  const FW = 64, FH = 64;
  const SHEET_W = FRAMES * FW;

  // Staff colors
  const STAFF_LIGHT = [203, 195, 188];
  const STAFF_MID   = [124, 108, 94];
  const STAFF_DARK  = [71, 55, 43];
  const OUTLINE     = [20, 20, 18];

  function setPixel(data, x, y, sheetW, color) {
    if (x < 0 || y < 0 || y >= FH) return;
    const i = (y * sheetW + x) * 4;
    data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = 255;
  }

  function colorMatch(data, i, target, tol = 12) {
    return Math.abs(data[i] - target[0]) <= tol &&
           Math.abs(data[i+1] - target[1]) <= tol &&
           Math.abs(data[i+2] - target[2]) <= tol &&
           data[i+3] > 128;
  }

  // === Side view: extract staff-only pixels from Wizzard Run-Sheet ===
  // The staff in the NPC sprite is the thin vertical element on the right side.
  // Staff colors: STAFF_LIGHT and STAFF_MID (grays/browns)
  const sideCanvas = createCanvas('equip-side', SHEET_W, FH);
  const sideCtx = sideCanvas.getContext('2d');

  // Read original wizard sprite
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = SHEET_W; srcCanvas.height = FH;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(wizardSide, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, SHEET_W, FH);
  const sd = srcData.data;

  // Create output — only staff pixels
  const sideData = sideCtx.createImageData(SHEET_W, FH);
  const sid = sideData.data;

  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * FW;

    // Find the body bounds to know where the staff is (rightmost pixels)
    let bodyMaxX = 0, bodyMinY = FH, bodyMaxY = 0;
    for (let y = 0; y < FH; y++) {
      for (let lx = 0; lx < FW; lx++) {
        const i = (y * SHEET_W + fx + lx) * 4;
        if (sd[i+3] > 0) {
          bodyMaxX = Math.max(bodyMaxX, lx);
          bodyMinY = Math.min(bodyMinY, y);
          bodyMaxY = Math.max(bodyMaxY, y);
        }
      }
    }

    // Extract staff-colored pixels.
    // The staff is the right-side thin vertical element.
    // We look for staff colors in the right ~1/3 of the sprite.
    for (let y = 0; y < FH; y++) {
      for (let lx = Math.floor(FW * 0.5); lx < FW; lx++) {
        const x = fx + lx;
        const i = (y * SHEET_W + x) * 4;
        if (sd[i+3] === 0) continue;

        if (colorMatch(sd, i, STAFF_LIGHT) || colorMatch(sd, i, STAFF_MID)) {
          // Copy this pixel to the overlay
          sid[i]   = sd[i];
          sid[i+1] = sd[i+1];
          sid[i+2] = sd[i+2];
          sid[i+3] = sd[i+3];
        }
      }
    }
  }

  sideCtx.putImageData(sideData, 0, 0);

  // === Front view (down): draw staff on right side procedurally ===
  const downCanvas = createCanvas('equip-down', SHEET_W, FH);
  const downCtx = downCanvas.getContext('2d');
  const downData = downCtx.createImageData(SHEET_W, FH);
  const dd = downData.data;

  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * FW;
    // Staff positioned at x ~= 44-45 (right of body center ~32), from y=8 to y=60
    // Slight bob for walk animation
    const bob = (frame % 2 === 0) ? 0 : 1;
    const staffX = fx + 44;
    const staffTop = 8 + bob;
    const staffBot = 60 + bob;

    for (let y = staffTop; y <= staffBot && y < FH; y++) {
      if (y <= staffTop + 2) {
        setPixel(dd, staffX, y, SHEET_W, STAFF_LIGHT);
      } else if (y >= staffBot - 2) {
        setPixel(dd, staffX, y, SHEET_W, STAFF_DARK);
      } else {
        setPixel(dd, staffX, y, SHEET_W, STAFF_MID);
      }
    }
  }

  downCtx.putImageData(downData, 0, 0);

  // === Back view (up): same positioning, slightly different x for visual variety ===
  const upCanvas = createCanvas('equip-up', SHEET_W, FH);
  const upCtx = upCanvas.getContext('2d');
  const upData = upCtx.createImageData(SHEET_W, FH);
  const ud = upData.data;

  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * FW;
    const bob = (frame % 2 === 0) ? 0 : 1;
    const staffX = fx + 43;
    const staffTop = 8 + bob;
    const staffBot = 58 + bob;

    for (let y = staffTop; y <= staffBot && y < FH; y++) {
      if (y <= staffTop + 2) {
        setPixel(ud, staffX, y, SHEET_W, STAFF_LIGHT);
      } else if (y >= staffBot - 2) {
        setPixel(ud, staffX, y, SHEET_W, STAFF_DARK);
      } else {
        setPixel(ud, staffX, y, SHEET_W, STAFF_MID);
      }
    }
  }

  upCtx.putImageData(upData, 0, 0);
});

await saveCanvas(page, '#equip-side', 'apps/client/public/assets/sprites/items/wizard_staff/equip/Run.png');
await saveCanvas(page, '#equip-down', 'apps/client/public/assets/sprites/items/wizard_staff/equip/Run_Down.png');
await saveCanvas(page, '#equip-up', 'apps/client/public/assets/sprites/items/wizard_staff/equip/Run_Up.png');
await savePreview(page, ['#equip-side', '#equip-down', '#equip-up'], '/tmp/wizard-staff-equip-preview.png');

console.log('\n[equipment-wizard-staff] Done! Preview at /tmp/wizard-staff-equip-preview.png');
await cleanup();
