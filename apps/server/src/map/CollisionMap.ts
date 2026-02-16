import { readFileSync } from "fs";
import { resolve } from "path";
import type { TiledMap } from "@shireland/shared";

export class CollisionMap {
  private width: number;
  private height: number;
  private data: number[];
  private dynamicBlockers = new Set<number>();
  private dynamicPassable = new Set<number>();

  constructor(mapPath: string) {
    const raw = readFileSync(resolve(mapPath), "utf-8");
    const mapData: TiledMap = JSON.parse(raw);

    this.width = mapData.width;
    this.height = mapData.height;

    const collisionLayer = mapData.layers.find((l) => l.name === "collision");
    this.data = collisionLayer?.data ?? [];
  }

  isPassable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    const idx = y * this.width + x;
    if (this.dynamicBlockers.has(idx)) return false;
    if (this.dynamicPassable.has(idx)) return true;
    return this.data[idx] === 0;
  }

  /** Dynamically block a tile (e.g. NPC standing on it) */
  block(x: number, y: number): void {
    const idx = y * this.width + x;
    this.dynamicBlockers.add(idx);
    this.dynamicPassable.delete(idx);
  }

  /** Remove a dynamic blocker from a tile */
  unblock(x: number, y: number): void {
    const idx = y * this.width + x;
    this.dynamicBlockers.delete(idx);
  }

  /** Dynamically make a statically-blocked tile passable (e.g. open door) */
  openPassage(x: number, y: number): void {
    const idx = y * this.width + x;
    this.dynamicPassable.add(idx);
    this.dynamicBlockers.delete(idx);
  }

  /** Remove a dynamic passage override, restoring static collision */
  closePassage(x: number, y: number): void {
    const idx = y * this.width + x;
    this.dynamicPassable.delete(idx);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /** Find a passable tile near the center for spawning */
  findSpawn(): { x: number; y: number } {
    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);

    // Spiral outward from center
    for (let r = 0; r < Math.max(this.width, this.height); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.isPassable(x, y)) return { x, y };
        }
      }
    }
    return { x: cx, y: cy };
  }
}
