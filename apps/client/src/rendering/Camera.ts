import { Container } from "pixi.js";
import { TILE_SIZE } from "@shireland/shared";

export class Camera {
  private worldContainer: Container;
  private viewWidth: number;
  private viewHeight: number;
  private mapPixelWidth: number;
  private mapPixelHeight: number;

  constructor(
    worldContainer: Container,
    viewWidth: number,
    viewHeight: number,
    mapPixelWidth: number,
    mapPixelHeight: number
  ) {
    this.worldContainer = worldContainer;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.mapPixelWidth = mapPixelWidth;
    this.mapPixelHeight = mapPixelHeight;
  }

  resize(viewWidth: number, viewHeight: number) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  /** Follow a target at tile coordinates (tileX, tileY) */
  follow(tileX: number, tileY: number) {
    // Convert tile coords to 1x pixel coords (center of tile)
    const targetPixelX = (tileX + 0.5) * TILE_SIZE;
    const targetPixelY = (tileY + 0.5) * TILE_SIZE;

    // Camera position = center target in viewport
    let camX = this.viewWidth / 2 - targetPixelX;
    let camY = this.viewHeight / 2 - targetPixelY;

    // Clamp to map bounds
    const maxX = 0;
    const maxY = 0;
    const minX = this.viewWidth - this.mapPixelWidth;
    const minY = this.viewHeight - this.mapPixelHeight;

    if (this.mapPixelWidth > this.viewWidth) {
      camX = Math.max(minX, Math.min(maxX, camX));
    } else {
      camX = (this.viewWidth - this.mapPixelWidth) / 2;
    }

    if (this.mapPixelHeight > this.viewHeight) {
      camY = Math.max(minY, Math.min(maxY, camY));
    } else {
      camY = (this.viewHeight - this.mapPixelHeight) / 2;
    }

    this.worldContainer.x = Math.round(camX);
    this.worldContainer.y = Math.round(camY);
  }
}
