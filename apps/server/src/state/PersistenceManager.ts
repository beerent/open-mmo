import { CharacterDao, ItemInstanceDao } from "@shireland/database";
import { GameState } from "./GameState.js";
import { ItemState } from "./ItemState.js";

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

export class PersistenceManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private gameState: GameState,
    private itemState: ItemState
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.flushDirty().catch((err) => {
        console.error("[Persistence] Flush error:", err);
      });
    }, FLUSH_INTERVAL_MS);
    console.log(`[Persistence] Started (${FLUSH_INTERVAL_MS / 1000}s interval)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Flush only dirty player positions via batch update */
  private async flushDirty(): Promise<void> {
    const dirty = this.gameState.getDirtyPlayers();
    if (dirty.length === 0) return;

    const updates = dirty.map((p) => ({
      id: p.characterId,
      x: p.x,
      y: p.y,
      direction: p.direction as number,
    }));

    await CharacterDao.batchUpdatePositions(updates);

    for (const p of dirty) {
      p.dirty = false;
    }

    console.log(`[Persistence] Flushed ${dirty.length} dirty character(s)`);
  }

  /** Save all online players (positions + items) — for graceful shutdown */
  async flushAll(): Promise<void> {
    const players = this.gameState.getAllPlayers();
    if (players.length === 0) return;

    console.log(`[Persistence] Shutdown flush: ${players.length} player(s)`);

    // Batch update all positions
    const updates = players.map((p) => ({
      id: p.characterId,
      x: p.x,
      y: p.y,
      direction: p.direction as number,
    }));
    await CharacterDao.batchUpdatePositions(updates);

    // Save items for each player
    for (const player of players) {
      try {
        const items = this.itemState.getPlayerItems(player.characterId);
        await ItemInstanceDao.saveAllForCharacter(player.characterId, items);
      } catch (err) {
        console.error(`[Persistence] Failed to save items for ${player.name}:`, err);
      }
    }

    console.log("[Persistence] Shutdown flush complete");
  }
}
