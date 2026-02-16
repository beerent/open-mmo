import { Container, Sprite, Texture, SCALE_MODES } from "pixi.js";
import { TILE_SIZE } from "@shireland/shared";
import type { WorldItem } from "@shireland/shared";
import { loadItemTexture } from "./SpriteGenerator";

export class ItemRenderer {
  readonly container = new Container();
  private items = new Map<string, { sprite: Sprite; x: number; y: number }>();
  private textureCache = new Map<string, Texture>();
  private fallbackTexture: Texture;

  constructor() {
    this.fallbackTexture = this.createFallbackTexture();
  }

  private createFallbackTexture(): Texture {
    const size = 10;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 1;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#4488ff";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();

    return Texture.from(canvas, { scaleMode: SCALE_MODES.NEAREST } as any);
  }

  private async getTexture(itemId: string): Promise<Texture> {
    const cached = this.textureCache.get(itemId);
    if (cached) return cached;

    const tex = await loadItemTexture(itemId, "world");
    if (tex) {
      this.textureCache.set(itemId, tex);
      return tex;
    }

    return this.fallbackTexture;
  }

  async addItem(item: WorldItem): Promise<void> {
    if (this.items.has(item.id)) return;

    const texture = await this.getTexture(item.itemId);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(1.5);
    sprite.x = item.x * TILE_SIZE + TILE_SIZE / 2;
    sprite.y = item.y * TILE_SIZE + TILE_SIZE / 2;

    this.container.addChild(sprite);
    this.items.set(item.id, { sprite, x: item.x, y: item.y });
  }

  removeItem(id: string): void {
    const entry = this.items.get(id);
    if (entry) {
      this.container.removeChild(entry.sprite);
      this.items.delete(id);
    }
  }

  getItemAtTile(tileX: number, tileY: number): string | null {
    for (const [id, entry] of this.items) {
      if (entry.x === tileX && entry.y === tileY) return id;
    }
    return null;
  }
}
