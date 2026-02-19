/**
 * Generate a small friendly dog NPC sprite — 4-directional walking.
 *
 * Output:
 *   assets/sprites/npcs/dog/Run.png       — side view (6 frames, 384×64)
 *   assets/sprites/npcs/dog/Run_Down.png   — front view (6 frames, 384×64)
 *   assets/sprites/npcs/dog/Run_Up.png     — back view (6 frames, 384×64)
 *   assets/sprites/markers/npc_dog.png     — 16×16 Tiled marker
 *
 * Dog design: small golden-brown friendly dog, retro JRPG pixel style.
 * Body ~20px wide × 14px tall (side), feet at y63 to match NPC foot line.
 */
import { openStudio, saveCanvas, savePreview } from '../asset-studio.mjs';

const { page, cleanup } = await openStudio();

// ── Color palette ──
const C = {
  outline:  [40, 28, 16],      // dark brown outline
  body:     [194, 148, 82],     // golden-brown fur
  bodyLt:   [218, 178, 118],    // lighter fur (belly, highlights)
  bodyDk:   [156, 112, 56],     // darker fur (shadow, ears)
  nose:     [40, 28, 16],       // black nose
  eye:      [40, 28, 16],       // black eye
  eyeWhite: [255, 255, 255],    // eye highlight
  tongue:   [220, 100, 100],    // pink tongue
  collar:   [180, 50, 50],      // red collar
  collarBuckle: [220, 200, 60], // gold buckle
};

await page.evaluate(({ C }) => {

  function setPixel(d, w, x, y, col) {
    if (x < 0 || x >= w || y < 0 || y >= 64) return;
    const i = (y * w + x) * 4;
    d[i] = col[0]; d[i+1] = col[1]; d[i+2] = col[2]; d[i+3] = 255;
  }

  // ── SIDE VIEW (facing right) ──
  // 6 frames of walk cycle: leg positions alternate
  const sideCanvas = createCanvas('side', 384, 64);
  const sctx = sideCanvas.getContext('2d');
  const sData = sctx.createImageData(384, 64);
  const sd = sData.data;

  function drawSideDog(d, fx, legFrame) {
    // fx = frame X offset in the 384-wide sheet
    // Dog body: roughly 20w × 12h, feet at y63
    // Body top at y51, bottom at y61, legs to y63
    const bx = fx + 22; // center dog in 64px frame
    const by = 50;       // body top Y

    // Leg positions based on walk frame (0-5)
    // Pairs: front-left/back-right alternate with front-right/back-left
    const legOffsets = [
      { fl: 0, fr: 0, bl: 0, br: 0 },   // 0: standing
      { fl: -1, fr: 1, bl: 1, br: -1 },  // 1: walk A
      { fl: -1, fr: 1, bl: 1, br: -1 },  // 2: walk A (extended)
      { fl: 0, fr: 0, bl: 0, br: 0 },    // 3: standing
      { fl: 1, fr: -1, bl: -1, br: 1 },  // 4: walk B
      { fl: 1, fr: -1, bl: -1, br: 1 },  // 5: walk B (extended)
    ];
    const leg = legOffsets[legFrame];

    // Body (elliptical, ~18px wide × 10px tall)
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 18; x++) {
        const cx = x - 8.5, cy = y - 4.5;
        const dist = (cx * cx) / (9 * 9) + (cy * cy) / (5 * 5);
        if (dist > 1) continue;
        const px = bx + x, py = by + y;
        if (dist > 0.85) {
          setPixel(sd, 384, px, py, C.outline);
        } else if (cy < -1) {
          setPixel(sd, 384, px, py, C.bodyDk); // top = darker
        } else if (cy > 1.5) {
          setPixel(sd, 384, px, py, C.bodyLt); // belly = lighter
        } else {
          setPixel(sd, 384, px, py, C.body);
        }
      }
    }

    // Collar (red band around neck area)
    for (let y = 0; y < 3; y++) {
      setPixel(sd, 384, bx + 15, by + 2 + y, C.collar);
      setPixel(sd, 384, bx + 16, by + 2 + y, C.collar);
    }
    setPixel(sd, 384, bx + 15, by + 3, C.collarBuckle);

    // Head (rounder, ~8×8, attached to right side of body)
    const hx = bx + 15, hy = by - 3;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const cx = x - 4, cy = y - 4;
        const dist = (cx * cx + cy * cy);
        if (dist > 20) continue;
        const px = hx + x, py = hy + y;
        if (dist > 15) {
          setPixel(sd, 384, px, py, C.outline);
        } else if (cy < -1) {
          setPixel(sd, 384, px, py, C.bodyDk);
        } else {
          setPixel(sd, 384, px, py, C.body);
        }
      }
    }

    // Snout (protruding 3px to the right)
    setPixel(sd, 384, hx + 8, hy + 4, C.bodyLt);
    setPixel(sd, 384, hx + 8, hy + 5, C.bodyLt);
    setPixel(sd, 384, hx + 9, hy + 4, C.bodyLt);
    setPixel(sd, 384, hx + 9, hy + 5, C.outline); // nose
    setPixel(sd, 384, hx + 8, hy + 3, C.outline); // top outline
    setPixel(sd, 384, hx + 9, hy + 3, C.outline);
    setPixel(sd, 384, hx + 8, hy + 6, C.outline); // bottom outline

    // Tongue (hanging from mouth, only on some frames)
    if (legFrame === 1 || legFrame === 2) {
      setPixel(sd, 384, hx + 8, hy + 6, C.tongue);
      setPixel(sd, 384, hx + 8, hy + 7, C.tongue);
    }

    // Eye
    setPixel(sd, 384, hx + 6, hy + 2, C.eye);
    setPixel(sd, 384, hx + 7, hy + 2, C.eye);
    setPixel(sd, 384, hx + 7, hy + 1, C.eyeWhite); // highlight

    // Ear (floppy, on top-back of head)
    setPixel(sd, 384, hx + 2, hy - 1, C.bodyDk);
    setPixel(sd, 384, hx + 3, hy - 1, C.bodyDk);
    setPixel(sd, 384, hx + 2, hy, C.bodyDk);
    setPixel(sd, 384, hx + 1, hy - 1, C.outline);
    setPixel(sd, 384, hx + 4, hy - 1, C.outline);
    setPixel(sd, 384, hx + 1, hy, C.outline);

    // Tail (curving up from back of body)
    const tx = bx - 1, ty = by + 1;
    setPixel(sd, 384, tx, ty, C.body);
    setPixel(sd, 384, tx - 1, ty - 1, C.body);
    setPixel(sd, 384, tx - 1, ty - 2, C.body);
    // Tail wag: alternate position
    if (legFrame % 2 === 0) {
      setPixel(sd, 384, tx - 2, ty - 3, C.body);
      setPixel(sd, 384, tx - 2, ty - 4, C.bodyLt);
    } else {
      setPixel(sd, 384, tx - 2, ty - 2, C.body);
      setPixel(sd, 384, tx - 3, ty - 2, C.bodyLt);
    }

    // Legs (4 short legs, 3px tall)
    // Front legs (right side of body)
    const frontLegX = bx + 13;
    const backLegX = bx + 3;
    const legY = by + 9; // where legs start

    // Front-right leg
    for (let ly = 0; ly < 4; ly++) {
      setPixel(sd, 384, frontLegX + leg.fr, legY + ly, C.bodyDk);
      setPixel(sd, 384, frontLegX + 1 + leg.fr, legY + ly, C.body);
    }
    setPixel(sd, 384, frontLegX + leg.fr, legY + 4, C.outline); // paw

    // Front-left leg (behind, slightly offset)
    for (let ly = 0; ly < 4; ly++) {
      setPixel(sd, 384, frontLegX - 2 + leg.fl, legY + ly, C.bodyDk);
    }
    setPixel(sd, 384, frontLegX - 2 + leg.fl, legY + 4, C.outline);

    // Back-right leg
    for (let ly = 0; ly < 4; ly++) {
      setPixel(sd, 384, backLegX + leg.br, legY + ly, C.bodyDk);
      setPixel(sd, 384, backLegX + 1 + leg.br, legY + ly, C.body);
    }
    setPixel(sd, 384, backLegX + leg.br, legY + 4, C.outline);

    // Back-left leg (behind)
    for (let ly = 0; ly < 4; ly++) {
      setPixel(sd, 384, backLegX - 2 + leg.bl, legY + ly, C.bodyDk);
    }
    setPixel(sd, 384, backLegX - 2 + leg.bl, legY + 4, C.outline);

    // Body bob: frames 1-2 and 4-5 are mid-stride, shift body up 1px
    // (Already handled by the consistent foot line)
  }

  for (let f = 0; f < 6; f++) {
    drawSideDog(sd, f * 64, f);
  }
  sctx.putImageData(sData, 0, 0);

  // ── FRONT VIEW (facing down/toward camera) ──
  const downCanvas = createCanvas('down', 384, 64);
  const dctx = downCanvas.getContext('2d');
  const dData = dctx.createImageData(384, 64);
  const dd = dData.data;

  function drawFrontDog(d, fx, legFrame) {
    const cx = fx + 32; // center in frame
    const by = 50;      // body top

    const legOffsets = [
      { l: 0, r: 0 },
      { l: -1, r: 1 },
      { l: -1, r: 1 },
      { l: 0, r: 0 },
      { l: 1, r: -1 },
      { l: 1, r: -1 },
    ];
    const leg = legOffsets[legFrame];

    // Body (front view: ~14w × 10h, more compact)
    for (let y = 0; y < 10; y++) {
      for (let x = -7; x <= 7; x++) {
        const nx = x / 7, ny = (y - 5) / 5;
        const dist = nx * nx + ny * ny;
        if (dist > 1) continue;
        const px = cx + x, py = by + y;
        if (dist > 0.82) {
          setPixel(dd, 384, px, py, C.outline);
        } else if (ny > 0.3) {
          setPixel(dd, 384, px, py, C.bodyLt);
        } else {
          setPixel(dd, 384, px, py, C.body);
        }
      }
    }

    // Collar
    for (let x = -4; x <= 4; x++) {
      setPixel(dd, 384, cx + x, by + 1, C.collar);
    }
    setPixel(dd, 384, cx, by + 1, C.collarBuckle);

    // Head (above body, ~10×9)
    const hy = by - 6;
    for (let y = 0; y < 9; y++) {
      for (let x = -5; x <= 5; x++) {
        const nx = x / 5, ny = (y - 4) / 4.5;
        const dist = nx * nx + ny * ny;
        if (dist > 1) continue;
        const px = cx + x, py = hy + y;
        if (dist > 0.82) {
          setPixel(dd, 384, px, py, C.outline);
        } else if (ny < -0.3) {
          setPixel(dd, 384, px, py, C.bodyDk);
        } else {
          setPixel(dd, 384, px, py, C.body);
        }
      }
    }

    // Eyes (two dots, symmetrical)
    setPixel(dd, 384, cx - 3, hy + 3, C.eye);
    setPixel(dd, 384, cx - 2, hy + 3, C.eye);
    setPixel(dd, 384, cx + 2, hy + 3, C.eye);
    setPixel(dd, 384, cx + 3, hy + 3, C.eye);
    setPixel(dd, 384, cx - 2, hy + 2, C.eyeWhite);
    setPixel(dd, 384, cx + 3, hy + 2, C.eyeWhite);

    // Nose
    setPixel(dd, 384, cx, hy + 5, C.nose);
    setPixel(dd, 384, cx - 1, hy + 5, C.nose);

    // Mouth/tongue
    if (legFrame === 1 || legFrame === 2) {
      setPixel(dd, 384, cx, hy + 6, C.tongue);
      setPixel(dd, 384, cx, hy + 7, C.tongue);
    }

    // Ears (floppy, on sides)
    // Left ear
    setPixel(dd, 384, cx - 5, hy + 1, C.bodyDk);
    setPixel(dd, 384, cx - 6, hy + 1, C.bodyDk);
    setPixel(dd, 384, cx - 6, hy + 2, C.bodyDk);
    setPixel(dd, 384, cx - 7, hy + 1, C.outline);
    setPixel(dd, 384, cx - 7, hy + 2, C.outline);
    setPixel(dd, 384, cx - 6, hy + 3, C.outline);
    // Right ear
    setPixel(dd, 384, cx + 5, hy + 1, C.bodyDk);
    setPixel(dd, 384, cx + 6, hy + 1, C.bodyDk);
    setPixel(dd, 384, cx + 6, hy + 2, C.bodyDk);
    setPixel(dd, 384, cx + 7, hy + 1, C.outline);
    setPixel(dd, 384, cx + 7, hy + 2, C.outline);
    setPixel(dd, 384, cx + 6, hy + 3, C.outline);

    // Legs (front view: 4 legs visible, splayed)
    const legY = by + 9;
    // Front-left
    for (let ly = 0; ly < 4; ly++) {
      setPixel(dd, 384, cx - 4 + leg.l, legY + ly, C.bodyDk);
      setPixel(dd, 384, cx - 3 + leg.l, legY + ly, C.body);
    }
    setPixel(dd, 384, cx - 4 + leg.l, legY + 4, C.outline);
    setPixel(dd, 384, cx - 3 + leg.l, legY + 4, C.outline);
    // Front-right
    for (let ly = 0; ly < 4; ly++) {
      setPixel(dd, 384, cx + 3 + leg.r, legY + ly, C.body);
      setPixel(dd, 384, cx + 4 + leg.r, legY + ly, C.bodyDk);
    }
    setPixel(dd, 384, cx + 3 + leg.r, legY + 4, C.outline);
    setPixel(dd, 384, cx + 4 + leg.r, legY + 4, C.outline);
  }

  for (let f = 0; f < 6; f++) {
    drawFrontDog(dd, f * 64, f);
  }
  dctx.putImageData(dData, 0, 0);

  // ── BACK VIEW (facing up/away) ──
  const upCanvas = createCanvas('up', 384, 64);
  const uctx = upCanvas.getContext('2d');
  const uData = uctx.createImageData(384, 64);
  const ud = uData.data;

  function drawBackDog(d, fx, legFrame) {
    const cx = fx + 32;
    const by = 50;

    const legOffsets = [
      { l: 0, r: 0 },
      { l: -1, r: 1 },
      { l: -1, r: 1 },
      { l: 0, r: 0 },
      { l: 1, r: -1 },
      { l: 1, r: -1 },
    ];
    const leg = legOffsets[legFrame];

    // Body (back view: same shape as front)
    for (let y = 0; y < 10; y++) {
      for (let x = -7; x <= 7; x++) {
        const nx = x / 7, ny = (y - 5) / 5;
        const dist = nx * nx + ny * ny;
        if (dist > 1) continue;
        const px = cx + x, py = by + y;
        if (dist > 0.82) {
          setPixel(ud, 384, px, py, C.outline);
        } else if (ny < -0.3) {
          setPixel(ud, 384, px, py, C.bodyDk); // top darker from back
        } else {
          setPixel(ud, 384, px, py, C.body);
        }
      }
    }

    // Collar (visible as a line at top of body)
    for (let x = -4; x <= 4; x++) {
      setPixel(ud, 384, cx + x, by + 1, C.collar);
    }

    // Head (back of head, no face features)
    const hy = by - 6;
    for (let y = 0; y < 9; y++) {
      for (let x = -5; x <= 5; x++) {
        const nx = x / 5, ny = (y - 4) / 4.5;
        const dist = nx * nx + ny * ny;
        if (dist > 1) continue;
        const px = cx + x, py = hy + y;
        if (dist > 0.82) {
          setPixel(ud, 384, px, py, C.outline);
        } else {
          setPixel(ud, 384, px, py, C.bodyDk); // back of head is darker
        }
      }
    }

    // Ears (visible from back, slightly different shape)
    setPixel(ud, 384, cx - 5, hy + 1, C.bodyDk);
    setPixel(ud, 384, cx - 6, hy + 1, C.bodyDk);
    setPixel(ud, 384, cx - 6, hy + 2, C.bodyDk);
    setPixel(ud, 384, cx - 7, hy + 1, C.outline);
    setPixel(ud, 384, cx - 7, hy + 2, C.outline);
    setPixel(ud, 384, cx + 5, hy + 1, C.bodyDk);
    setPixel(ud, 384, cx + 6, hy + 1, C.bodyDk);
    setPixel(ud, 384, cx + 6, hy + 2, C.bodyDk);
    setPixel(ud, 384, cx + 7, hy + 1, C.outline);
    setPixel(ud, 384, cx + 7, hy + 2, C.outline);

    // Tail (visible from back, sticking up)
    setPixel(ud, 384, cx, by - 1, C.body);
    setPixel(ud, 384, cx, by - 2, C.body);
    if (legFrame % 2 === 0) {
      setPixel(ud, 384, cx - 1, by - 3, C.body);
      setPixel(ud, 384, cx - 1, by - 4, C.bodyLt);
    } else {
      setPixel(ud, 384, cx + 1, by - 3, C.body);
      setPixel(ud, 384, cx + 1, by - 4, C.bodyLt);
    }

    // Legs (same as front but body color uniform)
    const legY = by + 9;
    for (let ly = 0; ly < 4; ly++) {
      setPixel(ud, 384, cx - 4 + leg.l, legY + ly, C.bodyDk);
      setPixel(ud, 384, cx - 3 + leg.l, legY + ly, C.body);
    }
    setPixel(ud, 384, cx - 4 + leg.l, legY + 4, C.outline);
    setPixel(ud, 384, cx - 3 + leg.l, legY + 4, C.outline);
    for (let ly = 0; ly < 4; ly++) {
      setPixel(ud, 384, cx + 3 + leg.r, legY + ly, C.body);
      setPixel(ud, 384, cx + 4 + leg.r, legY + ly, C.bodyDk);
    }
    setPixel(ud, 384, cx + 3 + leg.r, legY + 4, C.outline);
    setPixel(ud, 384, cx + 4 + leg.r, legY + 4, C.outline);
  }

  for (let f = 0; f < 6; f++) {
    drawBackDog(ud, f * 64, f);
  }
  uctx.putImageData(uData, 0, 0);

  // ── MARKER (16×16 thumbnail from front view frame 0) ──
  // Draw a tiny dog face
  const mCanvas = createCanvas('marker', 16, 16);
  const mctx = mCanvas.getContext('2d');
  const mData = mctx.createImageData(16, 16);
  const md = mData.data;

  function mp(x, y, col) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    const i = (y * 16 + x) * 4;
    md[i] = col[0]; md[i+1] = col[1]; md[i+2] = col[2]; md[i+3] = 255;
  }

  // Head circle
  for (let y = 2; y < 13; y++) {
    for (let x = 3; x < 13; x++) {
      const cx = x - 7.5, cy = y - 7;
      const dist = cx * cx / 25 + cy * cy / 25;
      if (dist > 1) continue;
      if (dist > 0.75) mp(x, y, C.outline);
      else mp(x, y, C.body);
    }
  }
  // Eyes
  mp(6, 6, C.eye); mp(9, 6, C.eye);
  mp(6, 5, C.eyeWhite); mp(9, 5, C.eyeWhite);
  // Nose
  mp(7, 8, C.nose); mp(8, 8, C.nose);
  // Tongue
  mp(8, 9, C.tongue);
  // Ears
  mp(3, 4, C.bodyDk); mp(2, 4, C.bodyDk); mp(2, 5, C.bodyDk);
  mp(12, 4, C.bodyDk); mp(13, 4, C.bodyDk); mp(13, 5, C.bodyDk);
  // Collar
  for (let x = 5; x <= 10; x++) mp(x, 11, C.collar);
  mp(8, 11, C.collarBuckle);
  // Body hint
  for (let x = 5; x <= 10; x++) {
    mp(x, 12, C.body);
    mp(x, 13, C.bodyLt);
  }

  mctx.putImageData(mData, 0, 0);

}, { C });

// Save all outputs
await saveCanvas(page, '#side', 'apps/client/public/assets/sprites/npcs/dog/Run.png');
await saveCanvas(page, '#down', 'apps/client/public/assets/sprites/npcs/dog/Run_Down.png');
await saveCanvas(page, '#up', 'apps/client/public/assets/sprites/npcs/dog/Run_Up.png');
await saveCanvas(page, '#marker', 'apps/client/public/assets/sprites/markers/npc_dog.png');

await savePreview(page, ['#side', '#down', '#up', '#marker'], '/tmp/dog-npc-preview.png');
console.log('\n[dog-npc] Done! Preview at /tmp/dog-npc-preview.png');
await cleanup();
