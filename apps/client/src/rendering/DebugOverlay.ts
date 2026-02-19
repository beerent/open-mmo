import { Container, Graphics, Text } from "pixi.js";
import { TILE_SIZE } from "@shireland/shared";
import type { NpcRouteWaypoint } from "@shireland/shared";

const FPS_SAMPLES = 60;

export class DebugOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private coordText: Text;
  private visible = false;

  private collisionData: number[] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  private routes: Record<string, NpcRouteWaypoint[]> = {};

  // Performance tracking
  private statsEl: HTMLDivElement;
  private frameTimes: number[] = [];
  private statsTimer = 0;

  constructor(collisionData: number[], mapWidth: number, mapHeight: number, routes: Record<string, NpcRouteWaypoint[]> = {}) {
    this.collisionData = collisionData;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.routes = routes;

    this.container = new Container();
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

    this.statsEl = document.createElement("div");
    this.statsEl.id = "debug-stats";
    this.addStyles();
    document.body.appendChild(this.statsEl);

    this.draw();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    this.statsEl.classList.toggle("open", this.visible);
    console.log(`[Debug] overlay ${this.visible ? 'ON' : 'OFF'}, collision tiles: ${this.collisionData.filter(v => v !== 0).length}`);
  }

  isVisible(): boolean {
    return this.visible;
  }

  updatePlayerPos(tileX: number, tileY: number): void {
    if (!this.visible) return;
    this.coordText.text = `tile: ${tileX},${tileY}`;
  }

  updateStats(dt: number, playerCount: number): void {
    if (!this.visible) return;

    this.frameTimes.push(dt);
    if (this.frameTimes.length > FPS_SAMPLES) this.frameTimes.shift();

    // Update DOM at ~4 Hz to avoid layout thrash
    this.statsTimer += dt;
    if (this.statsTimer < 250) return;
    this.statsTimer = 0;

    const avg =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = Math.round(1000 / avg);
    const frameMs = avg.toFixed(1);
    const worst = Math.max(...this.frameTimes).toFixed(1);

    const mem = (performance as any).memory;
    let memLine = "";
    if (mem) {
      const used = (mem.usedJSHeapSize / 1048576).toFixed(1);
      const total = (mem.jsHeapSizeLimit / 1048576).toFixed(0);
      memLine = `MEM  ${used} / ${total} MB\n`;
    }

    this.statsEl.textContent =
      `FPS  ${fps}\n` +
      `AVG  ${frameMs} ms\n` +
      `MAX  ${worst} ms\n` +
      memLine +
      `PLR  ${playerCount}`;
  }

  private addStyles(): void {
    if (document.getElementById("debug-stats-styles")) return;
    const style = document.createElement("style");
    style.id = "debug-stats-styles";
    style.textContent = `
      #debug-stats {
        position: fixed;
        top: 8px;
        right: 8px;
        z-index: 900;
        background: rgba(0, 0, 0, 0.75);
        border: 1px solid #4a3820;
        padding: 8px 12px;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        line-height: 1.8;
        color: #88ff88;
        white-space: pre;
        display: none;
        pointer-events: none;
        text-shadow: 1px 1px 0 #000;
      }
      #debug-stats.open {
        display: block;
      }
    `;
    document.head.appendChild(style);
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

    // Draw NPC route waypoints — one color per route
    const ROUTE_COLORS = [
      0xffc800, // gold
      0x3c8cff, // blue
      0xff4444, // red
      0x44ff44, // green
      0xff44ff, // magenta
      0x44ffff, // cyan
      0xff8800, // orange
      0x8844ff, // purple
      0xffff44, // yellow
      0xff88aa, // pink
    ];
    const half = TILE_SIZE / 2;
    const r = TILE_SIZE * 0.3;
    let routeIdx = 0;
    for (const waypoints of Object.values(this.routes)) {
      const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
      routeIdx++;

      // Draw connections between adjacent waypoints
      g.lineStyle(1, color, 0.3);
      for (const wp of waypoints) {
        for (const other of waypoints) {
          const dx = Math.abs(wp.tileX - other.tileX);
          const dy = Math.abs(wp.tileY - other.tileY);
          if (dx + dy === 1) {
            g.moveTo(wp.tileX * TILE_SIZE + half, wp.tileY * TILE_SIZE + half);
            g.lineTo(other.tileX * TILE_SIZE + half, other.tileY * TILE_SIZE + half);
          }
        }
      }

      // Draw dots
      g.lineStyle(0);
      for (const wp of waypoints) {
        const cx = wp.tileX * TILE_SIZE + half;
        const cy = wp.tileY * TILE_SIZE + half;
        g.beginFill(color, 0.7);
        g.drawCircle(cx, cy, r);
        g.endFill();
      }
    }
  }
}
