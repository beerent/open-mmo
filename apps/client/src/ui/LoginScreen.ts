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

      @keyframes rpg-panel-open {
        from { transform: scale(0.95); opacity: 0.7; }
        to { transform: scale(1); opacity: 1; }
      }

      #login-screen {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 6, 4, 0.92);
        z-index: 1000;
        font-family: 'Press Start 2P', monospace;
      }

      .login-box {
        border: 3px solid #4a3520;
        outline: 2px solid #0a0604;
        box-shadow:
          inset 1px 1px 0 0 #8a7040,
          inset -1px -1px 0 0 #201008,
          inset 0 0 10px rgba(0,0,0,0.4),
          0 0 0 3px rgba(10,6,4,0.5),
          0 6px 24px rgba(0,0,0,0.7);
        background:
          repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          linear-gradient(170deg, #3a2a1a 0%, #2e1e10 40%, #241608 100%);
        padding: 32px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        image-rendering: pixelated;
        position: relative;
        animation: rpg-panel-open 0.2s ease-out;
      }
      .login-box::before {
        content: '';
        position: absolute;
        inset: -5px;
        pointer-events: none;
        z-index: 10;
        background:
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 0 0 / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 100% 0 / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 0 100% / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 100% 100% / 8px 8px;
      }

      .login-title {
        color: #c8a84e;
        font-size: 24px;
        margin: 0 0 8px 0;
        text-shadow: 2px 2px 0 #000, 0 0 16px rgba(200,168,78,0.4);
        letter-spacing: 3px;
      }

      .login-subtitle {
        color: #8a7040;
        font-size: 8px;
        margin: 0 0 24px 0;
        text-shadow: 1px 1px 0 #000;
      }

      .auth-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
      }

      .tab-btn {
        flex: 1;
        padding: 10px;
        background: #0d0906;
        border: 2px solid #3a2818;
        color: #886644;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        cursor: pointer;
        box-shadow: inset 1px 1px 0 0 #060302, inset -1px -1px 0 0 #4a3828;
        transition: border-color 0.15s, color 0.15s;
      }

      .tab-btn.active {
        border-color: #c8a84e;
        color: #c8a84e;
        background: #1a1008;
        box-shadow: inset 1px 1px 0 0 #2a1a08, inset -1px -1px 0 0 #5a4830;
      }

      .login-field {
        margin-bottom: 20px;
        text-align: left;
      }

      .login-field label {
        color: #8a7040;
        font-size: 8px;
        display: block;
        margin-bottom: 8px;
        text-shadow: 1px 1px 0 #000;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .login-field input {
        width: 100%;
        padding: 10px;
        background: #0d0906;
        border: 2px solid #3a2818;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5);
        color: #e0d0a0;
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .login-field input:focus {
        border-color: #c8a84e;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5),
          0 0 0 1px #c8a84e,
          0 0 6px rgba(200,168,78,0.2);
      }

      .login-field input::placeholder {
        color: #4a3828;
      }

      .auth-error {
        color: #ff4444;
        font-size: 8px;
        min-height: 16px;
        margin-bottom: 8px;
        text-shadow: 1px 1px 0 #000;
      }

      .class-select {
        display: flex;
        gap: 12px;
      }

      .class-btn {
        flex: 1;
        padding: 12px 8px;
        background: #0d0906;
        border: 2px solid #3a2818;
        color: #886644;
        cursor: pointer;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828;
        transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
      }

      .class-btn:hover {
        border-color: #6b5430;
        color: #c8a84e;
      }

      .class-btn.selected {
        border-color: #c8a84e;
        color: #c8a84e;
        background: #1a1008;
        box-shadow:
          inset 1px 1px 0 0 #2a1a08,
          inset -1px -1px 0 0 #5a4830,
          0 0 0 1px #c8a84e,
          0 0 8px rgba(200,168,78,0.15);
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
        border: 2px solid #a08030;
        outline: 1px solid #0a0604;
        box-shadow:
          inset 1px 1px 0 0 #ffe070,
          inset -1px -1px 0 0 #705010,
          0 0 12px rgba(230,180,34,0.2);
        background: linear-gradient(to bottom, #e6c860 0%, #c8a020 50%, #a08018 100%);
        color: #1a0e04;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        cursor: pointer;
        text-shadow: 0 1px 0 rgba(255,255,255,0.2);
        letter-spacing: 2px;
        transition: box-shadow 0.15s, background 0.15s;
      }

      .play-now-btn:hover {
        background: linear-gradient(to bottom, #f0d870 0%, #d8b030 50%, #b09020 100%);
        box-shadow:
          inset 1px 1px 0 0 #ffe890,
          inset -1px -1px 0 0 #806018,
          0 0 16px rgba(230,180,34,0.35);
      }

      .play-now-btn:active {
        background: linear-gradient(to bottom, #a08018 0%, #c8a020 50%, #e6c860 100%);
        box-shadow:
          inset 1px 1px 0 0 #705010,
          inset -1px -1px 0 0 #ffe070;
      }

      .play-now-btn:disabled {
        background: #3a2818;
        border-color: #3a2818;
        color: #886644;
        box-shadow: none;
        outline-color: transparent;
        cursor: not-allowed;
      }

      .join-btn {
        width: 100%;
        padding: 14px;
        border: 2px solid #5a4428;
        box-shadow:
          inset 1px 1px 0 0 #8a7040,
          inset -1px -1px 0 0 #201008;
        background: linear-gradient(to bottom, #5a4428 0%, #4a3518 100%);
        color: #c8a84e;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
        text-shadow: 1px 1px 0 #000;
        transition: box-shadow 0.15s, background 0.15s;
      }

      .join-btn:hover {
        background: linear-gradient(to bottom, #6a5438 0%, #5a4528 100%);
        box-shadow:
          inset 1px 1px 0 0 #9a8050,
          inset -1px -1px 0 0 #301808,
          0 0 8px rgba(200,168,78,0.15);
      }

      .join-btn:active {
        background: linear-gradient(to bottom, #3a2510 0%, #4a3518 100%);
        box-shadow:
          inset 1px 1px 0 0 #201008,
          inset -1px -1px 0 0 #8a7040;
      }

      .join-btn:disabled {
        background: #3a2818;
        border-color: #3a2818;
        color: #886644;
        box-shadow: none;
        cursor: not-allowed;
      }

      .twitch-divider {
        margin: 20px 0;
        color: #6b5430;
        font-size: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        text-shadow: 1px 1px 0 #000;
      }

      .twitch-divider::before {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(to right, transparent, #6b5430);
      }
      .twitch-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(to left, transparent, #6b5430);
      }

      .twitch-btn {
        display: block;
        width: 100%;
        padding: 12px;
        background: linear-gradient(to bottom, #9e56ff, #7b38db);
        border: 2px solid #6a2cb8;
        box-shadow:
          inset 1px 1px 0 0 #b876ff,
          inset -1px -1px 0 0 #5020a0;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
        box-sizing: border-box;
        text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
        transition: box-shadow 0.15s, background 0.15s;
      }

      .twitch-btn:hover {
        background: linear-gradient(to bottom, #b070ff, #8e48eb);
        box-shadow:
          inset 1px 1px 0 0 #c888ff,
          inset -1px -1px 0 0 #6030b0,
          0 0 8px rgba(158,86,255,0.2);
      }

      .character-info {
        margin: 20px 0;
        padding: 16px;
        background: #0d0906;
        border: 2px solid #3a2818;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5);
      }

      .char-name {
        display: block;
        color: #c8a84e;
        font-size: 14px;
        margin-bottom: 8px;
        text-shadow: 1px 1px 0 #000, 0 0 8px rgba(200,168,78,0.3);
      }

      .char-class {
        display: block;
        color: #8a7040;
        font-size: 10px;
        text-transform: capitalize;
        text-shadow: 1px 1px 0 #000;
      }

      .logout-btn {
        display: block;
        width: 100%;
        padding: 10px;
        background: transparent;
        border: 1px solid #3a2818;
        color: #886644;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        cursor: pointer;
        margin-top: 12px;
        text-shadow: 1px 1px 0 #000;
        transition: border-color 0.15s, color 0.15s;
      }

      .logout-btn:hover {
        border-color: #6b5430;
        color: #c8a84e;
      }
    `;
    document.head.appendChild(style);
  }
}
