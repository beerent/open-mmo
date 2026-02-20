export const Action = {
  MoveUp: "move_up",
  MoveDown: "move_down",
  MoveLeft: "move_left",
  MoveRight: "move_right",
  Pickup: "pickup",
  Inventory: "inventory",
  Debug: "debug",
  Chat: "chat",
  QuestLog: "quest_log",
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export type KeyMap = Record<Action, string[]>;

const STORAGE_KEY = "shireland_keybindings";

const DEFAULT_BINDINGS: KeyMap = {
  move_up: ["KeyW", "ArrowUp"],
  move_down: ["KeyS", "ArrowDown"],
  move_left: ["KeyA", "ArrowLeft"],
  move_right: ["KeyD", "ArrowRight"],
  pickup: ["KeyE"],
  inventory: ["KeyI"],
  debug: ["KeyP"],
  chat: ["KeyT"],
  quest_log: ["KeyQ"],
};

let bindings: KeyMap = structuredClone(DEFAULT_BINDINGS);

export function loadBindings(): void {
  bindings = structuredClone(DEFAULT_BINDINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const overrides = JSON.parse(raw) as Partial<KeyMap>;
      for (const key of Object.keys(overrides) as Action[]) {
        if (key in bindings && Array.isArray(overrides[key])) {
          bindings[key] = overrides[key]!;
        }
      }
    }
  } catch {
    // Corrupted data — fall back to defaults
  }
}

export function getBindings(): KeyMap {
  return bindings;
}

export function getCodesForAction(action: Action): string[] {
  return bindings[action];
}

export function getPrimaryKeyLabel(action: Action): string {
  const code = bindings[action][0];
  return formatCodeLabel(code);
}

export function rebind(action: Action, codes: string[]): void {
  bindings[action] = codes;
  // Persist only overrides (actions that differ from defaults)
  const overrides: Partial<KeyMap> = {};
  for (const key of Object.keys(bindings) as Action[]) {
    const def = DEFAULT_BINDINGS[key];
    const cur = bindings[key];
    if (
      cur.length !== def.length ||
      cur.some((c, i) => c !== def[i])
    ) {
      overrides[key] = cur;
    }
  }
  if (Object.keys(overrides).length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function formatCodeLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const arrows: Record<string, string> = {
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
  };
  if (code in arrows) return arrows[code];
  if (code === "Space") return "Space";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  return code;
}
