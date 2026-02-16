import { Application, BaseTexture, settings, SCALE_MODES } from "pixi.js";
import { Game } from "./Game";
import { LoginScreen } from "./ui/LoginScreen";
import { AuthClient } from "./network/AuthClient";

// Global pixel-art settings
settings.ROUND_PIXELS = true;
BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

const app = new Application({
  resizeTo: window,
  backgroundColor: 0x1a1a2e,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: false,
});

document.body.appendChild(app.view as HTMLCanvasElement);

const game = new Game(app);

game.loadMap("/assets/maps/town.json").then(async () => {
  // Check if already logged in
  const user = await AuthClient.me();

  new LoginScreen(
    (name, playerClass, characterId) => {
      game.join(name, playerClass, characterId);
    },
    user,
    (authedUser) => {
      game.setIsGuest(!!authedUser.isGuest);
    }
  );

  console.log("[Shireland] Ready");
});
