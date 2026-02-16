import { TICK_MS } from "@shireland/shared";

export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTick: () => void;

  constructor(onTick: () => void) {
    this.onTick = onTick;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.onTick();
    }, TICK_MS);
    console.log(`[Shireland] Game loop started (${Math.round(1000 / TICK_MS)} tick/sec)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
