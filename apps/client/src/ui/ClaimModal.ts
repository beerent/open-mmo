import { AuthClient } from "../network/AuthClient";

export class ClaimModal {
  private overlay: HTMLDivElement;
  onClaimed?: (username: string) => void;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.id = "claim-modal";
    this.overlay.style.display = "none";
    this.addStyles();
    document.body.appendChild(this.overlay);
  }

  show() {
    this.overlay.style.display = "flex";
    this.overlay.innerHTML = `
      <div class="claim-box">
        <h2 class="claim-title">Register Account</h2>
        <p class="claim-subtitle">Keep your character and progress</p>
        <div class="claim-field">
          <label for="claim-username">Username</label>
          <input type="text" id="claim-username" maxlength="32" placeholder="Choose a username..." autocomplete="off" />
        </div>
        <div class="claim-field">
          <label for="claim-password">Password</label>
          <input type="password" id="claim-password" maxlength="128" placeholder="Choose a password..." />
        </div>
        <div class="claim-error" id="claim-error"></div>
        <button class="claim-submit" id="claim-submit">Register</button>
        <button class="claim-close" id="claim-close">Cancel</button>
      </div>
    `;

    const usernameInput = this.overlay.querySelector("#claim-username") as HTMLInputElement;
    const passwordInput = this.overlay.querySelector("#claim-password") as HTMLInputElement;
    const errorDiv = this.overlay.querySelector("#claim-error") as HTMLDivElement;
    const submitBtn = this.overlay.querySelector("#claim-submit") as HTMLButtonElement;
    const closeBtn = this.overlay.querySelector("#claim-close") as HTMLButtonElement;

    closeBtn.addEventListener("click", () => this.hide());

    const doClaim = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      errorDiv.textContent = "";

      if (!username || username.length < 2) {
        errorDiv.textContent = "Username must be at least 2 characters";
        return;
      }
      if (!password || password.length < 4) {
        errorDiv.textContent = "Password must be at least 4 characters";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "...";

      const result = await AuthClient.claim(username, password);
      if (!result.ok) {
        errorDiv.textContent = result.error;
        submitBtn.disabled = false;
        submitBtn.textContent = "Register";
        return;
      }

      this.hide();
      this.onClaimed?.(result.user.username);
    };

    submitBtn.addEventListener("click", doClaim);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doClaim();
    });

    setTimeout(() => usernameInput.focus(), 100);
  }

  hide() {
    this.overlay.style.display = "none";
    this.overlay.innerHTML = "";
  }

  destroy() {
    this.overlay.remove();
  }

  private addStyles() {
    if (document.getElementById("claim-modal-styles")) return;
    const style = document.createElement("style");
    style.id = "claim-modal-styles";
    style.textContent = `
      #claim-modal {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        z-index: 2000;
        font-family: 'Press Start 2P', monospace;
      }

      .claim-box {
        background: #1a1a2e;
        border: 3px solid #e6b422;
        padding: 28px;
        text-align: center;
        max-width: 360px;
        width: 90%;
        image-rendering: pixelated;
      }

      .claim-title {
        color: #e6b422;
        font-size: 14px;
        margin: 0 0 8px 0;
        text-shadow: 2px 2px 0 #000;
      }

      .claim-subtitle {
        color: #888;
        font-size: 7px;
        margin: 0 0 20px 0;
      }

      .claim-field {
        margin-bottom: 16px;
        text-align: left;
      }

      .claim-field label {
        color: #ccc;
        font-size: 9px;
        display: block;
        margin-bottom: 6px;
      }

      .claim-field input {
        width: 100%;
        padding: 10px;
        background: #0d0d1a;
        border: 2px solid #333;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        outline: none;
        box-sizing: border-box;
      }

      .claim-field input:focus {
        border-color: #e6b422;
      }

      .claim-error {
        color: #ff4444;
        font-size: 7px;
        min-height: 14px;
        margin-bottom: 8px;
      }

      .claim-submit {
        width: 100%;
        padding: 12px;
        background: #e6b422;
        border: none;
        color: #1a1a2e;
        font-family: 'Press Start 2P', monospace;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .claim-submit:hover {
        background: #ffc832;
      }

      .claim-submit:disabled {
        background: #666;
        cursor: not-allowed;
      }

      .claim-close {
        display: block;
        width: 100%;
        padding: 8px;
        background: transparent;
        border: 1px solid #444;
        color: #888;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        cursor: pointer;
        margin-top: 10px;
      }

      .claim-close:hover {
        border-color: #888;
        color: #ccc;
      }
    `;
    document.head.appendChild(style);
  }
}
