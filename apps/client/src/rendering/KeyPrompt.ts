export class KeyPrompt {
  readonly el: HTMLDivElement;

  constructor(key: string, action: string) {
    this.el = document.createElement("div");
    this.el.id = "key-prompt";
    this.el.textContent = `[${key}] ${action}`;
    this.addStyles();
    document.body.appendChild(this.el);
  }

  private addStyles() {
    if (document.getElementById("key-prompt-styles")) return;
    const style = document.createElement("style");
    style.id = "key-prompt-styles";
    style.textContent = `
      #key-prompt {
        position: fixed;
        z-index: 400;
        pointer-events: none;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #e0d0a0;
        background: rgba(20, 12, 28, 0.92);
        border: 1px solid #c8a84e;
        border-radius: 3px;
        padding: 4px 8px;
        text-shadow: 1px 1px 0 #000;
        white-space: nowrap;
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  setText(key: string, action: string): void {
    this.el.textContent = `[${key}] ${action}`;
  }

  show(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }

  destroy(): void {
    this.el.remove();
  }
}
