import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { ClientToServerEvents, ServerToClientEvents, TiledMap } from "@shireland/shared";
import { ITEM_SPAWN_CONFIG, TICK_MS } from "@shireland/shared";
import { runMigrations, ItemInstanceDao, pool } from "@shireland/database";
import { GameState } from "./state/GameState.js";
import { ItemState } from "./state/ItemState.js";
import { CollisionMap } from "./map/CollisionMap.js";
import { ConnectionHandler } from "./handlers/ConnectionHandler.js";
import { MovementHandler } from "./handlers/MovementHandler.js";
import { ChatHandler } from "./handlers/ChatHandler.js";
import { ItemHandler } from "./handlers/ItemHandler.js";
import { GameLoop } from "./GameLoop.js";
import { NpcManager } from "./npc/NpcManager.js";
import { PersistenceManager } from "./state/PersistenceManager.js";
import { authRouter } from "./routes/auth.js";
import { socketAuthMiddleware } from "./middleware/socketAuth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ShirelandServer {
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  private gameState: GameState;
  private gameLoop: GameLoop;
  private persistenceManager: PersistenceManager;

  constructor(port: number) {
    const app = express();

    app.use(cors({ origin: "http://localhost:4001", credentials: true }));
    app.use(cookieParser());
    app.use(express.json());

    const httpServer = createServer(app);

    this.io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: "http://localhost:4001", credentials: true },
    });

    // Socket auth middleware
    this.io.use(socketAuthMiddleware as any);

    // Load map data
    const mapPath = resolve(__dirname, "../../client/public/assets/maps/town.json");
    const collisionMap = new CollisionMap(mapPath);

    this.gameState = new GameState();
    const itemState = new ItemState();

    // Parse NPC/route data from the same map JSON
    const mapJson: TiledMap = JSON.parse(readFileSync(mapPath, "utf-8"));
    const npcManager = new NpcManager(
      mapJson.npcs ?? [],
      mapJson.routes ?? {},
      this.io,
      collisionMap,
      (x, y) => this.gameState.getAllPlayers().some((p) => p.x === x && p.y === y),
      (socketId) => {
        const p = this.gameState.getPlayer(socketId);
        return p ? { characterId: p.characterId } : undefined;
      }
    );

    // Persistence manager (dirty-flag write-back)
    this.persistenceManager = new PersistenceManager(this.gameState, itemState);

    // Handlers
    const connectionHandler = new ConnectionHandler(this.io, this.gameState, collisionMap, itemState, npcManager);
    const movementHandler = new MovementHandler(this.io, this.gameState, collisionMap);
    const chatHandler = new ChatHandler(this.io, this.gameState);
    const itemHandler = new ItemHandler(this.io, this.gameState, itemState, collisionMap);

    this.io.on("connection", (socket) => {
      connectionHandler.handle(socket);
      movementHandler.handle(socket);
      chatHandler.handle(socket);
      itemHandler.handle(socket);
      npcManager.onConnection(socket);
    });

    // Auth routes
    app.use("/api/auth", authRouter);

    // Serve built client in production
    const clientDist = resolve(__dirname, "../../client/dist");
    app.use(express.static(clientDist));

    // Health endpoint
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        players: this.gameState.getPlayerCount(),
      });
    });

    // Game loop
    this.gameLoop = new GameLoop(() => {
      npcManager.tick(TICK_MS);
    });

    // Start: run migrations, seed world items, listen
    this.start(port, itemState, collisionMap, httpServer);
  }

  private async start(
    port: number,
    itemState: ItemState,
    collisionMap: CollisionMap,
    httpServer: ReturnType<typeof createServer>
  ): Promise<void> {
    try {
      // Run DB migrations
      await runMigrations();

      // Seed world items from DB or spawn fresh
      await this.seedWorldItems(itemState, collisionMap);

      // Start persistence flush timer
      this.persistenceManager.start();

      httpServer.listen(port, () => {
        console.log(`[Shireland] Server listening on :${port}`);
        this.gameLoop.start();
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log("[Shireland] Shutting down...");
        this.gameLoop.stop();
        this.persistenceManager.stop();
        await this.persistenceManager.flushAll();
        await pool.end();
        console.log("[Shireland] Shutdown complete");
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (err) {
      console.error("[Shireland] Failed to start:", err);
      process.exit(1);
    }
  }

  private async seedWorldItems(
    itemState: ItemState,
    collisionMap: CollisionMap
  ): Promise<void> {
    const dbWorldItems = await ItemInstanceDao.findWorldItems();

    if (dbWorldItems.length > 0) {
      // Load from DB
      itemState.loadWorldItems(dbWorldItems);
      console.log(`[Shireland] Loaded ${dbWorldItems.length} world items from DB`);
    } else {
      // First boot: spawn and persist
      const w = collisionMap.getWidth();
      const h = collisionMap.getHeight();

      for (const { itemId, count } of ITEM_SPAWN_CONFIG) {
        let spawned = 0;
        let attempts = 0;
        while (spawned < count && attempts < count * 20) {
          attempts++;
          const x = 2 + Math.floor(Math.random() * (w - 4));
          const y = 2 + Math.floor(Math.random() * (h - 4));
          if (collisionMap.isPassable(x, y)) {
            const row = await ItemInstanceDao.createWorldItem(itemId, x, y);
            itemState.addToWorldFromDb(row.id, itemId, x, y);
            spawned++;
          }
        }
        console.log(`[Shireland] Spawned ${spawned} ${itemId} (persisted)`);
      }
    }
  }
}
