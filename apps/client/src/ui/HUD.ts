import { AuthClient } from "../network/AuthClient";

export class HUD {
  private container: HTMLDivElement;
  private coordsEl: HTMLSpanElement;
  private playersEl: HTMLSpanElement;
  private actionBtn: HTMLButtonElement;
  private isGuest = false;
  onLogout?: () => void;
  onRegister?: () => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "hud";
    this.container.innerHTML = `
      <span id="hud-coords"></span>
      <span id="hud-players"></span>
      <button id="hud-action">Logout</button>
    `;

    this.addStyles();
    document.body.appendChild(this.container);

    this.coordsEl = document.getElementById("hud-coords") as HTMLSpanElement;
    this.playersEl = document.getElementById("hud-players") as HTMLSpanElement;
    this.actionBtn = document.getElementById("hud-action") as HTMLButtonElement;

    this.actionBtn.addEventListener("click", async () => {
      if (this.isGuest) {
        this.onRegister?.();
      } else {
        await AuthClient.logout();
        this.onLogout?.();
      }
    });
  }

  setGuestMode(isGuest: boolean) {
    this.isGuest = isGuest;
    if (isGuest) {
      this.actionBtn.textContent = "Register";
      this.actionBtn.id = "hud-action";
      this.actionBtn.classList.add("hud-register");
    } else {
      this.actionBtn.textContent = "Logout";
      this.actionBtn.classList.remove("hud-register");
    }
  }

  private addStyles() {
    if (document.getElementById("hud-styles")) return;
    const style = document.createElement("style");
    style.id = "hud-styles";
    style.textContent = `
      #hud {
        position: fixed;
        top: 8px;
        right: 12px;
        z-index: 100;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: #aaa;
        text-shadow: 1px 1px 0 #000;
        display: flex;
        gap: 16px;
        align-items: center;
      }

      #hud-action {
        background: transparent;
        border: 1px solid #555;
        color: #888;
        font-family: 'Press Start 2P', monospace;
        font-size: 6px;
        padding: 4px 8px;
        cursor: pointer;
      }

      #hud-action:hover {
        border-color: #aaa;
        color: #ccc;
      }

      #hud-action.hud-register {
        border-color: #e6b422;
        color: #e6b422;
      }

      #hud-action.hud-register:hover {
        border-color: #ffc832;
        color: #ffc832;
      }
    `;
    document.head.appendChild(style);
  }

  updateCoords(x: number, y: number) {
    this.coordsEl.textContent = `(${x}, ${y})`;
  }

  updatePlayerCount(count: number) {
    this.playersEl.textContent = `${count} online`;
  }
}
