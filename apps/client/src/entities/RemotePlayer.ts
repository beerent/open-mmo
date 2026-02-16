import { Container, Text } from "pixi.js";
import { Direction, TILE_SIZE, MOVE_DURATION_MS } from "@shireland/shared";
import type { PlayerData, EquipmentLoadout } from "@shireland/shared";
import { PlayerRenderer } from "../rendering/PlayerRenderer";

export class RemotePlayer {
  readonly sprite: Container;
  readonly id: string;
  name: string;
  direction: Direction;

  private renderer: PlayerRenderer;
  private tileX: number;
  private tileY: number;

  private lerpFromX: number;
  private lerpFromY: number;
  private lerpToX: number;
  private lerpToY: number;
  private lerpElapsed = 0;
  private lerping = false;

  private constructor(data: PlayerData, renderer: PlayerRenderer) {
    this.id = data.id;
    this.name = data.name;
    this.tileX = data.x;
    this.tileY = data.y;
    this.direction = data.direction;

    this.lerpFromX = data.x;
    this.lerpFromY = data.y;
    this.lerpToX = data.x;
    this.lerpToY = data.y;

    this.renderer = renderer;
    this.renderer.setDirection(data.direction);
    this.renderer.setPosition(data.x, data.y);

    this.sprite = this.renderer.container;

    // Name tag
    const nameTag = new Text(data.name, {
      fontSize: 7,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1,
      align: "center",
    });
    nameTag.anchor.set(0.5, 1);
    nameTag.x = TILE_SIZE / 2;
    nameTag.y = -20;
    this.sprite.addChild(nameTag);

    // Apply initial equipment
    if (data.equipment) {
      this.renderer.applyEquipment(data.equipment);
    }
  }

  static async create(data: PlayerData): Promise<RemotePlayer> {
    const renderer = await PlayerRenderer.create(data.playerClass);
    return new RemotePlayer(data, renderer);
  }

  moveTo(x: number, y: number, direction: Direction) {
    this.direction = direction;
    this.renderer.setDirection(direction);
    this.renderer.setWalking(true);

    this.lerpFromX = this.lerping ? this.getCurrentVisualX() : this.tileX;
    this.lerpFromY = this.lerping ? this.getCurrentVisualY() : this.tileY;
    this.lerpToX = x;
    this.lerpToY = y;
    this.lerpElapsed = 0;
    this.lerping = true;
    this.tileX = x;
    this.tileY = y;
  }

  applyEquipment(equipment: EquipmentLoadout) {
    this.renderer.applyEquipment(equipment);
  }

  update(dt: number) {
    this.renderer.update(dt);

    if (!this.lerping) return;

    this.lerpElapsed += dt;
    const t = Math.min(this.lerpElapsed / MOVE_DURATION_MS, 1);

    const visualX = this.lerpFromX + (this.lerpToX - this.lerpFromX) * t;
    const visualY = this.lerpFromY + (this.lerpToY - this.lerpFromY) * t;

    this.renderer.setPosition(visualX, visualY);

    if (t >= 1) {
      this.lerping = false;
      this.renderer.setWalking(false);
    }
  }

  private getCurrentVisualX(): number {
    const t = Math.min(this.lerpElapsed / MOVE_DURATION_MS, 1);
    return this.lerpFromX + (this.lerpToX - this.lerpFromX) * t;
  }

  private getCurrentVisualY(): number {
    const t = Math.min(this.lerpElapsed / MOVE_DURATION_MS, 1);
    return this.lerpFromY + (this.lerpToY - this.lerpFromY) * t;
  }
}
