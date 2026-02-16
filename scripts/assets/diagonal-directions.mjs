/**
 * Generate diagonal (3/4 view) run sprites for warrior and wizard.
 *
 * For each class, loads the front-facing (Run_Down.png) and back-facing (Run_Up.png)
 * sheets, applies a horizontal skew transform per frame to create a "turning" 3/4 view,
 * and saves as Run_DownRight.png and Run_UpRight.png.
 *
 * Left-facing diagonals are horizontal flips handled at runtime by SpriteGenerator,
 * so no extra sheets are needed.
 *
 * Output:
 *   sprites/warrior/Run_DownRight.png, Run_UpRight.png
 *   sprites/wizard/Run_DownRight.png,  Run_UpRight.png
 *   /tmp/diagonal-preview.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(async () => {
  const FRAMES = 6;
  const FW = 64, FH = 64;
  const SHEET_W = FRAMES * FW;
  const SKEW_FACTOR = 0.2; // Controls how much "turn" — pixels shift per row from center

  /**
   * Apply a horizontal skew to each frame of a sprite sheet.
   * Top half shifts one direction, bottom half the other, creating a 3/4 view effect.
   *
   * @param {HTMLImageElement} srcImg - Source sprite sheet
   * @param {string} canvasId - ID for the output canvas
   * @param {number} skewDir - 1 for right-facing skew, -1 for left-facing
   * @returns {HTMLCanvasElement}
   */
  function skewSheet(srcImg, canvasId, skewDir = 1) {
    // Read source pixels
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = SHEET_W;
    srcCanvas.height = FH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, SHEET_W, FH);

    // Create output canvas
    const outCanvas = createCanvas(canvasId, SHEET_W, FH);
    const outCtx = outCanvas.getContext('2d');
    const outData = outCtx.createImageData(SHEET_W, FH);

    for (let frame = 0; frame < FRAMES; frame++) {
      const fx = frame * FW;

      // Find vertical center of this frame's content
      let minY = FH, maxY = 0;
      for (let y = 0; y < FH; y++) {
        for (let lx = 0; lx < FW; lx++) {
          const i = (y * SHEET_W + fx + lx) * 4;
          if (srcData.data[i + 3] > 0) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const midY = (minY + maxY) / 2;

      // Apply skew: shift each row horizontally based on distance from center
      for (let y = 0; y < FH; y++) {
        const shift = Math.round((y - midY) * SKEW_FACTOR * skewDir);
        for (let lx = 0; lx < FW; lx++) {
          const srcX = lx - shift;
          if (srcX < 0 || srcX >= FW) continue;

          const si = (y * SHEET_W + fx + srcX) * 4;
          const di = (y * SHEET_W + fx + lx) * 4;

          if (srcData.data[si + 3] === 0) continue;

          outData.data[di]     = srcData.data[si];
          outData.data[di + 1] = srcData.data[si + 1];
          outData.data[di + 2] = srcData.data[si + 2];
          outData.data[di + 3] = srcData.data[si + 3];
        }
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  // Process both classes
  const classes = [
    { name: 'warrior', dir: 'warrior' },
    { name: 'wizard',  dir: 'wizard' },
  ];

  for (const cls of classes) {
    const base = `/assets/sprites/${cls.dir}`;
    const downImg = await loadImg(`${base}/Run_Down.png`);
    const upImg   = await loadImg(`${base}/Run_Up.png`);

    // DownRight: skew the front-facing sprite
    skewSheet(downImg, `${cls.name}-downright`, 1);

    // UpRight: skew the back-facing sprite
    skewSheet(upImg, `${cls.name}-upright`, 1);
  }
});

// Save outputs
const classes = ['warrior', 'wizard'];
for (const cls of classes) {
  await saveCanvas(page, `#${cls}-downright`, `apps/client/public/assets/sprites/${cls}/Run_DownRight.png`);
  await saveCanvas(page, `#${cls}-upright`, `apps/client/public/assets/sprites/${cls}/Run_UpRight.png`);
}

// Generate preview with all diagonal sheets
await savePreview(
  page,
  classes.flatMap(cls => [`#${cls}-downright`, `#${cls}-upright`]),
  '/tmp/diagonal-preview.png'
);

console.log('\n[diagonal-directions] Done! Preview at /tmp/diagonal-preview.png');
await cleanup();
