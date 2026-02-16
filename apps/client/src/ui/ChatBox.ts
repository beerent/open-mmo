import type { ChatMessage } from "@shireland/shared";

export class ChatBox {
  private container: HTMLDivElement;
  private messages: HTMLDivElement;
  private input: HTMLInputElement;
  private onSend: (text: string) => void;
  private onFocusChange: (focused: boolean) => void;

  constructor(
    onSend: (text: string) => void,
    onFocusChange: (focused: boolean) => void
  ) {
    this.onSend = onSend;
    this.onFocusChange = onFocusChange;

    this.container = document.createElement("div");
    this.container.id = "chat-box";
    this.container.innerHTML = `
      <div class="chat-messages" id="chat-messages"></div>
      <input type="text" class="chat-input" id="chat-input" placeholder="Press Enter to chat..." maxlength="200" autocomplete="off" />
    `;

    this.addStyles();
    document.body.appendChild(this.container);

    this.messages = document.getElementById("chat-messages") as HTMLDivElement;
    this.input = document.getElementById("chat-input") as HTMLInputElement;

    this.bindEvents();
  }

  private addStyles() {
    if (document.getElementById("chat-styles")) return;
    const style = document.createElement("style");
    style.id = "chat-styles";
    style.textContent = `
      #chat-box {
        position: fixed;
        bottom: 12px;
        left: 12px;
        width: 320px;
        z-index: 100;
        font-family: 'Press Start 2P', monospace;
      }

      .chat-messages {
        max-height: 160px;
        overflow-y: auto;
        padding: 8px;
        background: rgba(0, 0, 0, 0.6);
        border: 2px solid #333;
        border-bottom: none;
        font-size: 7px;
        line-height: 1.6;
        scrollbar-width: thin;
        scrollbar-color: #555 transparent;
      }

      .chat-messages::-webkit-scrollbar {
        width: 4px;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: #555;
      }

      .chat-msg {
        margin-bottom: 4px;
        word-wrap: break-word;
      }

      .chat-msg .sender {
        color: #e6b422;
      }

      .chat-msg .text {
        color: #ddd;
      }

      .chat-msg.system {
        color: #888;
        font-style: italic;
      }

      .chat-input {
        width: 100%;
        padding: 8px;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #333;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        outline: none;
        box-sizing: border-box;
      }

      .chat-input:focus {
        border-color: #e6b422;
      }

      .chat-input::placeholder {
        color: #555;
      }
    `;
    document.head.appendChild(style);
  }

  private bindEvents() {
    // Enter to focus
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement !== this.input) {
        e.preventDefault();
        this.input.focus();
        this.onFocusChange(true);
      }
    });

    this.input.addEventListener("focus", () => {
      this.onFocusChange(true);
    });

    this.input.addEventListener("blur", () => {
      this.onFocusChange(false);
    });

    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();

      if (e.key === "Enter") {
        const text = this.input.value.trim();
        if (text) {
          this.onSend(text);
          this.input.value = "";
        }
        this.input.blur();
        this.onFocusChange(false);
      }

      if (e.key === "Escape") {
        this.input.value = "";
        this.input.blur();
        this.onFocusChange(false);
      }
    });
  }

  addMessage(msg: ChatMessage) {
    const div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = `<span class="sender">${this.escapeHtml(msg.senderName)}:</span> <span class="text">${this.escapeHtml(msg.text)}</span>`;
    this.messages.appendChild(div);
    this.messages.scrollTop = this.messages.scrollHeight;

    // Limit to 50 messages
    while (this.messages.children.length > 50) {
      this.messages.removeChild(this.messages.firstChild!);
    }
  }

  addSystemMessage(text: string) {
    const div = document.createElement("div");
    div.className = "chat-msg system";
    div.textContent = text;
    this.messages.appendChild(div);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
