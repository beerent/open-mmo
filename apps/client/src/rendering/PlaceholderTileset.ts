import { BaseTexture, Texture, Rectangle, SCALE_MODES } from "pixi.js";
import { TILE_SIZE } from "@shireland/shared";

// Tile indices (1-based in Tiled, 0 = empty)
// 1=grass, 2=dirt path, 3=stone wall, 4=wood floor, 5=house wall,
// 6=tree, 7=border wall, 8=fence, 9=roof, 10=well
const TILE_COLORS: Record<number, string> = {
  1: "#4a7c3f", // grass
  2: "#c4a35a", // dirt path
  3: "#7a7a7a", // stone wall
  4: "#8b6914", // wood floor
  5: "#6b4423", // house wall (brown)
  6: "#2d5a1e", // tree (dark green)
  7: "#3a3a3a", // border wall (dark gray)
  8: "#8b7355", // fence (tan)
  9: "#8b2500", // roof (dark red)
  10: "#5a5a6a", // well (blue-gray)
};

const COLS = 10;
const ROWS = 3;

export function createPlaceholderTileset(): {
  baseTexture: BaseTexture;
  textures: Map<number, Texture>;
} {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const textures = new Map<number, Texture>();

  for (const [idStr, color] of Object.entries(TILE_COLORS)) {
    const id = Number(idStr);
    const col = (id - 1) % COLS;
    const row = Math.floor((id - 1) / COLS);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Add a subtle border for visual definition
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    // Add detail patterns per tile type
    switch (id) {
      case 1: // grass - add small dots
        ctx.fillStyle = "#5a8c4f";
        ctx.fillRect(x + 3, y + 5, 1, 1);
        ctx.fillRect(x + 10, y + 2, 1, 1);
        ctx.fillRect(x + 7, y + 11, 1, 1);
        ctx.fillRect(x + 13, y + 8, 1, 1);
        break;
      case 2: // dirt - add pebbles
        ctx.fillStyle = "#b49342";
        ctx.fillRect(x + 4, y + 6, 2, 1);
        ctx.fillRect(x + 11, y + 3, 1, 2);
        ctx.fillRect(x + 8, y + 12, 2, 1);
        break;
      case 5: // house wall - add brick lines
        ctx.strokeStyle = "#5a3413";
        ctx.lineWidth = 1;
        for (let by = 0; by < TILE_SIZE; by += 4) {
          ctx.beginPath();
          ctx.moveTo(x, y + by + 0.5);
          ctx.lineTo(x + TILE_SIZE, y + by + 0.5);
          ctx.stroke();
        }
        break;
      case 6: // tree - add trunk and canopy
        ctx.fillStyle = "#6b4423";
        ctx.fillRect(x + 6, y + 10, 4, 6);
        ctx.fillStyle = "#3a7a2e";
        ctx.fillRect(x + 2, y + 2, 12, 10);
        ctx.fillStyle = "#4a8a3e";
        ctx.fillRect(x + 4, y + 1, 8, 8);
        break;
      case 9: // roof - add shingle pattern
        ctx.fillStyle = "#7a1500";
        for (let ry = 0; ry < TILE_SIZE; ry += 4) {
          ctx.fillRect(x, y + ry, TILE_SIZE, 1);
        }
        break;
      case 10: // well - draw a circle
        ctx.fillStyle = "#4a4a5a";
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2a3a6a";
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  const baseTexture = BaseTexture.from(canvas, { scaleMode: SCALE_MODES.NEAREST });
  baseTexture.setSize(canvas.width, canvas.height);

  for (const idStr of Object.keys(TILE_COLORS)) {
    const id = Number(idStr);
    const col = (id - 1) % COLS;
    const row = Math.floor((id - 1) / COLS);
    const frame = new Rectangle(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    textures.set(id, new Texture(baseTexture, frame));
  }

  return { baseTexture, textures };
}
