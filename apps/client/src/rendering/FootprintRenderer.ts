import { Container, Sprite, Texture, SCALE_MODES } from "pixi.js";
import { Direction, TILE_SIZE } from "@shireland/shared";

interface Footprint {
  sprite: Sprite;
  age: number;
}

const HOLD_TIME = 1000;    // ms at full alpha
const FADE_TIME = 3000;    // ms to fade from 1→0
const MAX_FOOTPRINTS = 100;

// Direction → rotation in radians (Down=0°, Left=90°, Right=-90°, Up=180°)
const DIR_ROTATION: Record<Direction, number> = {
  [Direction.Down]: 0,
  [Direction.Left]: Math.PI / 2,
  [Direction.Right]: -Math.PI / 2,
  [Direction.Up]: Math.PI,
};

export class FootprintRenderer {
  readonly container = new Container();
  private footprints: Footprint[] = [];
  private texture: Texture;

  constructor() {
    this.texture = this.createTexture();
  }

  private createTexture(): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d")!;

    // Two small boot-print ellipses in a sandy brown
    ctx.fillStyle = "rgba(120, 90, 50, 0.5)";

    // Left boot
    ctx.beginPath();
    ctx.ellipse(5, 8, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right boot
    ctx.beginPath();
    ctx.ellipse(11, 8, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    return Texture.from(canvas, { scaleMode: SCALE_MODES.NEAREST } as any);
  }

  spawn(tileX: number, tileY: number, direction: Direction): void {
    // Enforce cap — remove oldest first
    while (this.footprints.length >= MAX_FOOTPRINTS) {
      const oldest = this.footprints.shift()!;
      this.container.removeChild(oldest.sprite);
      oldest.sprite.destroy();
    }

    const sprite = new Sprite(this.texture);
    sprite.anchor.set(0.5);
    sprite.x = tileX * TILE_SIZE + TILE_SIZE / 2;
    sprite.y = tileY * TILE_SIZE + TILE_SIZE / 2;
    sprite.rotation = DIR_ROTATION[direction];

    this.container.addChild(sprite);
    this.footprints.push({ sprite, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const fp = this.footprints[i];
      fp.age += dt;

      if (fp.age > HOLD_TIME + FADE_TIME) {
        // Expired — remove
        this.container.removeChild(fp.sprite);
        fp.sprite.destroy();
        this.footprints.splice(i, 1);
      } else if (fp.age > HOLD_TIME) {
        // Fading
        fp.sprite.alpha = 1 - (fp.age - HOLD_TIME) / FADE_TIME;
      }
    }
  }
}
