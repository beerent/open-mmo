/**
 * Generate NPC front-facing (Run_Down) sprites for town characters.
 *
 * Creates 4 NPC types by compositing onto Body_A base:
 *   1. Merchant  — Purple apron, cream shirt (matches purple market stand)
 *   2. Guard     — Gold/red armor, helmet
 *   3. Elder     — White beard, dark blue robes
 *   4. Villager  — Green tunic, brown pants
 *
 * Also creates recolored side-view (Run.png) sprites from the existing NPC references:
 *   Merchant ← Rogue recolored
 *   Guard    ← Knight recolored
 *   Elder    ← Wizzard recolored
 *   Villager ← Rogue recolored
 *
 * Output: assets/sprites/npcs/{type}/Run.png, Run_Down.png, Run_Up.png
 *         /tmp/npc-preview.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';
import { mkdirSync } from 'fs';

const { page, cleanup } = await openStudio();

await page.evaluate(async () => {
  // === Load source assets ===
  const bodyDown = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Down-Sheet.png');
  const bodyUp = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Up-Sheet.png');
  const knight = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Knight/Run/Run-Sheet.png");
  const wizzard = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Wizzard/Run/Run-Sheet.png");
  const rogue = await loadImg("/assets/Art/Pixel Crawler/Entities/Npc's/Rogue/Run/Run-Sheet.png");

  const FRAMES = 6;
  const FW = 64, FH = 64;
  const SHEET_W = FRAMES * FW;
  const Y_SHIFT = 17; // Body_A feet at ~y46, NPCs at ~y63

  // === Color constants ===
  const SKIN_MAIN   = [217, 160, 102];
  const SKIN_SHADOW = [162, 101, 67];
  const SKIN_DARK   = [118, 61, 43];
  const SKIN_LIGHT  = [250, 200, 149];
  const OUTLINE     = [20, 20, 18];

  const EYE_WHITE = [255, 252, 252];
  const EYE_GREEN = [76, 181, 40];
  const EYE_GRAY  = [167, 172, 174];

  // NPC color schemes
  const NPC_DEFS = {
    merchant: {
      name: 'merchant',
      // Purple apron over cream shirt — matches purple market stand
      helmet: null, // no helmet
      headColor: SKIN_MAIN, // bare head
      hatMain: [130, 80, 160],    // purple beret/cap
      hatDark: [90, 50, 120],
      torsoLight: [235, 220, 190], // cream shirt
      torsoMid: [200, 185, 155],
      torsoDark: [160, 140, 110],
      apronMain: [130, 80, 160],   // purple apron
      apronDark: [90, 50, 120],
      bootMain: [140, 90, 40],
      bootDark: [80, 50, 20],
      hasBeard: false,
      hasApron: true,
      hasHat: true,
    },
    guard: {
      name: 'guard',
      // Gold/red armor — town guard
      helmet: true,
      helmetMain: [200, 170, 60],   // gold helmet
      helmetDark: [150, 120, 30],
      helmetVDark: [100, 80, 20],
      torsoLight: [200, 60, 50],    // red armor
      torsoMid: [160, 40, 35],
      torsoDark: [110, 25, 20],
      bootMain: [140, 90, 40],
      bootDark: [80, 50, 20],
      hasBeard: false,
      hasApron: false,
      hasHat: false,
    },
    elder: {
      name: 'elder',
      // White beard, dark blue robes — wise elder
      helmet: null,
      hatMain: [60, 60, 100],      // dark blue hood
      hatDark: [35, 35, 70],
      torsoLight: [70, 70, 120],   // dark blue robe
      torsoMid: [50, 50, 95],
      torsoDark: [35, 35, 70],
      bootMain: [100, 80, 60],
      bootDark: [60, 45, 30],
      beardColor: [230, 225, 215], // white beard
      beardDark: [190, 185, 175],
      hasBeard: true,
      hasApron: false,
      hasHat: true,
    },
    villager: {
      name: 'villager',
      // Simple green tunic, brown pants — common villager
      helmet: null,
      headColor: SKIN_MAIN,
      hatMain: [160, 140, 80],     // straw hat
      hatDark: [120, 100, 50],
      torsoLight: [80, 140, 60],   // green tunic
      torsoMid: [55, 110, 40],
      torsoDark: [35, 80, 25],
      bootMain: [140, 100, 60],    // brown pants/boots
      bootDark: [90, 60, 30],
      hasBeard: false,
      hasApron: false,
      hasHat: true,
    },
  };

  // === Utility functions ===
  function colorMatch(data, i, target, tol = 8) {
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
    return data[i] <= 25 && data[i+1] <= 25 && data[i+2] <= 25 && data[i+3] > 128;
  }

  // === Generate front-facing (Down) sprite for an NPC ===
  function generateFrontSprite(canvasId, srcImg, npcDef) {
    const canvas = createCanvas(canvasId, SHEET_W, FH);
    const ctx = canvas.getContext('2d');

    // Shift body down + expand
    const imgData = shiftAndExpand(srcImg, {
      yShift: Y_SHIFT,
      bulkPasses: 2,
      fillColors: [OUTLINE, npcDef.torsoDark],
      sheetW: SHEET_W, frameW: FW, frameH: FH, frameCount: FRAMES,
    });
    const d = imgData.data;

    for (let frame = 0; frame < FRAMES; frame++) {
      const fx = frame * FW;

      // Find bounds
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

      const bodyHeight = maxY - minY;
      const headEnd = minY + Math.floor(bodyHeight * 0.28);
      const torsoEnd = minY + Math.floor(bodyHeight * 0.62);
      const centerX = Math.floor((minX + maxX) / 2);

      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const x = fx + lx;
          const i = (y * SHEET_W + x) * 4;
          if (d[i+3] === 0) continue;

          // Keep eyes
          if (isEye(d, i)) continue;

          // HEAD ZONE
          if (y >= minY && y <= headEnd) {
            if (npcDef.helmet) {
              // Full helmet
              if (isOutline(d, i)) {
                setPixel(d, i, OUTLINE);
              } else if (y < minY + 3 || lx <= minX + 2 || lx >= maxX - 2) {
                setPixel(d, i, npcDef.helmetDark);
              } else {
                setPixel(d, i, npcDef.helmetMain);
              }
            } else if (npcDef.hasHat) {
              // Hat on top, face below
              const hatBottom = minY + Math.floor(bodyHeight * 0.18);
              if (y <= hatBottom) {
                if (isOutline(d, i)) {
                  setPixel(d, i, OUTLINE);
                } else if (y <= minY + 2) {
                  setPixel(d, i, npcDef.hatDark);
                } else {
                  setPixel(d, i, npcDef.hatMain);
                }
              }
              // Face area — leave skin/eyes as-is
            }
          }
          // TORSO ZONE
          else if (y > headEnd && y <= torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, OUTLINE);
            } else if (npcDef.hasApron && lx >= centerX - 4 && lx <= centerX + 4) {
              // Apron over torso
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, npcDef.apronDark);
              } else {
                setPixel(d, i, npcDef.apronMain);
              }
            } else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, npcDef.torsoDark);
              } else {
                setPixel(d, i, npcDef.torsoLight);
              }
            } else {
              // Bulk pixels — color as torso
              if (!isOutline(d, i)) {
                setPixel(d, i, npcDef.torsoMid);
              }
            }
          }
          // LEGS/BOOTS ZONE
          else if (y > torsoEnd) {
            if (isOutline(d, i)) {
              setPixel(d, i, OUTLINE);
            } else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK)) {
                setPixel(d, i, npcDef.bootDark);
              } else {
                setPixel(d, i, npcDef.bootMain);
              }
            }
          }
        }
      }

      // Draw beard for elder
      if (npcDef.hasBeard) {
        const beardTop = headEnd - 1;
        const beardBot = headEnd + Math.floor(bodyHeight * 0.12);
        for (let y = beardTop; y <= beardBot; y++) {
          for (let lx = centerX - 3; lx <= centerX + 3; lx++) {
            if (lx < 0 || lx >= FW) continue;
            const x = fx + lx;
            const i = (y * SHEET_W + x) * 4;
            if (d[i+3] > 0 && !isOutline(d, i) && !isEye(d, i)) {
              const edge = Math.abs(lx - centerX) >= 3 || y >= beardBot - 1;
              setPixel(d, i, edge ? npcDef.beardDark : npcDef.beardColor);
            }
          }
        }
      }

      // Helmet visor slit for guard
      if (npcDef.helmet) {
        const visorY = minY + Math.floor(bodyHeight * 0.16);
        for (let lx = centerX - 3; lx <= centerX + 3; lx++) {
          if (lx < 0 || lx >= FW) continue;
          const x = fx + lx;
          const i = (visorY * SHEET_W + x) * 4;
          if (d[i+3] > 0) {
            setPixel(d, i, npcDef.helmetVDark);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // === Generate back-facing (Up) sprite for an NPC ===
  function generateBackSprite(canvasId, srcImg, npcDef) {
    const canvas = createCanvas(canvasId, SHEET_W, FH);
    const ctx = canvas.getContext('2d');

    const imgData = shiftAndExpand(srcImg, {
      yShift: Y_SHIFT,
      bulkPasses: 2,
      fillColors: [OUTLINE, npcDef.torsoDark],
      sheetW: SHEET_W, frameW: FW, frameH: FH, frameCount: FRAMES,
    });
    const d = imgData.data;

    for (let frame = 0; frame < FRAMES; frame++) {
      const fx = frame * FW;

      let minY = FH, maxY = 0, minX = FW, maxX = 0;
      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const i = (y * SHEET_W + (fx + lx)) * 4;
          if (d[i+3] > 0) {
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minX = Math.min(minX, lx); maxX = Math.max(maxX, lx);
          }
        }
      }

      const bodyHeight = maxY - minY;
      const headEnd = minY + Math.floor(bodyHeight * 0.28);
      const torsoEnd = minY + Math.floor(bodyHeight * 0.62);

      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const x = fx + lx;
          const i = (y * SHEET_W + x) * 4;
          if (d[i+3] === 0) continue;

          if (y >= minY && y <= headEnd) {
            if (npcDef.helmet) {
              if (isOutline(d, i)) setPixel(d, i, OUTLINE);
              else if (y < minY + 3 || lx <= minX + 2 || lx >= maxX - 2)
                setPixel(d, i, npcDef.helmetDark);
              else setPixel(d, i, npcDef.helmetMain);
            } else if (npcDef.hasHat) {
              const hatBottom = minY + Math.floor(bodyHeight * 0.18);
              if (y <= hatBottom) {
                if (isOutline(d, i)) setPixel(d, i, OUTLINE);
                else if (y <= minY + 2) setPixel(d, i, npcDef.hatDark);
                else setPixel(d, i, npcDef.hatMain);
              }
              // Back of head — show hair/hat color instead of skin
              else if (isSkin(d, i)) {
                setPixel(d, i, npcDef.hasHat ? npcDef.hatDark : npcDef.torsoDark);
              }
            }
          } else if (y > headEnd && y <= torsoEnd) {
            if (isOutline(d, i)) setPixel(d, i, OUTLINE);
            else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK))
                setPixel(d, i, npcDef.torsoDark);
              else setPixel(d, i, npcDef.torsoMid);
            } else if (!isOutline(d, i)) {
              setPixel(d, i, npcDef.torsoMid);
            }
          } else if (y > torsoEnd) {
            if (isOutline(d, i)) setPixel(d, i, OUTLINE);
            else if (isSkin(d, i)) {
              if (colorMatch(d, i, SKIN_SHADOW) || colorMatch(d, i, SKIN_DARK))
                setPixel(d, i, npcDef.bootDark);
              else setPixel(d, i, npcDef.bootMain);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // === Recolor a side-view NPC sheet ===
  function recolorSideSprite(canvasId, srcImg, colorMap) {
    const canvas = createCanvas(canvasId, SHEET_W, FH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(srcImg, 0, 0);
    const imgData = ctx.getImageData(0, 0, SHEET_W, FH);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i+3] === 0) continue;
      for (const [from, to] of colorMap) {
        if (colorMatch(d, i, from, 5)) {
          setPixel(d, i, to);
          break;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // === Side-view source palettes ===
  const KNIGHT_COLORS = {
    armorLight: [138, 198, 224],
    armorMid: [92, 142, 165],
    armorDark: [59, 83, 94],
    armorVDark: [36, 42, 54],
  };

  const WIZZARD_COLORS = {
    robeMain: [147, 45, 139],
    robeMid: [95, 46, 92],
    robeDark: [67, 35, 65],
    robeVDark: [38, 26, 38],
    hatBrim: [240, 154, 83],
    hatBrimDark: [128, 74, 30],
    white: [253, 253, 253],
    grayLight: [203, 195, 188],
    grayMid: [124, 108, 94],
    grayDark: [70, 61, 53],
  };

  const ROGUE_COLORS = {
    clothLight: [146, 130, 48],
    clothMid: [95, 86, 37],
    clothDark: [55, 58, 32],
    clothVDark: [37, 39, 22],
  };

  // === Generate all NPCs ===

  // --- MERCHANT (purple/cream) - side from Rogue recolor ---
  const merchantSideMap = [
    [ROGUE_COLORS.clothLight, [180, 160, 210]],  // light purple
    [ROGUE_COLORS.clothMid, [130, 80, 160]],      // purple
    [ROGUE_COLORS.clothDark, [90, 50, 120]],       // dark purple
    [ROGUE_COLORS.clothVDark, [60, 30, 80]],       // very dark purple
  ];
  recolorSideSprite('merchant-side', rogue, merchantSideMap);
  generateFrontSprite('merchant-down', bodyDown, NPC_DEFS.merchant);
  generateBackSprite('merchant-up', bodyUp, NPC_DEFS.merchant);

  // --- GUARD (gold/red) - side from Knight recolor ---
  const guardSideMap = [
    [KNIGHT_COLORS.armorLight, [220, 190, 80]],   // gold light
    [KNIGHT_COLORS.armorMid, [180, 150, 50]],      // gold mid
    [KNIGHT_COLORS.armorDark, [130, 100, 30]],     // gold dark
    [KNIGHT_COLORS.armorVDark, [80, 60, 20]],      // gold very dark
  ];
  recolorSideSprite('guard-side', knight, guardSideMap);
  generateFrontSprite('guard-down', bodyDown, NPC_DEFS.guard);
  generateBackSprite('guard-up', bodyUp, NPC_DEFS.guard);

  // --- ELDER (white/dark blue) - side from Wizzard recolor ---
  const elderSideMap = [
    [WIZZARD_COLORS.robeMain, [70, 70, 120]],     // dark blue robe
    [WIZZARD_COLORS.robeMid, [50, 50, 95]],
    [WIZZARD_COLORS.robeDark, [35, 35, 70]],
    [WIZZARD_COLORS.robeVDark, [20, 20, 50]],
    [WIZZARD_COLORS.hatBrim, [100, 100, 150]],    // muted blue hat brim
    [WIZZARD_COLORS.hatBrimDark, [60, 60, 100]],
    [WIZZARD_COLORS.white, [230, 225, 215]],       // white beard stays
    [WIZZARD_COLORS.grayLight, [200, 195, 185]],
    [WIZZARD_COLORS.grayMid, [160, 155, 145]],
    [WIZZARD_COLORS.grayDark, [120, 115, 105]],
  ];
  recolorSideSprite('elder-side', wizzard, elderSideMap);
  generateFrontSprite('elder-down', bodyDown, NPC_DEFS.elder);
  generateBackSprite('elder-up', bodyUp, NPC_DEFS.elder);

  // --- VILLAGER (green/brown) - side from Rogue recolor ---
  const villagerSideMap = [
    [ROGUE_COLORS.clothLight, [110, 165, 80]],    // green tunic light
    [ROGUE_COLORS.clothMid, [80, 140, 60]],
    [ROGUE_COLORS.clothDark, [55, 110, 40]],
    [ROGUE_COLORS.clothVDark, [35, 80, 25]],
  ];
  recolorSideSprite('villager-side', rogue, villagerSideMap);
  generateFrontSprite('villager-down', bodyDown, NPC_DEFS.villager);
  generateBackSprite('villager-up', bodyUp, NPC_DEFS.villager);
});

// Save all NPC sprites
const npcs = ['merchant', 'guard', 'elder', 'villager'];
for (const npc of npcs) {
  const dir = `apps/client/public/assets/sprites/npcs/${npc}`;
  mkdirSync(dir, { recursive: true });
  await saveCanvas(page, `#${npc}-side`, `${dir}/Run.png`);
  await saveCanvas(page, `#${npc}-down`, `${dir}/Run_Down.png`);
  await saveCanvas(page, `#${npc}-up`, `${dir}/Run_Up.png`);
}

// Preview all NPCs
await savePreview(
  page,
  npcs.flatMap(n => [`#${n}-side`, `#${n}-down`, `#${n}-up`]),
  '/tmp/npc-preview.png'
);

console.log('\n[npc-sprites] Done! Preview at /tmp/npc-preview.png');
console.log('NPCs generated: merchant, guard, elder, villager');
await cleanup();
