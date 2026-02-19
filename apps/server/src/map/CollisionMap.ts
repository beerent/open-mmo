import { readFileSync } from "fs";
import { resolve } from "path";
import type { TiledMap } from "@shireland/shared";

export class CollisionMap {
  private width: number;
  private height: number;
  private data: number[];
  private dynamicBlockers = new Set<number>();
  private dynamicPassable = new Set<number>();
  private spawnX: number | null = null;
  private spawnY: number | null = null;

  constructor(mapPath: string) {
    const raw = readFileSync(resolve(mapPath), "utf-8");
    const mapData: TiledMap = JSON.parse(raw);

    this.width = mapData.width;
    this.height = mapData.height;

    const collisionLayer = mapData.layers.find((l) => l.name === "collision");
    this.data = collisionLayer?.data ?? [];

    // Look for a spawn_point object in object layers (point or tile object)
    for (const layer of mapData.layers) {
      if (layer.type !== "objectgroup" || !layer.objects) continue;
      const sp = layer.objects.find(
        (o) => o.name === "spawn_point",
      );
      if (sp) {
        // Tile objects have y at bottom of tile; point objects have y at the point
        const pixelY = sp.gid ? sp.y - mapData.tileheight : sp.y;
        this.spawnX = Math.floor(sp.x / mapData.tilewidth);
        this.spawnY = Math.floor(pixelY / mapData.tileheight);
        break;
      }
    }
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

  /** Find multiple passable tiles near a center point (for item scatter) */
  findNearbyPassable(cx: number, cy: number, count: number): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    for (let r = 0; r < Math.max(this.width, this.height) && result.length < count; r++) {
      for (let dx = -r; dx <= r && result.length < count; dx++) {
        for (let dy = -r; dy <= r && result.length < count; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.isPassable(x, y)) result.push({ x, y });
        }
      }
    }
    return result;
  }

  /** Find a passable tile near the spawn point (or center as fallback) */
  findSpawn(): { x: number; y: number } {
    const cx = this.spawnX ?? Math.floor(this.width / 2);
    const cy = this.spawnY ?? Math.floor(this.height / 2);

    // Spiral outward from spawn point
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
