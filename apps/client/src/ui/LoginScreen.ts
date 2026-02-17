import { AuthClient, type AuthUser } from "../network/AuthClient";

export class LoginScreen {
  private overlay: HTMLDivElement;
  private onJoin: (name: string, playerClass: string, characterId?: number) => void;
  private onUserReady?: (user: AuthUser) => void;

  constructor(
    onJoin: (name: string, playerClass: string, characterId?: number) => void,
    existingUser?: AuthUser | null,
    onUserReady?: (user: AuthUser) => void
  ) {
    this.onJoin = onJoin;
    this.onUserReady = onUserReady;

    this.overlay = document.createElement("div");
    this.overlay.id = "login-screen";
    this.addStyles();
    document.body.appendChild(this.overlay);

    if (existingUser) {
      this.showCharacterSelect(existingUser);
    } else {
      this.showAuth();
    }
  }

  private showAuth() {
    this.overlay.innerHTML = `
      <div class="login-box">
        <h1 class="login-title">SHIRELAND</h1>
        <p class="login-subtitle">A Retro JRPG MMO</p>
        <button class="play-now-btn" id="play-now-btn">PLAY AS GUEST</button>
        <div class="twitch-divider">
          <span>or sign in to keep your progress</span>
        </div>
        <div class="auth-tabs">
          <button class="tab-btn active" data-tab="login">Login</button>
          <button class="tab-btn" data-tab="register">Register</button>
        </div>
        <div class="auth-form" id="auth-form">
          <div class="login-field">
            <label for="auth-username">Username</label>
            <input type="text" id="auth-username" maxlength="32" placeholder="Enter username..." autocomplete="off" />
          </div>
          <div class="login-field">
            <label for="auth-password">Password</label>
            <input type="password" id="auth-password" maxlength="128" placeholder="Enter password..." />
          </div>
          <div class="auth-error" id="auth-error"></div>
          <button class="join-btn" id="auth-submit">Login</button>
        </div>
        <div class="twitch-divider">
          <span>or</span>
        </div>
        <a class="twitch-btn" href="/api/auth/twitch">Login with Twitch</a>
      </div>
    `;

    // Play Now (guest) button
    const playNowBtn = this.overlay.querySelector("#play-now-btn") as HTMLButtonElement;
    playNowBtn.addEventListener("click", async () => {
      playNowBtn.disabled = true;
      playNowBtn.textContent = "...";

      const result = await AuthClient.guest();
      if (!result.ok) {
        playNowBtn.disabled = false;
        playNowBtn.textContent = "PLAY AS GUEST";
        return;
      }

      const user = await AuthClient.me();
      if (user) {
        this.showCharacterSelect(user);
      }
    });

    let mode: "login" | "register" = "login";
    const tabs = this.overlay.querySelectorAll(".tab-btn");
    const submitBtn = this.overlay.querySelector("#auth-submit") as HTMLButtonElement;
    const errorDiv = this.overlay.querySelector("#auth-error") as HTMLDivElement;
    const usernameInput = this.overlay.querySelector("#auth-username") as HTMLInputElement;
    const passwordInput = this.overlay.querySelector("#auth-password") as HTMLInputElement;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        mode = (tab as HTMLElement).dataset.tab as "login" | "register";
        submitBtn.textContent = mode === "login" ? "Login" : "Register";
        errorDiv.textContent = "";
      });
    });

    const doAuth = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      errorDiv.textContent = "";

      if (!username || !password) {
        errorDiv.textContent = "Username and password required";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "...";

      const result =
        mode === "login"
          ? await AuthClient.login(username, password)
          : await AuthClient.register(username, password);

      if (!result.ok) {
        errorDiv.textContent = result.error;
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "Login" : "Register";
        return;
      }

      // Fetch full user (with character info)
      const user = await AuthClient.me();
      if (user) {
        this.showCharacterSelect(user);
      }
    };

    submitBtn.addEventListener("click", doAuth);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAuth();
    });

    setTimeout(() => usernameInput.focus(), 100);
  }

  private showCharacterSelect(user: AuthUser) {
    this.onUserReady?.(user);
    const isGuest = !!user.isGuest;
    const displayName = isGuest ? "Adventurer" : this.escapeHtml(user.username);
    const logoutLabel = isGuest ? "Back" : "Logout";

    if (user.character) {
      // Has existing character — show enter button
      const subtitle = isGuest
        ? "Welcome back!"
        : `Welcome back, ${displayName}`;
      this.overlay.innerHTML = `
        <div class="login-box">
          <h1 class="login-title">SHIRELAND</h1>
          <p class="login-subtitle">${subtitle}</p>
          <div class="character-info">
            <span class="char-name">${this.escapeHtml(user.character.name)}</span>
            <span class="char-class">${user.character.playerClass}</span>
          </div>
          <button class="join-btn" id="enter-btn">Enter Shireland</button>
          <button class="logout-btn" id="logout-btn">${logoutLabel}</button>
        </div>
      `;

      const enterBtn = this.overlay.querySelector("#enter-btn") as HTMLButtonElement;
      enterBtn.addEventListener("click", () => {
        this.overlay.remove();
        this.onJoin(
          user.character!.name,
          user.character!.playerClass,
          user.character!.id
        );
      });

      this.overlay.querySelector("#logout-btn")!.addEventListener("click", async () => {
        await AuthClient.logout();
        this.showAuth();
      });
    } else {
      // No character — show create screen
      const subtitle = isGuest
        ? "Create your character"
        : `Create your character, ${displayName}`;
      this.overlay.innerHTML = `
        <div class="login-box">
          <h1 class="login-title">SHIRELAND</h1>
          <p class="login-subtitle">${subtitle}</p>
          <div class="login-field">
            <label for="player-name">Name</label>
            <input type="text" id="player-name" maxlength="16" placeholder="Enter thy name..." autocomplete="off" />
          </div>
          <div class="login-field">
            <label>Class</label>
            <div class="class-select">
              <button class="class-btn selected" data-class="warrior">
                <span class="class-icon">&#9876;</span>
                <span class="class-name">Warrior</span>
              </button>
              <button class="class-btn" data-class="wizard">
                <span class="class-icon">&#9733;</span>
                <span class="class-name">Wizard</span>
              </button>
            </div>
          </div>
          <button class="join-btn" id="join-btn">Enter Shireland</button>
          <button class="logout-btn" id="logout-btn">${logoutLabel}</button>
        </div>
      `;

      const nameInput = this.overlay.querySelector("#player-name") as HTMLInputElement;
      const joinBtn = this.overlay.querySelector("#join-btn") as HTMLButtonElement;
      const classButtons = this.overlay.querySelectorAll(".class-btn");
      let selectedClass = "warrior";

      classButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          classButtons.forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          selectedClass = (btn as HTMLElement).dataset.class!;
        });
      });

      const doJoin = () => {
        const name = nameInput.value.trim() || "Adventurer";
        this.overlay.remove();
        this.onJoin(name, selectedClass);
      };

      joinBtn.addEventListener("click", doJoin);
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doJoin();
      });

      this.overlay.querySelector("#logout-btn")!.addEventListener("click", async () => {
        await AuthClient.logout();
        this.showAuth();
      });

      setTimeout(() => nameInput.focus(), 100);
    }
  }

  private escapeHtml(text: string): string {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  }

  private addStyles() {
    if (document.getElementById("login-styles")) return;
    const style = document.createElement("style");
    style.id = "login-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      #login-screen {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.85);
        z-index: 1000;
        font-family: 'Press Start 2P', monospace;
      }

      .login-box {
        background: #1a1a2e;
        border: 3px solid #e6b422;
        padding: 32px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        image-rendering: pixelated;
      }

      .login-title {
        color: #e6b422;
        font-size: 24px;
        margin: 0 0 8px 0;
        text-shadow: 2px 2px 0 #000;
      }

      .login-subtitle {
        color: #888;
        font-size: 8px;
        margin: 0 0 24px 0;
      }

      .auth-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
      }

      .tab-btn {
        flex: 1;
        padding: 10px;
        background: #0d0d1a;
        border: 2px solid #333;
        color: #888;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        cursor: pointer;
      }

      .tab-btn.active {
        border-color: #e6b422;
        color: #e6b422;
        background: #1a1a0d;
      }

      .login-field {
        margin-bottom: 20px;
        text-align: left;
      }

      .login-field label {
        color: #ccc;
        font-size: 10px;
        display: block;
        margin-bottom: 8px;
      }

      .login-field input {
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

      .login-field input:focus {
        border-color: #e6b422;
      }

      .auth-error {
        color: #ff4444;
        font-size: 8px;
        min-height: 16px;
        margin-bottom: 8px;
      }

      .class-select {
        display: flex;
        gap: 12px;
      }

      .class-btn {
        flex: 1;
        padding: 12px 8px;
        background: #0d0d1a;
        border: 2px solid #333;
        color: #aaa;
        cursor: pointer;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        transition: border-color 0.2s;
      }

      .class-btn:hover {
        border-color: #666;
      }

      .class-btn.selected {
        border-color: #e6b422;
        color: #e6b422;
        background: #1a1a0d;
      }

      .class-icon {
        display: block;
        font-size: 24px;
        margin-bottom: 8px;
      }

      .class-name {
        display: block;
      }

      .play-now-btn {
        width: 100%;
        padding: 18px;
        background: linear-gradient(180deg, #ffd700 0%, #e6b422 50%, #c69a1a 100%);
        border: 3px solid #ffd700;
        color: #1a1a2e;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        cursor: pointer;
        text-shadow: 1px 1px 0 rgba(255,255,255,0.3);
        transition: all 0.2s;
        letter-spacing: 2px;
      }

      .play-now-btn:hover {
        background: linear-gradient(180deg, #ffe44d 0%, #ffc832 50%, #e6b422 100%);
        border-color: #ffe44d;
      }

      .play-now-btn:active {
        background: linear-gradient(180deg, #c69a1a 0%, #a67d15 50%, #8a6910 100%);
        border-color: #c69a1a;
      }

      .play-now-btn:disabled {
        background: #666;
        border-color: #666;
        cursor: not-allowed;
      }

      .join-btn {
        width: 100%;
        padding: 14px;
        background: #e6b422;
        border: none;
        color: #1a1a2e;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
        transition: background 0.2s;
      }

      .join-btn:hover {
        background: #ffc832;
      }

      .join-btn:active {
        background: #c69a1a;
      }

      .join-btn:disabled {
        background: #666;
        cursor: not-allowed;
      }

      .twitch-divider {
        margin: 16px 0;
        color: #555;
        font-size: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .twitch-divider::before,
      .twitch-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #333;
      }

      .twitch-btn {
        display: block;
        width: 100%;
        padding: 12px;
        background: #9146FF;
        border: none;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
        box-sizing: border-box;
        transition: background 0.2s;
      }

      .twitch-btn:hover {
        background: #a970ff;
      }

      .character-info {
        margin: 20px 0;
        padding: 16px;
        background: #0d0d1a;
        border: 2px solid #333;
      }

      .char-name {
        display: block;
        color: #e6b422;
        font-size: 14px;
        margin-bottom: 8px;
      }

      .char-class {
        display: block;
        color: #888;
        font-size: 10px;
        text-transform: capitalize;
      }

      .logout-btn {
        display: block;
        width: 100%;
        padding: 10px;
        background: transparent;
        border: 1px solid #444;
        color: #888;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        cursor: pointer;
        margin-top: 12px;
      }

      .logout-btn:hover {
        border-color: #888;
        color: #ccc;
      }
    `;
    document.head.appendChild(style);
  }
}
