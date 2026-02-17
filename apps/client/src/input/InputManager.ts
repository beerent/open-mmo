import { Direction } from "@shireland/shared";

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: Direction.Up,
  KeyW: Direction.Up,
  ArrowDown: Direction.Down,
  KeyS: Direction.Down,
  ArrowLeft: Direction.Left,
  KeyA: Direction.Left,
  ArrowRight: Direction.Right,
  KeyD: Direction.Right,
};

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private shiftCombos = new Set<string>();
  private directionStack: string[] = [];
  private _chatFocused = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (this._chatFocused) return;
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
        if (e.shiftKey) {
          this.shiftCombos.add(e.code);
        }
        if (e.code in DIRECTION_KEYS) {
          this.directionStack.push(e.code);
        }
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      const idx = this.directionStack.indexOf(e.code);
      if (idx !== -1) {
        this.directionStack.splice(idx, 1);
      }
    });
    // Clear keys on blur to prevent stuck keys
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressed.clear();
      this.directionStack.length = 0;
    });
  }

  set chatFocused(v: boolean) {
    this._chatFocused = v;
    if (v) {
      this.keys.clear();
      this.justPressed.clear();
      this.directionStack.length = 0;
    }
  }

  get chatFocused(): boolean {
    return this._chatFocused;
  }

  getDirection(): Direction | null {
    if (this.directionStack.length === 0) return null;
    const lastKey = this.directionStack[this.directionStack.length - 1];
    return DIRECTION_KEYS[lastKey] ?? null;
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
