import { NOTIFICATION_DURATION_MS } from "@shireland/shared";

export class NotificationToast {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "notification-container";
    this.addStyles();
    document.body.appendChild(this.container);
  }

  private addStyles() {
    if (document.getElementById("notification-styles")) return;
    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
      #notification-container {
        position: fixed;
        top: 40px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 300;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .notification-toast {
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #e0d0a0;
        background: rgba(20, 12, 28, 0.9);
        border: 1px solid #c8a84e;
        border-radius: 3px;
        padding: 6px 12px;
        text-shadow: 1px 1px 0 #000;
        animation: toast-in-out ${NOTIFICATION_DURATION_MS}ms ease forwards;
      }
      @keyframes toast-in-out {
        0% { opacity: 0; transform: translateY(8px); }
        10% { opacity: 1; transform: translateY(0); }
        75% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-8px); }
      }
    `;
    document.head.appendChild(style);
  }

  show(text: string): void {
    const el = document.createElement("div");
    el.className = "notification-toast";
    el.textContent = text;
    this.container.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, NOTIFICATION_DURATION_MS);
  }
}
