import { Direction } from "@shireland/shared";
import { Action, getBindings } from "./KeyBindings";

const ACTION_TO_DIR: Partial<Record<Action, Direction>> = {
  move_up: Direction.Up,
  move_down: Direction.Down,
  move_left: Direction.Left,
  move_right: Direction.Right,
};

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<Action>();
  private directionStack: Direction[] = [];
  private dirCodeStack: string[] = [];
  private _chatFocused = false;
  private _paused = false;

  private codeToAction = new Map<string, Action>();
  private codeToDir = new Map<string, Direction>();

  constructor() {
    this.rebuildLookups();

    window.addEventListener("keydown", (e) => {
      if (this._chatFocused || this._paused) return;
      if (!this.keys.has(e.code)) {
        const action = this.codeToAction.get(e.code);
        if (action) {
          this.justPressed.add(action);
        }
        const dir = this.codeToDir.get(e.code);
        if (dir !== undefined) {
          this.directionStack.push(dir);
          this.dirCodeStack.push(e.code);
        }
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      const idx = this.dirCodeStack.indexOf(e.code);
      if (idx !== -1) {
        this.dirCodeStack.splice(idx, 1);
        this.directionStack.splice(idx, 1);
      }
    });
    // Clear keys on blur to prevent stuck keys
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressed.clear();
      this.directionStack.length = 0;
      this.dirCodeStack.length = 0;
    });
  }

  rebuildLookups() {
    this.codeToAction.clear();
    this.codeToDir.clear();
    const bindings = getBindings();
    for (const action of Object.keys(bindings) as Action[]) {
      for (const code of bindings[action]) {
        this.codeToAction.set(code, action);
        const dir = ACTION_TO_DIR[action];
        if (dir !== undefined) {
          this.codeToDir.set(code, dir);
        }
      }
    }
  }

  set chatFocused(v: boolean) {
    this._chatFocused = v;
    if (v) {
      this.keys.clear();
      this.justPressed.clear();
      this.directionStack.length = 0;
      this.dirCodeStack.length = 0;
    }
  }

  get chatFocused(): boolean {
    return this._chatFocused;
  }

  set paused(v: boolean) {
    this._paused = v;
    if (v) {
      this.keys.clear();
      this.justPressed.clear();
      this.directionStack.length = 0;
      this.dirCodeStack.length = 0;
    }
  }

  getDirection(): Direction | null {
    if (this.directionStack.length === 0) return null;
    return this.directionStack[this.directionStack.length - 1];
  }

  isActionPressed(action: Action): boolean {
    return this.justPressed.has(action);
  }

  clearActions(): void {
    this.justPressed.clear();
  }
}
