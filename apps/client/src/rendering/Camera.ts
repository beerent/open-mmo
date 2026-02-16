import { Container } from "pixi.js";
import { DISPLAY_SCALE, TILE_SIZE } from "@shireland/shared";

export class Camera {
  private worldContainer: Container;
  private screenWidth: number;
  private screenHeight: number;
  private mapPixelWidth: number;
  private mapPixelHeight: number;

  constructor(
    worldContainer: Container,
    screenWidth: number,
    screenHeight: number,
    mapPixelWidth: number,
    mapPixelHeight: number
  ) {
    this.worldContainer = worldContainer;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.mapPixelWidth = mapPixelWidth;
    this.mapPixelHeight = mapPixelHeight;
  }

  resize(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /** Follow a target at tile coordinates (tileX, tileY) */
  follow(tileX: number, tileY: number) {
    // Convert tile coords to scaled pixel coords (center of tile)
    const targetPixelX = (tileX + 0.5) * TILE_SIZE * DISPLAY_SCALE;
    const targetPixelY = (tileY + 0.5) * TILE_SIZE * DISPLAY_SCALE;

    // Camera position = center target on screen
    let camX = this.screenWidth / 2 - targetPixelX;
    let camY = this.screenHeight / 2 - targetPixelY;

    // Clamp to map bounds
    const maxX = 0;
    const maxY = 0;
    const minX = this.screenWidth - this.mapPixelWidth;
    const minY = this.screenHeight - this.mapPixelHeight;

    if (this.mapPixelWidth > this.screenWidth) {
      camX = Math.max(minX, Math.min(maxX, camX));
    } else {
      camX = (this.screenWidth - this.mapPixelWidth) / 2;
    }

    if (this.mapPixelHeight > this.screenHeight) {
      camY = Math.max(minY, Math.min(maxY, camY));
    } else {
      camY = (this.screenHeight - this.mapPixelHeight) / 2;
    }

    this.worldContainer.x = Math.round(camX);
    this.worldContainer.y = Math.round(camY);
  }
}
