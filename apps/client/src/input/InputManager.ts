import { Direction } from "@shireland/shared";

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private shiftCombos = new Set<string>();
  private _chatFocused = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (this._chatFocused) return;
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
        if (e.shiftKey) {
          this.shiftCombos.add(e.code);
        }
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    // Clear keys on blur to prevent stuck keys
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressed.clear();
    });
  }

  set chatFocused(v: boolean) {
    this._chatFocused = v;
    if (v) {
      this.keys.clear();
      this.justPressed.clear();
    }
  }

  get chatFocused(): boolean {
    return this._chatFocused;
  }

  getDirection(): Direction | null {
    const up    = this.keys.has("ArrowUp")    || this.keys.has("KeyW");
    const down  = this.keys.has("ArrowDown")  || this.keys.has("KeyS");
    const left  = this.keys.has("ArrowLeft")  || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");

    const v = up && down ? null : up ? "up" : down ? "down" : null;
    const h = left && right ? null : left ? "left" : right ? "right" : null;

    if (v === "up"   && h === "left")  return Direction.UpLeft;
    if (v === "up"   && h === "right") return Direction.UpRight;
    if (v === "down" && h === "left")  return Direction.DownLeft;
    if (v === "down" && h === "right") return Direction.DownRight;
    if (v === "up")   return Direction.Up;
    if (v === "down") return Direction.Down;
    if (h === "left")  return Direction.Left;
    if (h === "right") return Direction.Right;
    return null;
  }

  isActionPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  isShiftActionPressed(code: string): boolean {
    return this.shiftCombos.has(code);
  }

  clearActions(): void {
    this.justPressed.clear();
    this.shiftCombos.clear();
  }
}
