import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shireland/shared";
import { PlayerClass, Direction } from "@shireland/shared";
import { CharacterDao, ItemInstanceDao } from "@shireland/database";
import { GameState } from "../state/GameState.js";
import { PlayerState } from "../state/PlayerState.js";
import { CollisionMap } from "../map/CollisionMap.js";
import { ItemState } from "../state/ItemState.js";
import type { SocketData } from "../middleware/socketAuth.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const GRACE_PERIOD_MS = 60_000; // 60s reconnection grace

interface DisconnectedPlayer {
  player: PlayerState;
  timeout: ReturnType<typeof setTimeout>;
}

export class ConnectionHandler {
  private disconnectedGrace = new Map<number, DisconnectedPlayer>();

  constructor(
    private io: TypedServer,
    private gameState: GameState,
    private collisionMap: CollisionMap,
    private itemState: ItemState
  ) {}

  handle(socket: TypedSocket) {
    socket.on("player:join", async ({ name, playerClass }) => {
      try {
        const data = socket.data as SocketData;
        const accountId = data.accountId;

        if (!accountId) {
          socket.emit("auth:error", { message: "Not authenticated" });
          return;
        }

        // Duplicate login: kick old socket
        const existingSocketId = this.gameState.isAccountOnline(accountId);
        if (existingSocketId) {
          const existingSocket = this.io.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            existingSocket.emit("auth:error", { message: "Logged in from another location" });
            existingSocket.disconnect(true);
          }
        }

        // Check reconnection grace period
        const grace = this.disconnectedGrace.get(accountId);
        if (grace) {
          clearTimeout(grace.timeout);
          this.disconnectedGrace.delete(accountId);

          // Restore player with new socket ID
          const restored = grace.player;
          const player = new PlayerState(
            socket.id,
            restored.accountId,
            restored.characterId,
            restored.name,
            restored.playerClass,
            restored.x,
            restored.y,
            restored.direction
          );
          player.equipment = restored.equipment;

          this.gameState.addPlayer(player);

          // Items are still in memory — no DB round-trip needed
          socket.emit("state:snapshot", { players: this.gameState.getSnapshot() });
          socket.emit("items:snapshot", { items: this.itemState.getWorldItems() });
          socket.emit("inventory:update", { inventory: this.itemState.getInventory(player.characterId) });
          socket.broadcast.emit("player:joined", player.toData());

          console.log(
            `[Shireland] ${player.name} reconnected (grace) — ${this.gameState.getPlayerCount()} online`
          );
          return;
        }

        // Validate class
        const validClass = Object.values(PlayerClass).includes(playerClass as PlayerClass)
          ? (playerClass as PlayerClass)
          : PlayerClass.Warrior;

        // Load or create character
        let character = data.character;

        if (!character) {
          const cleanName = name.trim().slice(0, 16) || "Adventurer";
          const spawn = this.collisionMap.findSpawn();
          character = await CharacterDao.create(
            accountId,
            cleanName,
            validClass,
            spawn.x,
            spawn.y
          );
        }

        const player = new PlayerState(
          socket.id,
          accountId,
          character.id,
          character.name,
          character.player_class as PlayerClass,
          character.x,
          character.y,
          character.direction as Direction
        );

        this.gameState.addPlayer(player);

        // Load character items from DB
        const itemRows = await ItemInstanceDao.findByOwner(character.id);
        this.itemState.loadCharacterItems(character.id, itemRows);

        player.equipment = this.itemState.getEquipment(character.id);

        socket.emit("state:snapshot", { players: this.gameState.getSnapshot() });
        socket.emit("items:snapshot", { items: this.itemState.getWorldItems() });
        socket.emit("inventory:update", { inventory: this.itemState.getInventory(character.id) });
        socket.broadcast.emit("player:joined", player.toData());

        console.log(
          `[Shireland] ${character.name} (${character.player_class}) joined at (${character.x}, ${character.y}) — ${this.gameState.getPlayerCount()} online`
        );
      } catch (err) {
        console.error("[Shireland] Join error:", err);
        socket.emit("auth:error", { message: "Failed to join" });
      }
    });

    socket.on("disconnect", () => {
      const player = this.gameState.removePlayer(socket.id);
      if (!player) return;

      this.io.emit("player:left", { id: socket.id });

      // Start grace period — keep items in memory, defer DB save
      const timeout = setTimeout(async () => {
        this.disconnectedGrace.delete(player.accountId);

        try {
          await CharacterDao.updatePosition(
            player.characterId,
            player.x,
            player.y,
            player.direction
          );
          const items = this.itemState.getPlayerItems(player.characterId);
          await ItemInstanceDao.saveAllForCharacter(player.characterId, items);
        } catch (err) {
          console.error(`[Shireland] Failed to save ${player.name}:`, err);
        }

        this.itemState.unloadCharacter(player.characterId);
        console.log(`[Shireland] ${player.name} grace expired — saved and unloaded`);
      }, GRACE_PERIOD_MS);

      this.disconnectedGrace.set(player.accountId, { player, timeout });

      console.log(
        `[Shireland] ${player.name} disconnected (${GRACE_PERIOD_MS / 1000}s grace) — ${this.gameState.getPlayerCount()} online`
      );
    });
  }
}
