import { Container, Graphics, Text } from "pixi.js";
import { TILE_SIZE, DISPLAY_SCALE } from "@shireland/shared";

export class DebugOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private coordText: Text;
  private visible = false;

  private collisionData: number[] = [];
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(collisionData: number[], mapWidth: number, mapHeight: number) {
    this.collisionData = collisionData;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.container = new Container();
    this.container.scale.set(DISPLAY_SCALE);
    this.container.visible = false;

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.coordText = new Text("", {
      fontSize: 6,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1,
    });
    this.coordText.x = 2;
    this.coordText.y = 2;
    this.container.addChild(this.coordText);

    this.draw();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    console.log(`[Debug] overlay ${this.visible ? 'ON' : 'OFF'}, collision tiles: ${this.collisionData.filter(v => v !== 0).length}`);
  }

  updatePlayerPos(tileX: number, tileY: number): void {
    if (!this.visible) return;
    this.coordText.text = `tile: ${tileX},${tileY}`;
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    // Draw grid lines
    g.lineStyle(0.5, 0x888888, 0.2);
    for (let x = 0; x <= this.mapWidth; x++) {
      g.moveTo(x * TILE_SIZE, 0);
      g.lineTo(x * TILE_SIZE, this.mapHeight * TILE_SIZE);
    }
    for (let y = 0; y <= this.mapHeight; y++) {
      g.moveTo(0, y * TILE_SIZE);
      g.lineTo(this.mapWidth * TILE_SIZE, y * TILE_SIZE);
    }

    // Draw collision tiles
    g.lineStyle(0);
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const idx = y * this.mapWidth + x;
        if (this.collisionData[idx] !== 0) {
          g.beginFill(0xff0000, 0.3);
          g.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.endFill();
        }
      }
    }
  }
}
