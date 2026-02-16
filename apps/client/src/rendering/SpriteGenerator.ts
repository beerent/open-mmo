import { BaseTexture, Texture, Rectangle, SCALE_MODES } from "pixi.js";
import { getAssetPath, getEquipAssetPath } from "@shireland/shared";

// Pixel Crawler NPC sprites — 4-directional support
// Run.png:      6 frames of 64x64 (384x64) — side view
// Run_Down.png: 6 frames of 64x64 (384x64) — front view
// Run_Up.png:   6 frames of 64x64 (384x64) — back view
// Idle.png:     4 frames of 32x32 (128x32) — side view

const RUN_FRAME_W = 64;
const RUN_FRAME_H = 64;

// We use 4 walk frames (skip 2 from the 6-frame run to match our SPRITE_FRAMES=4)
const WALK_FRAME_COUNT = 4;
// Pick frames 0,1,3,4 from the 6-frame run for a good walk cycle
const WALK_FRAME_INDICES = [0, 1, 3, 4];

// Canonical frame size for the engine (largest frame)
export const CHAR_FRAME_W = RUN_FRAME_W;
export const CHAR_FRAME_H = RUN_FRAME_H;

/**
 * Direction config: which sprite sheet and flip setting to use per direction.
 * 0 = Down      → Run_Down.png,      no flip
 * 1 = Left      → Run.png,           flip horizontally
 * 2 = Right     → Run.png,           no flip
 * 3 = Up        → Run_Up.png,        no flip
 * 4 = DownLeft  → Run_DownRight.png, flip horizontally
 * 5 = DownRight → Run_DownRight.png, no flip
 * 6 = UpLeft    → Run_UpRight.png,   flip horizontally
 * 7 = UpRight   → Run_UpRight.png,   no flip
 */
const DIR_CONFIG: { sheet: "side" | "down" | "up" | "downright" | "upright"; flip: boolean }[] = [
  { sheet: "down",      flip: false }, // Down
  { sheet: "side",      flip: true },  // Left
  { sheet: "side",      flip: false }, // Right
  { sheet: "up",        flip: false }, // Up
  { sheet: "downright", flip: true },  // DownLeft
  { sheet: "downright", flip: false }, // DownRight
  { sheet: "upright",   flip: true },  // UpLeft
  { sheet: "upright",   flip: false }, // UpRight
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Extract frames from a horizontal sprite strip, optionally flipping,
 * and center them in CHAR_FRAME_W x CHAR_FRAME_H cells.
 */
function extractFrames(
  img: HTMLImageElement,
  frameW: number,
  frameH: number,
  frameIndices: number[],
  flip: boolean
): HTMLCanvasElement {
  const count = frameIndices.length;
  const canvas = document.createElement("canvas");
  canvas.width = CHAR_FRAME_W * count;
  canvas.height = CHAR_FRAME_H;
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < count; i++) {
    const srcIdx = frameIndices[i];
    const destX = i * CHAR_FRAME_W;
    // Center smaller frames in the canonical cell
    const offX = (CHAR_FRAME_W - frameW) / 2;
    const offY = CHAR_FRAME_H - frameH; // align feet to bottom

    ctx.save();
    if (flip) {
      ctx.translate(destX + CHAR_FRAME_W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        srcIdx * frameW, 0, frameW, frameH,
        offX, offY, frameW, frameH
      );
    } else {
      ctx.drawImage(
        img,
        srcIdx * frameW, 0, frameW, frameH,
        destX + offX, offY, frameW, frameH
      );
    }
    ctx.restore();
  }

  return canvas;
}

/**
 * Try to load an image, returning null on failure instead of throwing.
 */
function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  return loadImage(src).catch(() => null);
}

/**
 * Build textures[direction][frame] from up to five sheet images.
 * Diagonal sheets fall back to front/back, then side.
 */
function buildDirectionTextures(
  sideImg: HTMLImageElement,
  downImg: HTMLImageElement | null,
  upImg: HTMLImageElement | null,
  downRightImg: HTMLImageElement | null = null,
  upRightImg: HTMLImageElement | null = null
): Texture[][] {
  const sheets: Record<string, HTMLImageElement> = {
    side: sideImg,
    down: downImg ?? sideImg,
    up: upImg ?? sideImg,
    downright: downRightImg ?? downImg ?? sideImg,
    upright: upRightImg ?? upImg ?? sideImg,
  };

  const textures: Texture[][] = [];

  for (let dir = 0; dir < 8; dir++) {
    const { sheet, flip } = DIR_CONFIG[dir];
    const img = sheets[sheet];
    const strip = extractFrames(img, RUN_FRAME_W, RUN_FRAME_H, WALK_FRAME_INDICES, flip);
    const baseTex = BaseTexture.from(strip, { scaleMode: SCALE_MODES.NEAREST });
    const frames: Texture[] = [];
    for (let f = 0; f < WALK_FRAME_COUNT; f++) {
      frames.push(
        new Texture(baseTex, new Rectangle(f * CHAR_FRAME_W, 0, CHAR_FRAME_W, CHAR_FRAME_H))
      );
    }
    textures.push(frames);
  }

  return textures;
}

/**
 * Load character textures for a player class.
 * Returns textures[direction][frame] — 8 directions, 4 frames each.
 *
 * Loads up to 5 sprite sheets: Run.png (side), Run_Down.png (front),
 * Run_Up.png (back), Run_DownRight.png (diagonal front), Run_UpRight.png (diagonal back).
 * Falls back gracefully for any missing sheets.
 */
export function createCharacterTextures(
  playerClass: string
): Promise<Texture[][]> {
  const classDir = playerClass === "wizard" ? "wizard" : "warrior";
  const base = `/assets/sprites/${classDir}`;

  return Promise.all([
    loadImage(`${base}/Run.png`),              // side (required)
    tryLoadImage(`${base}/Run_Down.png`),       // front (optional)
    tryLoadImage(`${base}/Run_Up.png`),          // back (optional)
    tryLoadImage(`${base}/Run_DownRight.png`),   // diagonal front (optional)
    tryLoadImage(`${base}/Run_UpRight.png`),     // diagonal back (optional)
  ]).then(([sideImg, downImg, upImg, downRightImg, upRightImg]) => {
    return buildDirectionTextures(sideImg, downImg, upImg, downRightImg, upRightImg);
  }).catch(() => {
    console.warn("[Shireland] Failed to load character sprites, using fallback");
    return createFallbackTextures();
  });
}

/**
 * Load equipment overlay textures for an item.
 * Returns textures[direction][frame] — same shape as character textures (8 directions).
 * Returns null if the equipment sprites don't exist.
 */
export async function createEquipmentTextures(
  itemId: string
): Promise<Texture[][] | null> {
  try {
    const sideImg = await tryLoadImage(getEquipAssetPath(itemId, "side"));
    if (!sideImg) return null; // No equipment sprites available

    const downImg = await tryLoadImage(getEquipAssetPath(itemId, "down"));
    const upImg = await tryLoadImage(getEquipAssetPath(itemId, "up"));
    const downRightImg = await tryLoadImage(getEquipAssetPath(itemId, "downright"));
    const upRightImg = await tryLoadImage(getEquipAssetPath(itemId, "upright"));

    return buildDirectionTextures(sideImg, downImg, upImg, downRightImg, upRightImg);
  } catch {
    return null;
  }
}

/**
 * Load an item sprite (icon or world) as a single texture.
 */
export async function loadItemTexture(
  itemId: string,
  type: "icon" | "world"
): Promise<Texture | null> {
  try {
    const path = getAssetPath(itemId, type);
    const img = await tryLoadImage(path);
    if (!img) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    return Texture.from(canvas, { scaleMode: SCALE_MODES.NEAREST });
  } catch {
    return null;
  }
}

/** Programmatic fallback if sprites aren't available */
function createFallbackTextures(): Texture[][] {
  const canvas = document.createElement("canvas");
  canvas.width = CHAR_FRAME_W * WALK_FRAME_COUNT;
  canvas.height = CHAR_FRAME_H * 8;
  const ctx = canvas.getContext("2d")!;

  for (let dir = 0; dir < 8; dir++) {
    for (let frame = 0; frame < WALK_FRAME_COUNT; frame++) {
      const ox = frame * CHAR_FRAME_W;
      const oy = dir * CHAR_FRAME_H;
      ctx.fillStyle = "#3388ff";
      ctx.fillRect(ox + 16, oy + 16, 32, 40);
      ctx.fillStyle = "#f0c090";
      ctx.fillRect(ox + 20, oy + 6, 24, 18);
    }
  }

  const baseTexture = BaseTexture.from(canvas, { scaleMode: SCALE_MODES.NEAREST });
  const textures: Texture[][] = [];
  for (let dir = 0; dir < 8; dir++) {
    const frames: Texture[] = [];
    for (let frame = 0; frame < WALK_FRAME_COUNT; frame++) {
      frames.push(
        new Texture(
          baseTexture,
          new Rectangle(frame * CHAR_FRAME_W, dir * CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAME_H)
        )
      );
    }
    textures.push(frames);
  }
  return textures;
}
