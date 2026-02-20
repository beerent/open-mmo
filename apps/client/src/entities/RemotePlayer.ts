import { Container } from "pixi.js";
import { Direction, MOVE_DURATION_MS } from "@shireland/shared";
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

    // Apply initial equipment
    if (data.equipment) {
      this.renderer.applyEquipment(data.equipment);
    }
  }

  static async create(data: PlayerData): Promise<RemotePlayer> {
    const renderer = await PlayerRenderer.create(data.playerClass);
    return new RemotePlayer(data, renderer);
  }

  getTileX(): number { return this.tileX; }
  getTileY(): number { return this.tileY; }

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
