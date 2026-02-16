/**
 * Generate wizard front-facing (Down) and back-facing (Up) run sprites
 * by compositing Wizard equipment onto the Body_A base body.
 *
 * Key: Body_A feet are at ~y47 but Wizard feet are at ~y63.
 * We shift the body down 16px, add robe bulk, and draw the hat + staff.
 *
 * FEATURE MANIFEST (from reference: Wizzard Run-Sheet.png):
 *   - Pointed hat (purple cone + orange brim)
 *   - Beard (white/silver, front-facing: BEARD_WHITE, BEARD_GRAY)
 *   - Staff (right side): STAFF_LIGHT, STAFF_MID
 *   - Robe (purple body recolor): ROBE_MAIN, ROBE_SHADOW, ROBE_DARK
 *   - Boots (brown): BOOT_MAIN, BOOT_DARK
 *   - Eyes (front-facing only): EYE_WHITE, EYE_GREEN
 *
 * Input:  Body_A Run_Down-Sheet.png, Run_Up-Sheet.png, Wizzard Run-Sheet.png
 * Output: sprites/wizard/Run_Down.png, Run_Up.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(async () => {
  const bodyDown = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Down-Sheet.png');
  const bodyUp = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Up-Sheet.png');
  const wizard = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Wizzard/Run/Run-Sheet.png");

  const FRAMES = 6;
  const FW = 64, FH = 64;
  const SHEET_W = FRAMES * FW;
  const Y_SHIFT = 16;

  // === Color definitions ===
  const SKIN_MAIN   = [217, 160, 102];
  const SKIN_SHADOW = [162, 101, 67];
  const SKIN_DARK   = [118, 61, 43];
  const SKIN_LIGHT  = [250, 200, 149];

  const ROBE_MAIN    = [147, 45, 139];
  const ROBE_SHADOW  = [95, 46, 92];
  const ROBE_OUTLINE = [20, 20, 18];
  const HAT_ORANGE   = [240, 154, 83];
  const BEARD_WHITE  = [253, 253, 253];
  const BEARD_GRAY   = [203, 195, 188];
  const STAFF_LIGHT  = [203, 195, 188];
  const STAFF_MID    = [124, 108, 94];
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

  /**
   * Shift body pixels down and grow silhouette for robe bulk.
   */
  function shiftAndBulk(srcImg) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = SHEET_W; srcCanvas.height = FH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, SHEET_W, FH);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = SHEET_W; outCanvas.height = FH;
    const outCtx = outCanvas.getContext('2d');
    const outData = outCtx.getImageData(0, 0, SHEET_W, FH);

    // Step 1: Copy shifted down
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

    // Step 2: Grow silhouette by 2px for robe bulk
    const bulkRadius = 2;
    let current = new Uint8ClampedArray(outData.data);

    for (let pass = 0; pass < bulkRadius; pass++) {
      const readBuf = current;
      const writeBuf = new Uint8ClampedArray(readBuf);
      const fillColor = pass === 0 ? ROBE_SHADOW : ROBE_MAIN;

      for (let frame = 0; frame < FRAMES; frame++) {
        const fx = frame * FW;
        for (let y = 0; y < FH; y++) {
          for (let lx = 0; lx < FW; lx++) {
            const x = fx + lx;
            const i = (y * SHEET_W + x) * 4;
            if (readBuf[i + 3] > 0) continue;

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

    for (let j = 0; j < outData.data.length; j++) outData.data[j] = current[j];
    return outData;
  }

  function generateSprite(canvasId, srcImg, isFront) {
    const canvas = createCanvas(canvasId, SHEET_W, FH);
    const ctx = canvas.getContext('2d');

    const imgData = shiftAndBulk(srcImg);
    const d = imgData.data;

    for (let frame = 0; frame < FRAMES; frame++) {
      const fx = frame * FW;
      // Find bounds in shifted data
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
      const headEnd = headTop + Math.floor(bodyHeight * 0.25);
      const torsoEnd = headTop + Math.floor(bodyHeight * 0.55);
      const centerX = Math.floor((minX + maxX) / 2);

      // Recolor body to robe
      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const x = fx + lx;
          const i = (y * SHEET_W + x) * 4;
          if (d[i+3] === 0) continue;

          // Keep eyes on front-facing
          if (isFront && isEye(d, i)) continue;

          // Head → hat area or face
          if (y >= headTop && y <= headEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ROBE_OUTLINE);
            } else if (isSkin(d, i)) {
              if (isFront && y > headEnd - 3) {
                // Lower face visible under hat from front — keep skin
              } else {
                setPixel(d, i, ROBE_MAIN);
              }
            } else if (!colorMatch(d, i, ROBE_OUTLINE)) {
              setPixel(d, i, ROBE_MAIN);
            }
          }
          // Torso → robe
          else if (y > headEnd && y <= torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ROBE_OUTLINE);
            } else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, ROBE_SHADOW);
              } else {
                setPixel(d, i, ROBE_MAIN);
              }
            }
          }
          // Legs → robe bottom / boots
          else if (y > torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, ROBE_OUTLINE);
            } else if (isSkin(d, i)) {
              if (y > maxY - 4) {
                // Feet — boots
                if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                  setPixel(d, i, BOOT_DARK);
                } else {
                  setPixel(d, i, BOOT_MAIN);
                }
              } else {
                // Robe hem
                if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                  setPixel(d, i, ROBE_SHADOW);
                } else {
                  setPixel(d, i, ROBE_MAIN);
                }
              }
            }
          }
        }
      }

      // Draw pointed hat above the head
      const hatTip = headTop - 8;
      const brimY = headEnd - 1;
      const hatHeight = brimY - hatTip;

      // Hat cone
      for (let y = Math.max(0, hatTip); y <= brimY; y++) {
        const progress = (y - hatTip) / hatHeight;
        const halfWidth = Math.max(0, Math.floor(progress * 8));

        for (let lx = centerX - halfWidth; lx <= centerX + halfWidth; lx++) {
          if (lx < 0 || lx >= FW) continue;
          const x = fx + lx;
          const i = (y * SHEET_W + x) * 4;

          if (lx === centerX - halfWidth || lx === centerX + halfWidth || y === Math.max(0, hatTip)) {
            setPixel(d, i, ROBE_OUTLINE);
          } else if (lx < centerX - 1) {
            setPixel(d, i, ROBE_SHADOW);
          } else {
            setPixel(d, i, ROBE_MAIN);
          }
        }
      }

      // Hat brim (wider orange band)
      for (let bRow = 0; bRow < 2; bRow++) {
        const by = brimY + bRow;
        if (by >= FH) continue;
        const brimHalf = 9;
        for (let lx = centerX - brimHalf; lx <= centerX + brimHalf; lx++) {
          if (lx < 0 || lx >= FW) continue;
          const x = fx + lx;
          const i = (by * SHEET_W + x) * 4;
          if (lx === centerX - brimHalf || lx === centerX + brimHalf) {
            setPixel(d, i, ROBE_OUTLINE);
          } else {
            setPixel(d, i, HAT_ORANGE);
          }
        }
      }

      // Staff on the right side
      const staffX = maxX + 3;
      if (staffX < FW) {
        const staffTop = headTop - 4;
        const staffBottom = maxY;
        for (let y = Math.max(0, staffTop); y <= staffBottom; y++) {
          const x = fx + staffX;
          const i = (y * SHEET_W + x) * 4;
          if (y <= staffTop + 2) {
            setPixel(d, i, STAFF_LIGHT);
          } else {
            setPixel(d, i, STAFF_MID);
          }
        }
      }

      // Draw beard (front-facing only)
      // Side-view beard flows from chin (~y41) down to ~y53 in orange.
      // Front view: chin is at ~headEnd+5, beard hangs over the torso.
      if (isFront) {
        const chinY = headEnd + 3;
        // Each entry: [yOffset from chinY, halfWidth]
        const beardShape = [
          [0, 3],   // 7px wide — lower face start
          [1, 4],   // 9px wide — widest part
          [2, 4],   // 9px
          [3, 4],   // 9px
          [4, 3],   // 7px — tapering
          [5, 3],   // 7px
          [6, 2],   // 5px
          [7, 1],   // 3px
          [8, 0],   // 1px — tip
        ];

        for (const [yOff, halfW] of beardShape) {
          const by = chinY + yOff;
          if (by < 0 || by >= FH) continue;

          for (let dlx = -halfW; dlx <= halfW; dlx++) {
            const lx = centerX + dlx;
            if (lx < 0 || lx >= FW) continue;
            const x = fx + lx;
            const i = (by * SHEET_W + x) * 4;

            const isEdge = Math.abs(dlx) === halfW;
            const isTip = yOff >= beardShape.length - 2;

            if (isEdge || (isTip && halfW === 0)) {
              // Outline on edges and the very tip
              setPixel(d, i, ROBE_OUTLINE);
            } else if (dlx < 0) {
              // Left side = gray shadow
              setPixel(d, i, BEARD_GRAY);
            } else {
              // Center and right = white
              setPixel(d, i, BEARD_WHITE);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  generateSprite('wizard-down', bodyDown, true);
  generateSprite('wizard-up', bodyUp, false);

  // Reference side-view
  const refCanvas = createCanvas('wizard-side', SHEET_W, FH);
  refCanvas.getContext('2d').drawImage(wizard, 0, 0);
});

await saveCanvas(page, '#wizard-down', 'apps/client/public/assets/sprites/wizard/Run_Down.png');
await saveCanvas(page, '#wizard-up', 'apps/client/public/assets/sprites/wizard/Run_Up.png');
await savePreview(page, ['#wizard-side', '#wizard-down', '#wizard-up'], '/tmp/wizard-preview.png');

console.log('\n[wizard-directions] Done! Preview at /tmp/wizard-preview.png');
await cleanup();
