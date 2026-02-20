import { Application, Container, RenderTexture, Sprite, SCALE_MODES } from "pixi.js";
import { DISPLAY_SCALE, TILE_SIZE, Direction, DIR_DELTA, ITEM_REGISTRY, NPC_CHAT_BUBBLE_DURATION_MS, NPC_USER_DIALOG_DURATION_MS } from "@shireland/shared";
import type { TiledMap, PlayerData } from "@shireland/shared";
import { TilemapRenderer } from "./rendering/TilemapRenderer";
import { FootprintRenderer } from "./rendering/FootprintRenderer";
import { ItemRenderer } from "./rendering/ItemRenderer";
import { Camera } from "./rendering/Camera";
import { ChatBubble } from "./rendering/ChatBubble";
import { InputManager } from "./input/InputManager";
import { loadBindings, getCodesForAction, getPrimaryKeyLabel, Action } from "./input/KeyBindings";
import { LocalPlayer } from "./entities/LocalPlayer";
import { RemotePlayer } from "./entities/RemotePlayer";
import { NpcEntity } from "./entities/NpcEntity";
import { SocketManager } from "./network/SocketManager";
import { Interpolation } from "./network/Interpolation";
import { ChatBox } from "./ui/ChatBox";
import { HUD } from "./ui/HUD";
import { ClaimModal } from "./ui/ClaimModal";
import { InventoryPanel } from "./ui/InventoryPanel";
import { QuestLog } from "./ui/QuestLog";
import { NotificationToast } from "./ui/NotificationToast";
import { ActionPrompt } from "./ui/ActionPrompt";
import { ItemTooltip } from "./ui/ItemTooltip";
import { ContextMenu } from "./ui/ContextMenu";
import { SettingsPanel } from "./ui/SettingsPanel";
import { DebugOverlay } from "./rendering/DebugOverlay";

export class Game {
  readonly app: Application;
  readonly worldContainer: Container;
  readonly playerContainer: Container;

  private tilemapRenderer!: TilemapRenderer;
  private footprintRenderer!: FootprintRenderer;
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
  private questLog!: QuestLog;
  private notificationToast!: NotificationToast;
  private actionPrompt!: ActionPrompt;
  private itemTooltip!: ItemTooltip;
  private contextMenu!: ContextMenu;
  private settingsPanel!: SettingsPanel;
  private isGuest = false;
  private debugOverlay!: DebugOverlay;
  private remotePlayers = new Map<string, RemotePlayer>();
  private npcs = new Map<string, NpcEntity>();
  private npcTileKeys = new Set<string>();
  private chatBubbles = new Map<string, ChatBubble>();
  private suppressedNpcChat = new Set<string>();
  private uiOverlay!: Container;
  private renderTexture!: RenderTexture;
  private outputSprite!: Sprite;
  private moveSeq = 0;
  private joined = false;

  constructor(app: Application) {
    this.app = app;
    this.worldContainer = new Container();
    this.playerContainer = new Container();
  }

  async loadMap(mapUrl: string) {
    const response = await fetch(mapUrl);
    const mapData: TiledMap = await response.json();

    this.tilemapRenderer = await TilemapRenderer.create(mapData);

    // Item renderer (between tilemap and players)
    this.itemRenderer = new ItemRenderer();

    // Footprints (between items and players)
    this.footprintRenderer = new FootprintRenderer();

    // Layer order: ground tiles, items, footprints, entities (objects+players y-sorted), overlay
    this.worldContainer.addChild(this.tilemapRenderer.container);
    this.worldContainer.addChild(this.itemRenderer.container);
    this.worldContainer.addChild(this.footprintRenderer.container);
    this.worldContainer.addChild(this.playerContainer);

    // Add object sprites (buildings, trees, etc.) into the player container for y-sorting
    for (const sprite of this.tilemapRenderer.objectSprites) {
      this.playerContainer.addChild(sprite);
    }

    const overlay = this.tilemapRenderer.getOverlayLayer();
    this.worldContainer.addChild(overlay);

    // Debug overlay (toggle with P)
    this.debugOverlay = new DebugOverlay(
      this.tilemapRenderer.collisionData,
      this.tilemapRenderer.mapWidth,
      this.tilemapRenderer.mapHeight,
      mapData.routes ?? {}
    );
    this.worldContainer.addChild(this.debugOverlay.container);

    // Pixel-perfect rendering: render world at 1x into a RenderTexture,
    // then display it scaled up. This prevents tile seams from non-integer scaling.
    const viewW = Math.ceil(this.app.screen.width / DISPLAY_SCALE);
    const viewH = Math.ceil(this.app.screen.height / DISPLAY_SCALE);
    this.renderTexture = RenderTexture.create({
      width: viewW,
      height: viewH,
      scaleMode: SCALE_MODES.NEAREST,
      resolution: 1,
    });
    this.outputSprite = new Sprite(this.renderTexture);
    this.outputSprite.scale.set(DISPLAY_SCALE);
    this.app.stage.addChild(this.outputSprite);

    // Screen-space text overlay — renders at native resolution, on top of pixel art
    this.uiOverlay = new Container();
    this.app.stage.addChild(this.uiOverlay);

    this.camera = new Camera(
      this.worldContainer,
      viewW,
      viewH,
      this.tilemapRenderer.getPixelWidth(),
      this.tilemapRenderer.getPixelHeight()
    );

    window.addEventListener("resize", () => {
      this.resizeViewport();
    });

    loadBindings();
    this.inputManager = new InputManager();
    this.interpolation = new Interpolation(this.remotePlayers);

    // Set up networking
    this.socketManager = new SocketManager();
    this.setupNetworkHandlers();

    // Chat
    this.chatBox = new ChatBox(
      (text) => this.socketManager.sendChat(text),
      (focused) => { this.inputManager.chatFocused = focused; },
      getCodesForAction(Action.Chat)
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

    // Inventory, quest log & notifications
    this.inventoryPanel = new InventoryPanel();
    this.questLog = new QuestLog();
    this.notificationToast = new NotificationToast();
    this.actionPrompt = new ActionPrompt();
    this.itemTooltip = new ItemTooltip();
    this.contextMenu = new ContextMenu();

    // Settings panel (Escape key)
    this.settingsPanel = new SettingsPanel();
    this.settingsPanel.onBindingsChanged = () => {
      this.inputManager.rebuildLookups();
      this.chatBox.updateChatOpenCodes(getCodesForAction(Action.Chat));
    };
    this.settingsPanel.onToggle = (open) => {
      this.inputManager.paused = open;
    };

    // Item hover tooltip: track mouse over canvas → tile lookup
    const canvas = this.app.view as HTMLCanvasElement;
    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // CSS pixel → 1x viewport pixel → world pixel → tile
      const vpX = cssX / DISPLAY_SCALE;
      const vpY = cssY / DISPLAY_SCALE;
      const worldX = vpX - this.worldContainer.x;
      const worldY = vpY - this.worldContainer.y;
      const tileX = Math.floor(worldX / TILE_SIZE);
      const tileY = Math.floor(worldY / TILE_SIZE);

      const defId = this.itemRenderer.getItemDefIdAtTile(tileX, tileY);
      const def = defId ? ITEM_REGISTRY[defId] : null;
      if (def) {
        this.itemTooltip.show(def.friendlyName, e.clientX, e.clientY);
      } else {
        this.itemTooltip.hide();
      }
    });
    canvas.addEventListener("mouseleave", () => {
      this.itemTooltip.hide();
    });

    // Wire inventory equip/unequip actions
    this.inventoryPanel.onEquip = (slotIndex) => {
      this.socketManager.sendEquip(slotIndex);
    };
    this.inventoryPanel.onUnequip = (slot) => {
      this.socketManager.sendUnequip(slot);
    };

    // Right-click context menu on inventory slots
    this.inventoryPanel.onContextMenu = (slotIndex, event) => {
      this.contextMenu.show(event.clientX, event.clientY, [
        {
          label: "Drop",
          action: () => {
            this.socketManager.sendDrop(slotIndex);
          },
        },
      ]);
    };

    // Game loop
    let lastTime = performance.now();
    this.app.ticker.add(() => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      this.update(dt);

      // Render world at 1x into the off-screen texture
      this.app.renderer.render(this.worldContainer, {
        renderTexture: this.renderTexture,
        clear: true,
      });
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

  private resizeViewport() {
    const viewW = Math.ceil(this.app.screen.width / DISPLAY_SCALE);
    const viewH = Math.ceil(this.app.screen.height / DISPLAY_SCALE);
    this.renderTexture.resize(viewW, viewH);
    this.camera.resize(viewW, viewH);
  }

  private setupNetworkHandlers() {
    this.socketManager.onSnapshot = async (players: PlayerData[]) => {
      const myId = this.socketManager.id;
      const isReconnect = this.joined;

      // Clear stale remote players (handles reconnect after laptop lid close etc.)
      for (const [id, remote] of this.remotePlayers) {
        this.playerContainer.removeChild(remote.sprite);
        this.removeBubble(id);
      }
      this.remotePlayers.clear();

      // Remove old local player sprite if reconnecting
      if (isReconnect && this.localPlayer) {
        this.playerContainer.removeChild(this.localPlayer.sprite);
      }

      for (const p of players) {
        if (p.id === myId) {
          this.localPlayer = await LocalPlayer.create(
            p.x,
            p.y,
            p.playerClass,
            (x: number, y: number) =>
              this.tilemapRenderer.isPassable(x, y) && !this.npcTileKeys.has(`${x},${y}`)
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
      if (isReconnect) {
        this.chatBox.addSystemMessage("Reconnected!");
      } else {
        this.chatBox.addSystemMessage("Welcome to Shireland!");
      }
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
        const fromX = remote.getTileX();
        const fromY = remote.getTileY();
        remote.moveTo(data.x, data.y, data.direction as Direction);
        if (this.tilemapRenderer.isSandTile(fromX, fromY)) {
          this.footprintRenderer.spawn(fromX, fromY, data.direction as Direction);
        }
      }
    };

    this.socketManager.onChatMessage = (msg) => {
      this.chatBox.addMessage(msg);

      const playerId = msg.senderId;
      this.removeBubble(playerId);

      const bubble = new ChatBubble(msg.text);
      this.uiOverlay.addChild(bubble.container);
      this.chatBubbles.set(playerId, bubble);
    };

    this.socketManager.onItemsSnapshot = (items) => {
      this.itemRenderer.clear();
      for (const item of items) {
        this.itemRenderer.addItem(item);
      }
    };

    this.socketManager.onItemPickedUp = ({ itemId, playerId }) => {
      const defId = this.itemRenderer.getDefIdByInstanceId(itemId);
      this.itemRenderer.removeItem(itemId);
      if (playerId === this.socketManager.id) {
        const def = defId ? ITEM_REGISTRY[defId] : null;
        const name = def?.friendlyName ?? "item";
        const article = /^[aeiou]/i.test(name) ? "an" : "a";
        this.notificationToast.show(`Picked up ${article} ${name}!`);
      }
    };

    this.socketManager.onInventoryUpdate = (inventory) => {
      this.inventoryPanel.update(inventory);
    };

    this.socketManager.onItemsDropped = ({ items, fromX, fromY }) => {
      items.forEach((item, i) => {
        setTimeout(() => {
          this.itemRenderer.addItemAnimated(item, fromX, fromY);
        }, i * 50);
      });
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

    this.socketManager.onNpcSnapshot = async (npcs) => {
      for (const npcData of npcs) {
        if (this.npcs.has(npcData.id)) continue;
        const entity = await NpcEntity.create(npcData);
        this.npcs.set(npcData.id, entity);
        this.playerContainer.addChild(entity.sprite);
        this.npcTileKeys.add(`${npcData.x},${npcData.y}`);
      }
    };

    this.socketManager.onNpcMoved = (data) => {
      const npc = this.npcs.get(data.id);
      if (npc) {
        const fromX = npc.getTileX();
        const fromY = npc.getTileY();
        // Update NPC collision tiles
        this.npcTileKeys.delete(`${fromX},${fromY}`);
        this.npcTileKeys.add(`${data.x},${data.y}`);
        npc.moveTo(data.x, data.y, data.direction as Direction);
        if (data.debug) {
          npc.setDebug(data.debug);
          if (this.debugOverlay.isVisible()) {
            console.log(`[NPC:${npc.name}] ${data.debug}`);
          }
        }
        if (this.tilemapRenderer?.isSandTile(fromX, fromY)) {
          this.footprintRenderer?.spawn(fromX, fromY, data.direction as Direction);
        }
      }
    };

    this.socketManager.onNpcChat = ({ id, text, isResponse }) => {
      const npc = this.npcs.get(id);
      if (!npc) return;
      // isResponse = direct reply to this player's talk → always show (and clear suppression)
      // Otherwise it's ambient chat → respect suppression
      if (isResponse) {
        this.suppressedNpcChat.delete(id);
        this.removeBubble(id);
        const bubble = new ChatBubble(text, NPC_USER_DIALOG_DURATION_MS);
        this.uiOverlay.addChild(bubble.container);
        this.chatBubbles.set(id, bubble);
      } else {
        if (this.suppressedNpcChat.has(id)) return;
        this.removeBubble(id);
        const bubble = new ChatBubble(text, NPC_CHAT_BUBBLE_DURATION_MS);
        this.uiOverlay.addChild(bubble.container);
        this.chatBubbles.set(id, bubble);
      }
    };

    this.socketManager.onNpcDebug = (states) => {
      for (const info of states) {
        const npc = this.npcs.get(info.npcId);
        if (!npc) continue;
        let label = `[${info.dialogKey}]\nstate: ${info.state}`;
        if (info.questStatus) {
          label += `\nquest: ${info.questStatus}`;
        }
        npc.setDebug(label);
      }
    };

    this.socketManager.onQuestUpdate = (quests) => {
      this.questLog.update(quests);
      // Refresh NPC debug labels if debug overlay is active
      if (this.debugOverlay.isVisible()) {
        this.socketManager.sendNpcDebugRequest();
      }
    };

    this.socketManager.onQuestSnapshot = (quests) => {
      this.questLog.update(quests);
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

  private findFacingNpc(px: number, py: number, dir: Direction): NpcEntity | null {
    const delta = DIR_DELTA[dir];
    const tx = px + delta.dx;
    const ty = py + delta.dy;
    for (const npc of this.npcs.values()) {
      if (npc.hasDialog && npc.getTileX() === tx && npc.getTileY() === ty) return npc;
    }
    return null;
  }

  private update(dt: number) {
    // Animate tiles even before joining
    this.tilemapRenderer.updateAnimations(dt);
    this.footprintRenderer.update(dt);

    if (!this.joined || !this.localPlayer) return;

    // Update player first so a finishing move frees input on the same frame
    this.localPlayer.update(dt);

    // Input — poll immediately after update so held keys chain without a 1-frame gap
    if (!this.localPlayer.isMoving()) {
      const dir = this.inputManager.getDirection();
      if (dir !== null) {
        const fromX = this.localPlayer.tileX;
        const fromY = this.localPlayer.tileY;
        if (this.localPlayer.tryMove(dir)) {
          if (this.tilemapRenderer.isSandTile(fromX, fromY)) {
            this.footprintRenderer.spawn(fromX, fromY, dir);
          }
        }
      }
    }
    this.interpolation.update(dt);

    // Update NPCs
    for (const npc of this.npcs.values()) {
      npc.update(dt);
    }

    // Contextual action prompt
    const camX = this.worldContainer.x;
    const camY = this.worldContainer.y;

    if (this.localPlayer.isMoving() || this.inputManager.paused || this.inputManager.chatFocused) {
      this.actionPrompt.hide();
    } else {
      const px = this.localPlayer.tileX;
      const py = this.localPlayer.tileY;
      const dir = this.localPlayer.direction;

      const facingNpc = this.findFacingNpc(px, py, dir);
      const itemOnTile = this.itemRenderer.getItemDefIdAtTile(px, py);

      if (facingNpc) {
        const sprite = facingNpc.sprite;
        const screenX = (sprite.x + TILE_SIZE / 2 + camX) * DISPLAY_SCALE;
        const screenY = (sprite.y + camY) * DISPLAY_SCALE + 6;
        this.actionPrompt.show(getPrimaryKeyLabel(Action.Pickup), "Talk", screenX, screenY);
      } else if (itemOnTile) {
        const screenX = (px * TILE_SIZE + TILE_SIZE / 2 + camX) * DISPLAY_SCALE;
        const screenY = (py * TILE_SIZE + camY) * DISPLAY_SCALE + 6;
        this.actionPrompt.show(getPrimaryKeyLabel(Action.Pickup), "Pick up", screenX, screenY);
      } else {
        this.actionPrompt.hide();
      }
    }

    // Position screen-space chat bubbles

    for (const [id, bubble] of this.chatBubbles) {
      let sprite: Container | undefined;
      if (id === this.socketManager.id) {
        sprite = this.localPlayer?.sprite;
      } else {
        sprite = this.npcs.get(id)?.sprite ?? this.remotePlayers.get(id)?.sprite;
      }
      if (sprite) {
        bubble.container.x = (sprite.x + TILE_SIZE / 2 + camX) * DISPLAY_SCALE;
        bubble.container.y = (sprite.y + camY) * DISPLAY_SCALE - 42;
      }
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
    if (this.inputManager.isActionPressed(Action.Pickup)) {
      const facingNpcForAction = this.findFacingNpc(
        this.localPlayer.tileX,
        this.localPlayer.tileY,
        this.localPlayer.direction
      );
      if (facingNpcForAction) {
        // Suppress ambient chat while waiting for server response
        this.suppressedNpcChat.add(facingNpcForAction.id);
        setTimeout(() => {
          this.suppressedNpcChat.delete(facingNpcForAction.id);
        }, NPC_USER_DIALOG_DURATION_MS);

        this.socketManager.sendNpcTalk(facingNpcForAction.id);
      } else {
        // Check both logical tile and visual tile (mid-move the logical tile
        // has already advanced but the server still has the old position)
        const lx = this.localPlayer.tileX;
        const ly = this.localPlayer.tileY;
        const vx = Math.round(this.localPlayer.getVisualTileX());
        const vy = Math.round(this.localPlayer.getVisualTileY());
        const itemId = this.itemRenderer.getItemAtTile(lx, ly)
          ?? ((vx !== lx || vy !== ly) ? this.itemRenderer.getItemAtTile(vx, vy) : null);
        if (itemId) {
          this.socketManager.sendPickup(itemId);
        }
      }
    }

    if (this.inputManager.isActionPressed(Action.Inventory)) {
      this.inventoryPanel.toggle();
    }

    if (this.inputManager.isActionPressed(Action.QuestLog)) {
      this.questLog.toggle();
    }

    if (this.inputManager.isActionPressed(Action.Debug)) {
      this.debugOverlay.toggle();
      const debugOn = this.debugOverlay.isVisible();
      for (const npc of this.npcs.values()) {
        npc.setDebugVisible(debugOn);
      }
      if (debugOn) {
        this.socketManager.sendNpcDebugRequest();
      }
    }

    this.inputManager.clearActions();

    // Debug
    this.debugOverlay.updatePlayerPos(this.localPlayer.tileX, this.localPlayer.tileY);
    this.debugOverlay.updateStats(dt, this.remotePlayers.size + 1);

    // HUD
    this.hud.updateCoords(this.localPlayer.tileX, this.localPlayer.tileY);
    this.hud.updatePlayerCount(this.remotePlayers.size + 1);
  }

  getSocketManager(): SocketManager {
    return this.socketManager;
  }
}
