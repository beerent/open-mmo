import { Container, Text } from "pixi.js";
import { Direction, TILE_SIZE, NPC_MOVE_DURATION_MS } from "@shireland/shared";
import type { NpcData } from "@shireland/shared";
import { PlayerRenderer } from "../rendering/PlayerRenderer";

export class NpcEntity {
  readonly sprite: Container;
  readonly id: string;
  readonly npcType!: string;
  readonly hasDialog!: boolean;
  name: string;

  private renderer: PlayerRenderer;
  private tileX: number;
  private tileY: number;

  private lerpFromX: number;
  private lerpFromY: number;
  private lerpToX: number;
  private lerpToY: number;
  private lerpElapsed = 0;
  private lerping = false;

  private debugText: Text;
  private debugVisible = false;

  private constructor(data: NpcData & { debug?: string }, renderer: PlayerRenderer) {
    this.id = data.id;
    this.npcType = data.npcType;
    this.name = data.name;
    this.hasDialog = data.hasDialog;
    this.tileX = data.x;
    this.tileY = data.y;

    this.lerpFromX = data.x;
    this.lerpFromY = data.y;
    this.lerpToX = data.x;
    this.lerpToY = data.y;

    this.renderer = renderer;
    this.renderer.setDirection(data.direction);
    this.renderer.setPosition(data.x, data.y);

    this.sprite = this.renderer.container;

    // Debug text (hidden by default)
    this.debugText = new Text("", {
      fontSize: 5,
      fill: 0x88ff88,
      stroke: 0x000000,
      strokeThickness: 1,
      align: "center",
    });
    this.debugText.anchor.set(0.5, 1);
    this.debugText.x = TILE_SIZE / 2;
    this.debugText.y = -28;
    this.debugText.visible = false;
    this.sprite.addChild(this.debugText);

    if (data.debug) {
      this.debugText.text = data.debug;
    }
  }

  static async create(data: NpcData & { debug?: string }): Promise<NpcEntity> {
    const renderer = await PlayerRenderer.create(`npcs/${data.npcType}`);
    return new NpcEntity(data, renderer);
  }

  getTileX(): number { return this.tileX; }
  getTileY(): number { return this.tileY; }

  setDebug(text: string): void {
    this.debugText.text = text;
  }

  setDebugVisible(visible: boolean): void {
    if (this.debugVisible === visible) return;
    this.debugVisible = visible;
    this.debugText.visible = visible;
  }

  moveTo(x: number, y: number, direction: Direction) {
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

  update(dt: number) {
    this.renderer.update(dt);

    if (!this.lerping) return;

    this.lerpElapsed += dt;
    const t = Math.min(this.lerpElapsed / NPC_MOVE_DURATION_MS, 1);

    const visualX = this.lerpFromX + (this.lerpToX - this.lerpFromX) * t;
    const visualY = this.lerpFromY + (this.lerpToY - this.lerpFromY) * t;

    this.renderer.setPosition(visualX, visualY);

    if (t >= 1) {
      this.lerping = false;
      this.renderer.setWalking(false);
    }
  }

  private getCurrentVisualX(): number {
    const t = Math.min(this.lerpElapsed / NPC_MOVE_DURATION_MS, 1);
    return this.lerpFromX + (this.lerpToX - this.lerpFromX) * t;
  }

  private getCurrentVisualY(): number {
    const t = Math.min(this.lerpElapsed / NPC_MOVE_DURATION_MS, 1);
    return this.lerpFromY + (this.lerpToY - this.lerpFromY) * t;
  }
}
