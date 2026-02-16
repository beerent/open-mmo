/**
 * Analyze sprite palettes for the warrior and wizard compositing work.
 * Outputs color data that will inform the generation scripts.
 */
import { openStudio } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

const analysis = await page.evaluate(async () => {
  const knightRun = await loadImg('/assets/Art/Pixel Crawler/Entities/Npc\'s/Knight/Run/Run-Sheet.png');
  const wizardRun = await loadImg('/assets/Art/Pixel Crawler/Entities/Npc\'s/Wizzard/Run/Run-Sheet.png');
  const bodyDown = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Down-Sheet.png');
  const bodyUp = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Up-Sheet.png');
  const bodySide = await loadImg('/assets/Art/Pixel Crawler/Entities/Characters/Body_A/Animations/Run_Base/Run_Side-Sheet.png');

  // Get all unique colors from first frame of each
  const results = {};

  // Knight frame 0 (64x64)
  results.knightPalette = getPalette(knightRun, 0, 0, 64, 64);
  results.knightSize = { w: knightRun.width, h: knightRun.height };

  // Wizard frame 0
  results.wizardPalette = getPalette(wizardRun, 0, 0, 64, 64);
  results.wizardSize = { w: wizardRun.width, h: wizardRun.height };

  // Body_A Down frame 0
  results.bodyDownPalette = getPalette(bodyDown, 0, 0, 64, 64);
  results.bodyDownSize = { w: bodyDown.width, h: bodyDown.height };

  // Body_A Up frame 0
  results.bodyUpPalette = getPalette(bodyUp, 0, 0, 64, 64);
  results.bodyUpSize = { w: bodyUp.width, h: bodyUp.height };

  // Body_A Side frame 0
  results.bodySidePalette = getPalette(bodySide, 0, 0, 64, 64);
  results.bodySideSize = { w: bodySide.width, h: bodySide.height };

  // Now get per-pixel data for knight frame 0 to see where body vs armor is
  // Scan columns to find the bounding box of non-transparent pixels
  const knightData = getImageData(knightRun);
  const bodyDownData = getImageData(bodyDown);
  const bodyUpData = getImageData(bodyUp);

  // Find bounding boxes for frame 0
  function getBounds(imgData, fx, fy, fw, fh) {
    let minX = fw, maxX = 0, minY = fh, maxY = 0;
    for (let y = fy; y < fy + fh; y++) {
      for (let x = fx; x < fx + fw; x++) {
        const i = (y * imgData.width + x) * 4;
        if (imgData.data[i + 3] > 0) {
          const lx = x - fx, ly = y - fy;
          minX = Math.min(minX, lx);
          maxX = Math.max(maxX, lx);
          minY = Math.min(minY, ly);
          maxY = Math.max(maxY, ly);
        }
      }
    }
    return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  results.knightBounds = [];
  results.bodyDownBounds = [];
  results.bodyUpBounds = [];
  for (let f = 0; f < 6; f++) {
    results.knightBounds.push(getBounds(knightData, f * 64, 0, 64, 64));
    results.bodyDownBounds.push(getBounds(bodyDownData, f * 64, 0, 64, 64));
    results.bodyUpBounds.push(getBounds(bodyUpData, f * 64, 0, 64, 64));
  }

  return results;
});

console.log("\n=== KNIGHT PALETTE (frame 0) ===");
console.log(`Size: ${analysis.knightSize.w}x${analysis.knightSize.h}`);
analysis.knightPalette.forEach(c => {
  console.log(`  rgba(${c.r},${c.g},${c.b},${c.a}) — ${c.count}px`);
});

console.log("\n=== WIZARD PALETTE (frame 0) ===");
console.log(`Size: ${analysis.wizardSize.w}x${analysis.wizardSize.h}`);
analysis.wizardPalette.forEach(c => {
  console.log(`  rgba(${c.r},${c.g},${c.b},${c.a}) — ${c.count}px`);
});

console.log("\n=== BODY_A DOWN PALETTE (frame 0) ===");
console.log(`Size: ${analysis.bodyDownSize.w}x${analysis.bodyDownSize.h}`);
analysis.bodyDownPalette.forEach(c => {
  console.log(`  rgba(${c.r},${c.g},${c.b},${c.a}) — ${c.count}px`);
});

console.log("\n=== BODY_A UP PALETTE (frame 0) ===");
console.log(`Size: ${analysis.bodyUpSize.w}x${analysis.bodyUpSize.h}`);
analysis.bodyUpPalette.forEach(c => {
  console.log(`  rgba(${c.r},${c.g},${c.b},${c.a}) — ${c.count}px`);
});

console.log("\n=== BODY_A SIDE PALETTE (frame 0) ===");
console.log(`Size: ${analysis.bodySideSize.w}x${analysis.bodySideSize.h}`);
analysis.bodySidePalette.forEach(c => {
  console.log(`  rgba(${c.r},${c.g},${c.b},${c.a}) — ${c.count}px`);
});

console.log("\n=== BOUNDING BOXES (per frame) ===");
console.log("Knight:", analysis.knightBounds.map(b => `${b.w}x${b.h} @(${b.minX},${b.minY})`));
console.log("BodyDown:", analysis.bodyDownBounds.map(b => `${b.w}x${b.h} @(${b.minX},${b.minY})`));
console.log("BodyUp:", analysis.bodyUpBounds.map(b => `${b.w}x${b.h} @(${b.minX},${b.minY})`));

await cleanup();
