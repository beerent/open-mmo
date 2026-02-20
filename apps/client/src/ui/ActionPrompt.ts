export class ActionPrompt {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "action-prompt";
    this.el.style.display = "none";
    this.addStyles();
    document.body.appendChild(this.el);
  }

  private addStyles() {
    if (document.getElementById("action-prompt-styles")) return;
    const style = document.createElement("style");
    style.id = "action-prompt-styles";
    style.textContent = `
      #action-prompt {
        position: fixed;
        z-index: 250;
        pointer-events: none;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: #e0d0a0;
        background: rgba(20, 12, 28, 0.85);
        border: 1px solid #c8a84e;
        border-radius: 3px;
        padding: 4px 8px;
        text-shadow: 1px 1px 0 #000;
        white-space: nowrap;
        transform: translateX(-50%);
      }
      #action-prompt .action-key {
        color: #c8a84e;
      }
    `;
    document.head.appendChild(style);
  }

  show(keyLabel: string, actionText: string, screenX: number, screenY: number): void {
    this.el.innerHTML = `<span class="action-key">[${keyLabel}]</span> ${actionText}`;
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }
}
