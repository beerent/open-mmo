/**
 * Generate marble item sprites: icon.png (inventory) + world.png (on ground).
 * Both 16x16 pixel art.
 *
 * Output: sprites/items/marble/icon.png, sprites/items/marble/world.png
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

await page.evaluate(() => {
  // === Icon (16x16) — polished marble for inventory display ===
  const icon = createCanvas('icon', 16, 16);
  const ictx = icon.getContext('2d');

  // Draw marble circle with pixel-art shading
  const marbleData = ictx.createImageData(16, 16);
  const d = marbleData.data;

  // Circle mask (radius ~6 centered at 7.5, 7.5)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 6.5) continue;

      const i = (y * 16 + x) * 4;

      // Base blue gradient
      const angle = Math.atan2(dy, dx);
      const normDist = dist / 6.5;

      // Highlight in upper-left
      if (dx < -1 && dy < -1 && dist < 4) {
        // Bright highlight
        d[i] = 170; d[i+1] = 200; d[i+2] = 255; d[i+3] = 255;
      } else if (normDist < 0.3) {
        // Center lighter blue
        d[i] = 100; d[i+1] = 160; d[i+2] = 255; d[i+3] = 255;
      } else if (normDist < 0.7) {
        // Mid blue
        d[i] = 68; d[i+1] = 136; d[i+2] = 255; d[i+3] = 255;
      } else {
        // Edge darker blue
        d[i] = 34; d[i+1] = 85; d[i+2] = 170; d[i+3] = 255;
      }

      // Specular highlight spot
      if (x >= 4 && x <= 6 && y >= 3 && y <= 5) {
        d[i] = 220; d[i+1] = 240; d[i+2] = 255; d[i+3] = 255;
      }

      // Bottom shadow
      if (normDist > 0.8 && dy > 2) {
        d[i] = 17; d[i+1] = 51; d[i+2] = 102; d[i+3] = 255;
      }
    }
  }

  ictx.putImageData(marbleData, 0, 0);

  // === World sprite (16x16) — slightly smaller marble on ground ===
  const world = createCanvas('world', 16, 16);
  const wctx = world.getContext('2d');

  const worldData = wctx.createImageData(16, 16);
  const wd = worldData.data;

  // Smaller circle (radius ~4 centered at 7.5, 10.5) — sits lower in tile
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 10.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 4.5) continue;

      const i = (y * 16 + x) * 4;
      const normDist = dist / 4.5;

      if (dx < -0.5 && dy < -0.5 && dist < 2.5) {
        d[i] = 170; d[i+1] = 200; d[i+2] = 255; d[i+3] = 255;
        wd[i] = 170; wd[i+1] = 200; wd[i+2] = 255; wd[i+3] = 255;
      } else if (normDist < 0.4) {
        wd[i] = 100; wd[i+1] = 160; wd[i+2] = 255; wd[i+3] = 255;
      } else if (normDist < 0.75) {
        wd[i] = 68; wd[i+1] = 136; wd[i+2] = 255; wd[i+3] = 255;
      } else {
        wd[i] = 34; wd[i+1] = 85; wd[i+2] = 170; wd[i+3] = 255;
      }

      // Specular
      if (x >= 5 && x <= 6 && y >= 8 && y <= 9) {
        wd[i] = 220; wd[i+1] = 240; wd[i+2] = 255; wd[i+3] = 255;
      }
    }
  }

  wctx.putImageData(worldData, 0, 0);
});

await saveCanvas(page, '#icon', 'apps/client/public/assets/sprites/items/marble/icon.png');
await saveCanvas(page, '#world', 'apps/client/public/assets/sprites/items/marble/world.png');
await savePreview(page, ['#icon', '#world'], '/tmp/marble-items-preview.png');

console.log('\n[item-marble] Done! Preview at /tmp/marble-items-preview.png');
await cleanup();
