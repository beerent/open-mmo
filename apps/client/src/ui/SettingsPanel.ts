import {
  Action,
  getBindings,
  rebind,
  loadBindings,
  formatCodeLabel,
  getCodesForAction,
} from "../input/KeyBindings";


interface ActionRow {
  action: Action;
  label: string;
  slotCount: number;
}

const ACTION_ROWS: ActionRow[] = [
  { action: Action.MoveUp, label: "Move Up", slotCount: 2 },
  { action: Action.MoveDown, label: "Move Down", slotCount: 2 },
  { action: Action.MoveLeft, label: "Move Left", slotCount: 2 },
  { action: Action.MoveRight, label: "Move Right", slotCount: 2 },
  { action: Action.Pickup, label: "Pick Up", slotCount: 1 },
  { action: Action.Inventory, label: "Inventory", slotCount: 1 },
  { action: Action.Chat, label: "Chat", slotCount: 1 },
  { action: Action.Debug, label: "Debug", slotCount: 1 },
];

const IGNORED_KEYS = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

export class SettingsPanel {
  private container: HTMLDivElement;
  private rowsEl: HTMLDivElement;
  private visible = false;
  private listening: { action: Action; slotIndex: number } | null = null;
  private listeningEl: HTMLElement | null = null;

  onBindingsChanged?: () => void;
  onToggle?: (open: boolean) => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "settings-panel";

    this.container.innerHTML = `
      <div class="settings-titlebar">
        <span class="settings-title">Key Bindings</span>
        <span class="settings-close">&times;</span>
      </div>
      <div class="settings-rows"></div>
      <div class="settings-footer">
        <button class="settings-reset">Reset to Defaults</button>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.container);
    this.rowsEl = this.container.querySelector(
      ".settings-rows"
    ) as HTMLDivElement;

    this.container
      .querySelector(".settings-close")!
      .addEventListener("click", () => this.close());

    this.container
      .querySelector(".settings-reset")!
      .addEventListener("click", () => this.resetDefaults());

    // Escape key: cancel listening or close panel
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.listening) {
          this.cancelListening();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (this.visible) {
          this.close();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        // Not visible — open
        this.open();
        e.stopPropagation();
        e.preventDefault();
      }
    });

    // Capture-phase listener for binding keys
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.listening) return;
        if (e.key === "Escape") return; // handled above
        if (IGNORED_KEYS.has(e.code)) return;

        e.preventDefault();
        e.stopPropagation();

        this.assignKey(this.listening.action, this.listening.slotIndex, e.code);
        this.listening = null;
        this.render();
        this.onBindingsChanged?.();
      },
      true
    );

    this.render();
  }

  private open() {
    this.visible = true;
    this.container.classList.add("open");
    this.render();
    this.onToggle?.(true);
  }

  private close() {
    this.cancelListening();
    this.visible = false;
    this.container.classList.remove("open");
    this.onToggle?.(false);
  }

  private cancelListening() {
    if (this.listening && this.listeningEl) {
      // Restore the original label
      const codes = getCodesForAction(this.listening.action);
      const code = codes[this.listening.slotIndex];
      this.listeningEl.textContent = code ? formatCodeLabel(code) : "+";
      this.listeningEl.classList.remove("listening");
    }
    this.listening = null;
    this.listeningEl = null;
  }

  private assignKey(action: Action, slotIndex: number, newCode: string) {
    const bindings = getBindings();

    // Steal from any other action that has this code
    for (const otherAction of Object.keys(bindings) as Action[]) {
      const codes = bindings[otherAction];
      const idx = codes.indexOf(newCode);
      if (idx !== -1) {
        const updated = codes.filter((_, i) => i !== idx);
        rebind(otherAction, updated);
      }
    }

    // Assign to the target slot
    const current = [...getCodesForAction(action)];
    // Ensure array is large enough
    while (current.length <= slotIndex) current.push("");
    current[slotIndex] = newCode;
    // Filter out empty strings
    rebind(action, current.filter((c) => c !== ""));
  }

  private resetDefaults() {
    localStorage.removeItem("shireland_keybindings");
    loadBindings();
    this.render();
    this.onBindingsChanged?.();
  }

  private render() {
    const bindings = getBindings();
    let html = "";

    for (const row of ACTION_ROWS) {
      const codes = bindings[row.action];
      html += `<div class="settings-row">`;
      html += `<span class="settings-label">${row.label}</span>`;
      html += `<div class="settings-keys">`;

      for (let i = 0; i < row.slotCount; i++) {
        const code = codes[i];
        const label = code ? formatCodeLabel(code) : "+";
        const isListening =
          this.listening?.action === row.action &&
          this.listening?.slotIndex === i;
        const cls = isListening ? "settings-key listening" : "settings-key";
        const display = isListening ? "..." : label;
        html += `<span class="${cls}" data-action="${row.action}" data-slot="${i}">${display}</span>`;
      }

      html += `</div></div>`;
    }

    this.rowsEl.innerHTML = html;

    // Bind click handlers for key slots
    this.rowsEl.querySelectorAll(".settings-key").forEach((el) => {
      el.addEventListener("click", () => {
        const action = (el as HTMLElement).dataset.action as Action;
        const slotIndex = parseInt((el as HTMLElement).dataset.slot!, 10);

        // Cancel previous listening
        this.cancelListening();

        // Enter listening mode
        this.listening = { action, slotIndex };
        this.listeningEl = el as HTMLElement;
        (el as HTMLElement).textContent = "...";
        (el as HTMLElement).classList.add("listening");
      });
    });
  }

  private addStyles() {
    if (document.getElementById("settings-styles")) return;
    const style = document.createElement("style");
    style.id = "settings-styles";
    style.textContent = `
      #settings-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 600;
        background: linear-gradient(to bottom, #3a2a1a, #2a1c10);
        border: 2px solid #6b5430;
        border-top-color: #8a7040;
        border-left-color: #8a7040;
        border-radius: 2px;
        font-family: 'Press Start 2P', monospace;
        color: #e0d0a0;
        display: none;
        box-shadow: inset 0 0 0 1px #1a0e04, 0 4px 12px rgba(0,0,0,0.6);
        user-select: none;
        min-width: 340px;
      }
      #settings-panel.open {
        display: block;
      }

      .settings-titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(to bottom, #4a3520, #3a2510);
        border-bottom: 1px solid #6b5430;
        padding: 8px 12px;
      }
      .settings-title {
        font-size: 12px;
        color: #c8a84e;
        text-shadow: 1px 1px 0 #000;
      }
      .settings-close {
        font-size: 18px;
        color: #886644;
        cursor: pointer;
        line-height: 1;
        font-family: sans-serif;
      }
      .settings-close:hover {
        color: #ccaa66;
      }

      .settings-rows {
        padding: 10px 12px;
      }

      .settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid rgba(107, 84, 48, 0.3);
      }
      .settings-row:last-child {
        border-bottom: none;
      }

      .settings-label {
        font-size: 9px;
        color: #c8a84e;
        text-shadow: 1px 1px 0 #000;
        min-width: 100px;
      }

      .settings-keys {
        display: flex;
        gap: 6px;
      }

      .settings-key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        height: 28px;
        padding: 0 8px;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid #4a3820;
        border-top-color: #2a1a0a;
        border-left-color: #2a1a0a;
        border-bottom-color: #5a4830;
        border-right-color: #5a4830;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        color: #e0d0a0;
        cursor: pointer;
        text-shadow: 1px 1px 0 #000;
      }
      .settings-key:hover {
        border-color: #c8a84e;
      }
      .settings-key.listening {
        border-color: #c8a84e;
        color: #c8a84e;
        animation: settings-blink 0.6s ease-in-out infinite alternate;
      }

      @keyframes settings-blink {
        from { border-color: #c8a84e; color: #c8a84e; }
        to { border-color: #6b5430; color: #6b5430; }
      }

      .settings-footer {
        padding: 8px 12px 10px;
        border-top: 1px solid #6b5430;
        text-align: center;
      }

      .settings-reset {
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #886644;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #4a3820;
        padding: 6px 14px;
        cursor: pointer;
        text-shadow: 1px 1px 0 #000;
      }
      .settings-reset:hover {
        color: #ccaa66;
        border-color: #6b5430;
      }
    `;
    document.head.appendChild(style);
  }
}
