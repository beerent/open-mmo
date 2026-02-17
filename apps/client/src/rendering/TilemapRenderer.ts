import { Container, BaseTexture, Texture, Rectangle, Sprite, SCALE_MODES } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import { TILE_SIZE, DISPLAY_SCALE } from "@shireland/shared";
import type { TiledMap, TiledTileset, TiledLayer } from "@shireland/shared";

interface LoadedTileset {
  firstgid: number;
  tilecount: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  baseTexture: BaseTexture;
  textures: Map<number, Texture>; // gid -> Texture
}

export class TilemapRenderer {
  readonly container: Container;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly collisionData: number[];

  private layers: CompositeTilemap[] = [];
  private overlayLayer: CompositeTilemap;
  private loadedTilesets: LoadedTileset[] = [];
  private allTextures = new Map<number, Texture>();
  private _objectSprites: Sprite[] = [];

  private constructor(mapData: TiledMap) {
    this.container = new Container();
    this.container.scale.set(DISPLAY_SCALE);
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;

    const collisionLayer = mapData.layers.find((l) => l.name === "collision");
    this.collisionData = collisionLayer?.data ?? [];

    this.overlayLayer = new CompositeTilemap();
  }

  static async create(mapData: TiledMap): Promise<TilemapRenderer> {
    const renderer = new TilemapRenderer(mapData);
    await renderer.loadTilesets(mapData.tilesets);
    renderer.buildLayers(mapData);
    return renderer;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }

  private async loadTilesets(tilesets: TiledTileset[]) {
    for (const ts of tilesets) {
      if (ts.tiles && ts.tiles.length > 0) {
        // Image collection tileset — each tile has its own image
        await this.loadCollectionTileset(ts);
      } else if (ts.image) {
        // Atlas tileset — single image, grid of tiles
        await this.loadAtlasTileset(ts);
      }
    }

    console.log(
      `[Shireland] Loaded ${this.loadedTilesets.length} tilesets, ${this.allTextures.size} tiles`
    );
  }

  private async loadAtlasTileset(ts: TiledTileset) {
    try {
      const img = await this.loadImage(ts.image!);
      const baseTexture = BaseTexture.from(img, { scaleMode: SCALE_MODES.NEAREST });

      const textures = new Map<number, Texture>();
      const cols = ts.columns || Math.floor(ts.imagewidth! / ts.tilewidth);
      const rows = Math.floor(ts.imageheight! / ts.tileheight);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const localId = row * cols + col;
          const gid = ts.firstgid + localId;
          const frame = new Rectangle(
            col * ts.tilewidth,
            row * ts.tileheight,
            ts.tilewidth,
            ts.tileheight
          );
          textures.set(gid, new Texture(baseTexture, frame));
        }
      }

      this.loadedTilesets.push({
        firstgid: ts.firstgid,
        tilecount: ts.tilecount,
        columns: cols,
        tilewidth: ts.tilewidth,
        tileheight: ts.tileheight,
        baseTexture,
        textures,
      });

      for (const [gid, tex] of textures) {
        this.allTextures.set(gid, tex);
      }
    } catch {
      console.warn(`[Shireland] Failed to load tileset: ${ts.image}`);
    }
  }

  private async loadCollectionTileset(ts: TiledTileset) {
    for (const tileEntry of ts.tiles!) {
      try {
        const img = await this.loadImage(tileEntry.image);
        const baseTexture = BaseTexture.from(img, { scaleMode: SCALE_MODES.NEAREST });
        const gid = ts.firstgid + tileEntry.id;
        const tex = new Texture(baseTexture);
        this.allTextures.set(gid, tex);
      } catch {
        console.warn(`[Shireland] Failed to load collection tile: ${tileEntry.image}`);
      }
    }
  }

  private buildLayers(mapData: TiledMap) {
    for (const layer of mapData.layers) {
      if (!layer.visible) continue;
      if (layer.name === "collision") continue;

      if (layer.type === "tilelayer" && layer.data) {
        this.buildTileLayer(layer, mapData.width);
      } else if (layer.type === "objectgroup" && layer.objects) {
        this.buildObjectLayer(layer);
      }
    }
  }

  private buildTileLayer(layer: TiledLayer, mapWidth: number) {
    const tilemap = new CompositeTilemap();

    for (let i = 0; i < layer.data!.length; i++) {
      const gid = layer.data![i];
      if (gid === 0) continue;

      const tex = this.allTextures.get(gid);
      if (!tex) continue;

      const col = i % mapWidth;
      const row = Math.floor(i / mapWidth);
      tilemap.tile(tex, col * TILE_SIZE, row * TILE_SIZE);
    }

    this.layers.push(tilemap);
    this.container.addChild(tilemap);
  }

  private buildObjectLayer(layer: TiledLayer) {
    for (const obj of layer.objects!) {
      if (!obj.gid) continue;

      const tex = this.allTextures.get(obj.gid);
      if (!tex) continue;

      const sprite = new Sprite(tex);
      // Tiled object y is the BOTTOM of the object
      sprite.x = obj.x;
      sprite.y = obj.y - (obj.height ?? 0);
      sprite.width = obj.width ?? 0;
      sprite.height = obj.height ?? 0;
      // Sort by the object's ground-contact line, not its bottom pixel.
      // For buildings, the bottom ~30% of the sprite is front-facing wall/steps
      // that should render in front of characters at the same depth.
      (sprite as any).sortY = obj.y - (obj.height ?? 0) * 0.3;

      this._objectSprites.push(sprite);
    }
  }

  /** Object sprites that need y-sorting with players */
  get objectSprites(): Sprite[] {
    return this._objectSprites;
  }

  getOverlayLayer(): CompositeTilemap {
    return this.overlayLayer;
  }

  isPassable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return false;
    }
    const idx = tileY * this.mapWidth + tileX;
    return this.collisionData[idx] === 0;
  }

  getPixelWidth(): number {
    return this.mapWidth * TILE_SIZE * DISPLAY_SCALE;
  }

  getPixelHeight(): number {
    return this.mapHeight * TILE_SIZE * DISPLAY_SCALE;
  }
}
