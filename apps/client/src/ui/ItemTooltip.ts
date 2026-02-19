export class ItemTooltip {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "item-tooltip";
    this.addStyles();
    document.body.appendChild(this.el);
  }

  private addStyles() {
    if (document.getElementById("item-tooltip-styles")) return;
    const style = document.createElement("style");
    style.id = "item-tooltip-styles";
    style.textContent = `
      #item-tooltip {
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

  show(text: string, screenX: number, screenY: number): void {
    this.el.textContent = text;
    this.el.style.left = `${screenX + 12}px`;
    this.el.style.top = `${screenY + 12}px`;
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }
}
