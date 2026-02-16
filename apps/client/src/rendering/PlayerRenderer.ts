import { Container, Sprite, Texture } from "pixi.js";
import { Direction, TILE_SIZE, WALK_ANIM_FPS } from "@shireland/shared";
import type { EquipmentLoadout } from "@shireland/shared";
import {
  createCharacterTextures,
  createEquipmentTextures,
  CHAR_FRAME_W,
  CHAR_FRAME_H,
} from "./SpriteGenerator";

export class PlayerRenderer {
  readonly container: Container;
  private bodySprite: Sprite;
  private bodyTextures: Texture[][]; // [direction][frame]

  // Equipment overlays keyed by itemId
  private equipSprites = new Map<string, Sprite>();
  private equipTextures = new Map<string, Texture[][]>();

  private currentDir: Direction = Direction.Down;
  private animFrame = 0;
  private animTimer = 0;
  private walking = false;

  private constructor(textures: Texture[][]) {
    this.bodyTextures = textures;

    this.container = new Container();
    this.bodySprite = new Sprite(this.bodyTextures[Direction.Down][0]);

    // Offset sprite so feet align with tile center
    this.bodySprite.x = -(CHAR_FRAME_W - TILE_SIZE) / 2;
    this.bodySprite.y = -(CHAR_FRAME_H - TILE_SIZE);

    this.container.addChild(this.bodySprite);
  }

  static async create(playerClass: string): Promise<PlayerRenderer> {
    const textures = await createCharacterTextures(playerClass);
    return new PlayerRenderer(textures);
  }

  setDirection(dir: Direction) {
    this.currentDir = dir;
    this.bodySprite.texture = this.bodyTextures[dir][this.animFrame];
    this.updateEquipTextures();
  }

  setWalking(walking: boolean) {
    if (!walking && this.walking) {
      this.animFrame = 0;
      this.animTimer = 0;
      this.bodySprite.texture = this.bodyTextures[this.currentDir][0];
      this.updateEquipTextures();
    }
    this.walking = walking;
  }

  update(dt: number) {
    if (!this.walking) return;

    this.animTimer += dt;
    const frameInterval = 1000 / WALK_ANIM_FPS;

    if (this.animTimer >= frameInterval) {
      this.animTimer -= frameInterval;
      this.animFrame = (this.animFrame + 1) % 4;
      this.bodySprite.texture = this.bodyTextures[this.currentDir][this.animFrame];
      this.updateEquipTextures();
    }
  }

  setPosition(tileX: number, tileY: number) {
    this.container.x = tileX * TILE_SIZE;
    this.container.y = tileY * TILE_SIZE;
  }

  /**
   * Apply equipment loadout — add/remove overlay sprites as needed.
   */
  async applyEquipment(equipment: EquipmentLoadout) {
    // Determine which item IDs should be shown
    const wantedItems = new Set<string>();
    if (equipment.mainHand) wantedItems.add(equipment.mainHand);

    // Remove equipment that's no longer equipped
    for (const [itemId, sprite] of this.equipSprites) {
      if (!wantedItems.has(itemId)) {
        this.container.removeChild(sprite);
        this.equipSprites.delete(itemId);
        this.equipTextures.delete(itemId);
      }
    }

    // Add new equipment
    for (const itemId of wantedItems) {
      if (this.equipSprites.has(itemId)) continue;

      const textures = await createEquipmentTextures(itemId);
      if (!textures) continue;

      this.equipTextures.set(itemId, textures);

      const sprite = new Sprite(textures[this.currentDir][this.animFrame]);
      sprite.x = -(CHAR_FRAME_W - TILE_SIZE) / 2;
      sprite.y = -(CHAR_FRAME_H - TILE_SIZE);

      this.equipSprites.set(itemId, sprite);
      // Insert equipment after body but before name tags / chat bubbles
      const bodyIndex = this.container.getChildIndex(this.bodySprite);
      this.container.addChildAt(sprite, bodyIndex + 1);
    }
  }

  private updateEquipTextures() {
    for (const [itemId, sprite] of this.equipSprites) {
      const textures = this.equipTextures.get(itemId);
      if (textures) {
        sprite.texture = textures[this.currentDir][this.animFrame];
      }
    }
  }
}
