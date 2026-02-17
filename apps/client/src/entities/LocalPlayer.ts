import { Container } from "pixi.js";
import { Direction, MOVE_DURATION_MS, DIR_DELTA } from "@shireland/shared";
import type { EquipmentLoadout } from "@shireland/shared";
import { PlayerRenderer } from "../rendering/PlayerRenderer";

export class LocalPlayer {
  readonly sprite: Container;
  private renderer: PlayerRenderer;

  tileX: number;
  tileY: number;
  direction: Direction = Direction.Down;

  private moving = false;
  private moveStartX = 0;
  private moveStartY = 0;
  private moveTargetX = 0;
  private moveTargetY = 0;
  private moveElapsed = 0;

  private isPassable: (x: number, y: number) => boolean;
  onMoveStart?: (direction: Direction) => void;

  private constructor(
    startX: number,
    startY: number,
    renderer: PlayerRenderer,
    isPassable: (x: number, y: number) => boolean
  ) {
    this.tileX = startX;
    this.tileY = startY;
    this.isPassable = isPassable;
    this.renderer = renderer;
    this.sprite = this.renderer.container;
    this.renderer.setPosition(startX, startY);
  }

  static async create(
    startX: number,
    startY: number,
    playerClass: string,
    isPassable: (x: number, y: number) => boolean
  ): Promise<LocalPlayer> {
    const renderer = await PlayerRenderer.create(playerClass);
    return new LocalPlayer(startX, startY, renderer, isPassable);
  }

  tryMove(direction: Direction): boolean {
    if (this.moving) return false;

    this.direction = direction;
    this.renderer.setDirection(direction);

    const { dx, dy } = DIR_DELTA[direction];
    const targetX = this.tileX + dx;
    const targetY = this.tileY + dy;

    if (!this.isPassable(targetX, targetY)) return false;

    this.moving = true;
    this.moveStartX = this.tileX;
    this.moveStartY = this.tileY;
    this.moveTargetX = targetX;
    this.moveTargetY = targetY;
    this.moveElapsed = 0;

    this.tileX = targetX;
    this.tileY = targetY;

    this.renderer.setWalking(true);
    this.onMoveStart?.(direction);

    return true;
  }

  update(dt: number) {
    this.renderer.update(dt);

    if (!this.moving) return;

    this.moveElapsed += dt;
    const t = Math.min(this.moveElapsed / MOVE_DURATION_MS, 1);

    const lerpX = this.moveStartX + (this.moveTargetX - this.moveStartX) * t;
    const lerpY = this.moveStartY + (this.moveTargetY - this.moveStartY) * t;

    this.renderer.setPosition(lerpX, lerpY);

    if (t >= 1) {
      this.moving = false;
      this.renderer.setWalking(false);
    }
  }

  applyEquipment(equipment: EquipmentLoadout) {
    this.renderer.applyEquipment(equipment);
  }

  isMoving(): boolean {
    return this.moving;
  }

  getVisualTileX(): number {
    if (!this.moving) return this.tileX;
    const t = Math.min(this.moveElapsed / MOVE_DURATION_MS, 1);
    return this.moveStartX + (this.moveTargetX - this.moveStartX) * t;
  }

  getVisualTileY(): number {
    if (!this.moving) return this.tileY;
    const t = Math.min(this.moveElapsed / MOVE_DURATION_MS, 1);
    return this.moveStartY + (this.moveTargetY - this.moveStartY) * t;
  }

  snapTo(tileX: number, tileY: number) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.moving = false;
    this.renderer.setWalking(false);
    this.renderer.setPosition(tileX, tileY);
  }
}
