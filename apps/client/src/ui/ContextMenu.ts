export interface ContextMenuItem {
  label: string;
  action: () => void;
}

export class ContextMenu {
  private container: HTMLDivElement;
  private dismissHandler: (e: MouseEvent) => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "context-menu";
    this.addStyles();
    document.body.appendChild(this.container);

    this.dismissHandler = (e: MouseEvent) => {
      if (!this.container.contains(e.target as Node)) {
        this.hide();
      }
    };
  }

  private addStyles() {
    if (document.getElementById("context-menu-styles")) return;
    const style = document.createElement("style");
    style.id = "context-menu-styles";
    style.textContent = `
      #context-menu {
        position: fixed;
        z-index: 500;
        background: linear-gradient(to bottom, #3a2a1a, #2a1c10);
        border: 2px solid #6b5430;
        border-top-color: #8a7040;
        border-left-color: #8a7040;
        border-radius: 2px;
        font-family: 'Press Start 2P', monospace;
        box-shadow: inset 0 0 0 1px #1a0e04, 0 4px 12px rgba(0,0,0,0.6);
        display: none;
        min-width: 120px;
        padding: 4px 0;
        user-select: none;
      }
      #context-menu.open {
        display: block;
      }
      .ctx-item {
        padding: 8px 14px;
        font-size: 10px;
        color: #e0d0a0;
        cursor: pointer;
        text-shadow: 1px 1px 0 #000;
        white-space: nowrap;
      }
      .ctx-item:hover {
        background: rgba(200, 168, 78, 0.2);
        color: #c8a84e;
      }
    `;
    document.head.appendChild(style);
  }

  show(x: number, y: number, items: ContextMenuItem[]): void {
    this.container.innerHTML = "";
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "ctx-item";
      el.textContent = item.label;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        item.action();
        this.hide();
      });
      this.container.appendChild(el);
    }

    // Position, clamping to viewport
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.classList.add("open");

    // Clamp after rendering so we know the size
    requestAnimationFrame(() => {
      const rect = this.container.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.container.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.container.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    });

    // Dismiss on outside click (delayed so the opening click doesn't dismiss)
    setTimeout(() => {
      document.addEventListener("click", this.dismissHandler);
    }, 0);
  }

  hide(): void {
    this.container.classList.remove("open");
    document.removeEventListener("click", this.dismissHandler);
  }
}
