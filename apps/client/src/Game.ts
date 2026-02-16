import { Application, Container } from "pixi.js";
import { DISPLAY_SCALE, TILE_SIZE, Direction } from "@shireland/shared";
import type { TiledMap, PlayerData } from "@shireland/shared";
import { TilemapRenderer } from "./rendering/TilemapRenderer";
import { ItemRenderer } from "./rendering/ItemRenderer";
import { Camera } from "./rendering/Camera";
import { ChatBubble } from "./rendering/ChatBubble";
import { InputManager } from "./input/InputManager";
import { LocalPlayer } from "./entities/LocalPlayer";
import { RemotePlayer } from "./entities/RemotePlayer";
import { SocketManager } from "./network/SocketManager";
import { Interpolation } from "./network/Interpolation";
import { ChatBox } from "./ui/ChatBox";
import { HUD } from "./ui/HUD";
import { ClaimModal } from "./ui/ClaimModal";
import { InventoryPanel } from "./ui/InventoryPanel";
import { NotificationToast } from "./ui/NotificationToast";
import { DebugOverlay } from "./rendering/DebugOverlay";

export class Game {
  readonly app: Application;
  readonly worldContainer: Container;
  readonly playerContainer: Container;

  private tilemapRenderer!: TilemapRenderer;
  private itemRenderer!: ItemRenderer;
  private camera!: Camera;
  private inputManager!: InputManager;
  private localPlayer!: LocalPlayer;
  private socketManager!: SocketManager;
  private interpolation!: Interpolation;
  private chatBox!: ChatBox;
  private hud!: HUD;
  private claimModal!: ClaimModal;
  private inventoryPanel!: InventoryPanel;
  private notificationToast!: NotificationToast;
  private isGuest = false;
  private debugOverlay!: DebugOverlay;
  private remotePlayers = new Map<string, RemotePlayer>();
  private chatBubbles = new Map<string, ChatBubble>();

  private moveSeq = 0;
  private joined = false;

  constructor(app: Application) {
    this.app = app;
    this.worldContainer = new Container();
    this.playerContainer = new Container();
    this.playerContainer.scale.set(DISPLAY_SCALE);
    this.app.stage.addChild(this.worldContainer);
  }

  async loadMap(mapUrl: string) {
    const response = await fetch(mapUrl);
    const mapData: TiledMap = await response.json();

    this.tilemapRenderer = await TilemapRenderer.create(mapData);

    // Item renderer (between tilemap and players)
    this.itemRenderer = new ItemRenderer();
    this.itemRenderer.container.scale.set(DISPLAY_SCALE);

    // Layer order: ground tiles, items, entities (objects+players y-sorted), overlay
    this.worldContainer.addChild(this.tilemapRenderer.container);
    this.worldContainer.addChild(this.itemRenderer.container);
    this.worldContainer.addChild(this.playerContainer);

    // Add object sprites (buildings, trees, etc.) into the player container for y-sorting
    for (const sprite of this.tilemapRenderer.objectSprites) {
      this.playerContainer.addChild(sprite);
    }

    const overlay = this.tilemapRenderer.getOverlayLayer();
    this.worldContainer.addChild(overlay);

    // Debug overlay (toggle with Shift+D)
    this.debugOverlay = new DebugOverlay(
      this.tilemapRenderer.collisionData,
      this.tilemapRenderer.mapWidth,
      this.tilemapRenderer.mapHeight
    );
    this.worldContainer.addChild(this.debugOverlay.container);

    this.camera = new Camera(
      this.worldContainer,
      this.app.screen.width,
      this.app.screen.height,
      this.tilemapRenderer.getPixelWidth(),
      this.tilemapRenderer.getPixelHeight()
    );

    window.addEventListener("resize", () => {
      this.camera.resize(this.app.screen.width, this.app.screen.height);
    });

    this.inputManager = new InputManager();
    this.interpolation = new Interpolation(this.remotePlayers);

    // Set up networking
    this.socketManager = new SocketManager();
    this.setupNetworkHandlers();

    // Chat
    this.chatBox = new ChatBox(
      (text) => this.socketManager.sendChat(text),
      (focused) => { this.inputManager.chatFocused = focused; }
    );

    // HUD
    this.hud = new HUD();
    this.hud.onLogout = () => {
      this.socketManager.disconnect();
      window.location.reload();
    };

    // Claim modal (guest → registered)
    this.claimModal = new ClaimModal();
    this.claimModal.onClaimed = () => {
      this.isGuest = false;
      this.hud.setGuestMode(false);
      this.notificationToast.show("Account registered!");
    };
    this.hud.onRegister = () => {
      this.claimModal.show();
    };

    // Inventory & notifications
    this.inventoryPanel = new InventoryPanel();
    this.notificationToast = new NotificationToast();

    // Wire inventory equip/unequip actions
    this.inventoryPanel.onEquip = (slotIndex) => {
      this.socketManager.sendEquip(slotIndex);
    };
    this.inventoryPanel.onUnequip = (slot) => {
      this.socketManager.sendUnequip(slot);
    };

    // Game loop
    let lastTime = performance.now();
    this.app.ticker.add(() => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      this.update(dt);
    });

    console.log(`[Shireland] Map loaded: ${mapData.width}x${mapData.height} tiles`);
  }

  join(name: string, playerClass: string, characterId?: number) {
    this.socketManager.join(name, playerClass, characterId);
  }

  setIsGuest(isGuest: boolean) {
    this.isGuest = isGuest;
    this.hud.setGuestMode(isGuest);
  }

  private setupNetworkHandlers() {
    this.socketManager.onSnapshot = async (players: PlayerData[]) => {
      const myId = this.socketManager.id;

      for (const p of players) {
        if (p.id === myId) {
          this.localPlayer = await LocalPlayer.create(
            p.x,
            p.y,
            p.playerClass,
            (x: number, y: number) => this.tilemapRenderer.isPassable(x, y)
          );
          this.localPlayer.onMoveStart = (dir) => {
            this.socketManager.sendMove(dir, Date.now(), ++this.moveSeq);
          };
          this.playerContainer.addChild(this.localPlayer.sprite);
          this.camera.follow(p.x, p.y);

          // Apply initial equipment
          if (p.equipment) {
            this.localPlayer.applyEquipment(p.equipment);
            this.inventoryPanel.updateEquipment(p.equipment);
          }
        } else {
          await this.addRemotePlayer(p);
        }
      }
      this.joined = true;
      this.chatBox.addSystemMessage("Welcome to Shireland!");
    };

    this.socketManager.onPlayerJoined = async (player: PlayerData) => {
      if (player.id === this.socketManager.id) return;
      await this.addRemotePlayer(player);
      this.chatBox.addSystemMessage(`${player.name} has entered the realm.`);
    };

    this.socketManager.onPlayerLeft = (id: string) => {
      const remote = this.remotePlayers.get(id);
      if (remote) {
        this.chatBox.addSystemMessage(`${remote.name} has left the realm.`);
        this.playerContainer.removeChild(remote.sprite);
        this.remotePlayers.delete(id);
        this.removeBubble(id);
      }
    };

    this.socketManager.onPlayerMoved = (data) => {
      if (data.id === this.socketManager.id) {
        if (this.localPlayer) {
          if (this.localPlayer.tileX !== data.x || this.localPlayer.tileY !== data.y) {
            // Future: server reconciliation
          }
        }
        return;
      }

      const remote = this.remotePlayers.get(data.id);
      if (remote) {
        remote.moveTo(data.x, data.y, data.direction as Direction);
      }
    };

    this.socketManager.onChatMessage = (msg) => {
      this.chatBox.addMessage(msg);

      // Show bubble above the player
      const playerId = msg.senderId;
      this.removeBubble(playerId);

      const bubble = new ChatBubble(msg.text);

      // Attach to remote player or local player
      if (playerId === this.socketManager.id) {
        if (this.localPlayer) {
          this.localPlayer.sprite.addChild(bubble.container);
        }
      } else {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
          remote.sprite.addChild(bubble.container);
        }
      }

      this.chatBubbles.set(playerId, bubble);
    };

    this.socketManager.onItemsSnapshot = (items) => {
      for (const item of items) {
        this.itemRenderer.addItem(item);
      }
    };

    this.socketManager.onItemPickedUp = ({ itemId, playerId }) => {
      this.itemRenderer.removeItem(itemId);
      if (playerId === this.socketManager.id) {
        // We don't know the defId from just itemId here, so use a generic message
        // The inventory update will follow with the actual item details
        this.notificationToast.show("Picked up an item!");
      }
    };

    this.socketManager.onInventoryUpdate = (inventory) => {
      this.inventoryPanel.update(inventory);
    };

    this.socketManager.onEquipmentChanged = ({ id, equipment }) => {
      if (id === this.socketManager.id) {
        // Local player equipment changed
        if (this.localPlayer) {
          this.localPlayer.applyEquipment(equipment);
        }
        this.inventoryPanel.updateEquipment(equipment);
      } else {
        // Remote player equipment changed
        const remote = this.remotePlayers.get(id);
        if (remote) {
          remote.applyEquipment(equipment);
        }
      }
    };

    this.socketManager.onAuthError = (message) => {
      console.error("[Shireland] Auth error:", message);
      alert(message);
      window.location.reload();
    };
  }

  private removeBubble(playerId: string) {
    const existing = this.chatBubbles.get(playerId);
    if (existing) {
      existing.container.parent?.removeChild(existing.container);
      this.chatBubbles.delete(playerId);
    }
  }

  private async addRemotePlayer(data: PlayerData) {
    if (this.remotePlayers.has(data.id)) return;
    const remote = await RemotePlayer.create(data);
    this.remotePlayers.set(data.id, remote);
    this.playerContainer.addChild(remote.sprite);
  }

  private update(dt: number) {
    if (!this.joined || !this.localPlayer) return;

    // Update player first so a finishing move frees input on the same frame
    this.localPlayer.update(dt);

    // Input — poll immediately after update so held keys chain without a 1-frame gap
    if (!this.localPlayer.isMoving()) {
      const dir = this.inputManager.getDirection();
      if (dir !== null) {
        this.localPlayer.tryMove(dir);
      }
    }
    this.interpolation.update(dt);

    // Update chat bubbles
    for (const [id, bubble] of this.chatBubbles) {
      if (bubble.update(dt)) {
        bubble.container.parent?.removeChild(bubble.container);
        this.chatBubbles.delete(id);
      }
    }

    // Y-sort entities (players + objects) for proper depth ordering
    this.playerContainer.children.sort((a, b) => {
      const ay = (a as any).sortY ?? (a.y + TILE_SIZE);
      const by = (b as any).sortY ?? (b.y + TILE_SIZE);
      return ay - by;
    });

    // Camera
    this.camera.follow(
      this.localPlayer.getVisualTileX(),
      this.localPlayer.getVisualTileY()
    );

    // Action keys
    if (this.inputManager.isActionPressed("KeyE")) {
      const itemId = this.itemRenderer.getItemAtTile(
        this.localPlayer.tileX,
        this.localPlayer.tileY
      );
      if (itemId) {
        this.socketManager.sendPickup(itemId);
      }
    }

    if (this.inputManager.isActionPressed("KeyI")) {
      this.inventoryPanel.toggle();
    }

    if (this.inputManager.isActionPressed("KeyP")) {
      this.debugOverlay.toggle();
    }

    this.inputManager.clearActions();

    // Debug
    this.debugOverlay.updatePlayerPos(this.localPlayer.tileX, this.localPlayer.tileY);

    // HUD
    this.hud.updateCoords(this.localPlayer.tileX, this.localPlayer.tileY);
    this.hud.updatePlayerCount(this.remotePlayers.size + 1);
  }

  getSocketManager(): SocketManager {
    return this.socketManager;
  }
}
