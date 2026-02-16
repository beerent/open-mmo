/**
 * Generate warrior front-facing (Down) and back-facing (Up) run sprites
 * by compositing Knight armor colors onto the Body_A base body.
 *
 * Key: Body_A feet are at ~y47 but Knight feet are at ~y63.
 * We shift the body down 16px and add 4-5px of armor bulk to match the Knight silhouette.
 *
 * FEATURE MANIFEST (from reference: Knight Run-Sheet.png):
 *   - Helmet (full head coverage): ARMOR_MID, ARMOR_DARK
 *   - Visor slit (front-facing only): ARMOR_VDARK
 *   - Chest armor: ARMOR_LIGHT, ARMOR_MID, ARMOR_DARK
 *   - Boots (brown): BOOT_MAIN, BOOT_DARK
 *   - Eyes (front-facing only): EYE_WHITE, EYE_GREEN
 *
 * Input:  Body_A Run_Down-Sheet.png, Run_Up-Sheet.png, Knight Run-Sheet.png
 * Output: sprites/warrior/Run_Down.png, Run_Up.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(async () => {
  const bodyDown = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Down-Sheet.png');
  const bodyUp = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Up-Sheet.png');
  const knight = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Knight/Run/Run-Sheet.png");

  const FRAMES = 6;
  const FW = 64, FH = 64;
  const SHEET_W = FRAMES * FW;

  // Knight's feet sit at y≈63, Body_A's feet at y≈47 → shift down 16px
  const Y_SHIFT = 16;

  // === Color definitions ===
  const SKIN_MAIN   = [217, 160, 102];
  const SKIN_SHADOW = [162, 101, 67];
  const SKIN_DARK   = [118, 61, 43];
  const SKIN_LIGHT  = [250, 200, 149];

  const ARMOR_LIGHT  = [138, 198, 224];
  const ARMOR_MID    = [92, 142, 165];
  const ARMOR_DARK   = [59, 83, 94];
  const ARMOR_VDARK  = [36, 42, 54];
  const ARMOR_OUTLINE = [20, 20, 18];
  const BOOT_MAIN    = [181, 108, 48];
  const BOOT_DARK    = [71, 40, 13];

  const EYE_WHITE = [255, 252, 252];
  const EYE_GREEN = [76, 181, 40];
  const EYE_GRAY  = [167, 172, 174];

  function colorMatch(data, i, target, tol = 5) {
    return Math.abs(data[i] - target[0]) <= tol &&
           Math.abs(data[i+1] - target[1]) <= tol &&
           Math.abs(data[i+2] - target[2]) <= tol &&
           data[i+3] > 128;
  }
  function setPixel(data, i, color) {
    data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = 255;
  }
  function isSkin(data, i) {
    return colorMatch(data, i, SKIN_MAIN) || colorMatch(data, i, SKIN_SHADOW) ||
           colorMatch(data, i, SKIN_DARK) || colorMatch(data, i, SKIN_LIGHT);
  }
  function isEye(data, i) {
    return colorMatch(data, i, EYE_WHITE) || colorMatch(data, i, EYE_GREEN) ||
           colorMatch(data, i, EYE_GRAY);
  }
  function isOutline(data, i) {
    return data[i] <= 5 && data[i+1] <= 5 && data[i+2] <= 5 && data[i+3] > 128;
  }

  function findBounds(imgData, fx) {
    let minY = FH, maxY = 0, minX = FW, maxX = 0;
    for (let y = 0; y < FH; y++) {
      for (let x = fx; x < fx + FW; x++) {
        const i = (y * imgData.width + x) * 4;
        if (imgData.data[i+3] > 0) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          minX = Math.min(minX, x - fx);
          maxX = Math.max(maxX, x - fx);
        }
      }
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * Shift body pixels down by Y_SHIFT, then grow the silhouette outward
   * to add armor bulk. Returns new ImageData with the shifted + bulked body.
   */
  function shiftAndBulk(srcImg) {
    // Read source
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = SHEET_W; srcCanvas.height = FH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, SHEET_W, FH);

    // Create shifted output
    const outCanvas = document.createElement('canvas');
    outCanvas.width = SHEET_W; outCanvas.height = FH;
    const outCtx = outCanvas.getContext('2d');
    const outData = outCtx.getImageData(0, 0, SHEET_W, FH);

    // Step 1: Copy pixels shifted down
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < SHEET_W; x++) {
        const srcY = y - Y_SHIFT;
        if (srcY < 0 || srcY >= FH) continue;
        const si = (srcY * SHEET_W + x) * 4;
        const di = (y * SHEET_W + x) * 4;
        if (srcData.data[si + 3] === 0) continue;
        outData.data[di]     = srcData.data[si];
        outData.data[di + 1] = srcData.data[si + 1];
        outData.data[di + 2] = srcData.data[si + 2];
        outData.data[di + 3] = srcData.data[si + 3];
      }
    }

    // Step 2: Grow the silhouette outward by 2px for armor bulk
    const bulkRadius = 2;
    let current = new Uint8ClampedArray(outData.data);

    for (let pass = 0; pass < bulkRadius; pass++) {
      // Snapshot current state as read-only source; write to a fresh copy
      const readBuf = current;
      const writeBuf = new Uint8ClampedArray(readBuf);

      const fillColor = pass === 0 ? ARMOR_OUTLINE : ARMOR_DARK;

      for (let frame = 0; frame < FRAMES; frame++) {
        const fx = frame * FW;
        for (let y = 0; y < FH; y++) {
          for (let lx = 0; lx < FW; lx++) {
            const x = fx + lx;
            const i = (y * SHEET_W + x) * 4;
            if (readBuf[i + 3] > 0) continue; // already solid

            let hasNeighbor = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = lx + dx, ny = y + dy;
                if (nx < 0 || nx >= FW || ny < 0 || ny >= FH) continue;
                const ni = (ny * SHEET_W + (fx + nx)) * 4;
                if (readBuf[ni + 3] > 0) { hasNeighbor = true; break; }
              }
              if (hasNeighbor) break;
            }

            if (hasNeighbor) {
              writeBuf[i]   = fillColor[0];
              writeBuf[i+1] = fillColor[1];
              writeBuf[i+2] = fillColor[2];
              writeBuf[i+3] = 255;
            }
          }
        }
      }
      current = writeBuf;
    }

    // Apply bulked data back
    for (let j = 0; j < outData.data.length; j++) {
      outData.data[j] = current[j];
    }

    return outData;
  }

  function generateSprite(canvasId, srcImg, isFront) {
    const canvas = createCanvas(canvasId, SHEET_W, FH);
    const ctx = canvas.getContext('2d');

    // Get shifted + bulked body
    const imgData = shiftAndBulk(srcImg);
    const d = imgData.data;

    // Now recolor
    for (let frame = 0; frame < FRAMES; frame++) {
      const fx = frame * FW;
      // Find bounds in the shifted data
      let minY = FH, maxY = 0, minX = FW, maxX = 0;
      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const i = (y * SHEET_W + (fx + lx)) * 4;
          if (d[i+3] > 0) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minX = Math.min(minX, lx);
            maxX = Math.max(maxX, lx);
          }
        }
      }

      const headTop = minY;
      const bodyHeight = maxY - minY;
      const headEnd = headTop + Math.floor(bodyHeight * 0.28);
      const torsoEnd = headTop + Math.floor(bodyHeight * 0.62);
      const centerX = Math.floor((minX + maxX) / 2);

      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const x = fx + lx;
          const i = (y * SHEET_W + x) * 4;
          if (d[i+3] === 0) continue;

          // Keep eyes on front-facing
          if (isFront && isEye(d, i)) continue;

          // Helmet zone
          if (y >= headTop && y <= headEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ARMOR_OUTLINE);
            } else if (isSkin(d, i)) {
              if (y < headTop + 3 || lx <= minX + 2 || lx >= maxX - 2) {
                setPixel(d, i, ARMOR_DARK);
              } else {
                setPixel(d, i, ARMOR_MID);
              }
            } else {
              // Bulk-added pixels — make them armor
              if (colorMatch(d, i, ARMOR_DARK) || colorMatch(d, i, ARMOR_OUTLINE)) {
                // already colored by bulk pass
              } else {
                setPixel(d, i, ARMOR_MID);
              }
            }
          }
          // Torso / armor
          else if (y > headEnd && y <= torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ARMOR_OUTLINE);
            } else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, ARMOR_DARK);
              } else {
                setPixel(d, i, isFront ? ARMOR_LIGHT : ARMOR_MID);
              }
            }
            // Bulk pixels are already armor-colored
          }
          // Legs / boots
          else if (y > torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ARMOR_OUTLINE);
            } else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, BOOT_DARK);
              } else {
                setPixel(d, i, BOOT_MAIN);
              }
            }
          }
        }
      }

      // Front-facing visor slit
      if (isFront) {
        const visorY = headTop + Math.floor(bodyHeight * 0.16);
        for (let lx = centerX - 3; lx <= centerX + 3; lx++) {
          if (lx < 0 || lx >= FW) continue;
          const x = fx + lx;
          const i = (visorY * SHEET_W + x) * 4;
          if (d[i+3] > 0) {
            setPixel(d, i, ARMOR_VDARK);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  generateSprite('warrior-down', bodyDown, true);
  generateSprite('warrior-up', bodyUp, false);

  // Reference side-view
  const refCanvas = createCanvas('warrior-side', SHEET_W, FH);
  refCanvas.getContext('2d').drawImage(knight, 0, 0);
});

await saveCanvas(page, '#warrior-down', 'apps/client/public/assets/sprites/warrior/Run_Down.png');
await saveCanvas(page, '#warrior-up', 'apps/client/public/assets/sprites/warrior/Run_Up.png');
await savePreview(page, ['#warrior-side', '#warrior-down', '#warrior-up'], '/tmp/warrior-preview.png');

console.log('\n[warrior-directions] Done! Preview at /tmp/warrior-preview.png');
await cleanup();
