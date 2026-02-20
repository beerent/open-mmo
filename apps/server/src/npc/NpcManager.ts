import type { Server as SocketServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  NpcDef,
  NpcData,
  NpcRouteWaypoint,
  QuestData,
} from "@shireland/shared";
import {
  Direction,
  NPC_MOVE_DURATION_MS,
  NPC_DEFAULT_PAUSE_CHANCE,
  NPC_DEFAULT_PAUSE_MIN_MS,
  NPC_DEFAULT_PAUSE_MAX_MS,
  NPC_DIALOG,
  NPC_USER_DIALOG_DURATION_MS,
} from "@shireland/shared";
import type { Socket } from "socket.io";
import type { CollisionMap } from "../map/CollisionMap.js";
import { NpcStateManager } from "./NpcStateManager.js";

interface PlayerInfo {
  characterId: number;
}

interface NpcState {
  id: string;
  name: string;
  npcType: string;
  dialogKey: string;
  tileX: number;
  tileY: number;
  prevX: number;
  prevY: number;
  direction: Direction;
  state: "idle" | "moving" | "pausing";
  moveTimer: number;
  pauseTimer: number;
  pauseChance: number;
  pauseMinMs: number;
  pauseMaxMs: number;
  route: NpcRouteWaypoint[];
  debug: string;
}

type TypedIO = SocketServer<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class NpcManager {
  private npcs: NpcState[] = [];
  private io: TypedIO;
  private collisionMap: CollisionMap;
  private isPlayerAt: (x: number, y: number) => boolean;
  private getPlayer: (socketId: string) => PlayerInfo | undefined;
  private debugMode = false;
  private stateManager = new NpcStateManager();

  constructor(
    npcDefs: NpcDef[],
    routes: Record<string, NpcRouteWaypoint[]>,
    io: TypedIO,
    collisionMap: CollisionMap,
    isPlayerAt: (x: number, y: number) => boolean,
    getPlayer: (socketId: string) => PlayerInfo | undefined
  ) {
    this.io = io;
    this.collisionMap = collisionMap;
    this.isPlayerAt = isPlayerAt;
    this.getPlayer = getPlayer;

    for (const def of npcDefs) {
      const route = routes[def.route] ?? [];
      const start = route[0];
      if (!start) continue;

      // Block the NPC's starting tile
      this.collisionMap.block(start.tileX, start.tileY);

      this.npcs.push({
        id: def.id,
        name: def.name,
        npcType: def.npcType,
        dialogKey: def.dialogKey ?? def.npcType,
        tileX: start.tileX,
        tileY: start.tileY,
        prevX: start.tileX,
        prevY: start.tileY,
        direction: Direction.Down,
        state: "idle",
        moveTimer: 0,
        pauseTimer: 0,
        pauseChance: def.pauseChance ?? NPC_DEFAULT_PAUSE_CHANCE,
        pauseMinMs: def.pauseMinMs ?? NPC_DEFAULT_PAUSE_MIN_MS,
        pauseMaxMs: def.pauseMaxMs ?? NPC_DEFAULT_PAUSE_MAX_MS,
        route,
        debug: `idle at (${start.tileX},${start.tileY}), ${route.length} tiles in route`,
      });
    }

    console.log(`[NpcManager] Initialized ${this.npcs.length} NPCs`);
  }

  setDebug(on: boolean): void {
    this.debugMode = on;
  }

  tick(dt: number): void {
    for (const npc of this.npcs) {
      if (npc.route.length <= 1) continue;

      if (npc.state === "moving") {
        npc.moveTimer -= dt;
        if (npc.moveTimer <= 0) {
          // Roll for random pause after completing a move
          if (Math.random() < npc.pauseChance) {
            npc.state = "pausing";
            npc.pauseTimer = npc.pauseMinMs + Math.random() * (npc.pauseMaxMs - npc.pauseMinMs);
            // Roll for ambient dialog when entering pause — always broadcast
            const dialogConfig = NPC_DIALOG[npc.dialogKey] ?? NPC_DIALOG[npc.npcType];
            if (dialogConfig && Math.random() < dialogConfig.dialogChance) {
              const line = dialogConfig.lines[Math.floor(Math.random() * dialogConfig.lines.length)];
              this.io.emit("npc:chat", { id: npc.id, text: line });
            }
            continue;
          }
          npc.state = "idle";
          // fall through to idle logic — pick next tile immediately
        } else {
          continue;
        }
      }

      if (npc.state === "pausing") {
        npc.pauseTimer -= dt;
        if (npc.pauseTimer <= 0) npc.state = "idle";
        continue;
      }

      // Find adjacent route tiles (Manhattan distance 1)
      const neighbors = npc.route.filter((t) => {
        const dx = Math.abs(t.tileX - npc.tileX);
        const dy = Math.abs(t.tileY - npc.tileY);
        return dx + dy === 1;
      });

      if (neighbors.length === 0) {
        npc.debug = `(${npc.tileX},${npc.tileY}) — no neighbors, stuck`;
        continue;
      }

      // Filter out tiles occupied by players
      const passable = neighbors.filter(
        (t) => !this.isPlayerAt(t.tileX, t.tileY)
      );

      if (passable.length === 0) {
        // All directions blocked by players — wait
        npc.debug = `(${npc.tileX},${npc.tileY}) — blocked by players`;
        continue;
      }

      // If more than one passable neighbor, filter out the previous tile to avoid backtracking
      const candidates = passable.length > 1
        ? passable.filter((t) => t.tileX !== npc.prevX || t.tileY !== npc.prevY)
        : passable;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const dx = pick.tileX - npc.tileX;
      const dy = pick.tileY - npc.tileY;

      if (dx !== 0 || dy !== 0) {
        npc.direction = Math.abs(dx) >= Math.abs(dy)
          ? (dx > 0 ? Direction.Right : Direction.Left)
          : (dy > 0 ? Direction.Down : Direction.Up);
      }

      const neighborsStr = neighbors.map(n => `(${n.tileX},${n.tileY})`).join(" ");
      npc.debug = `(${npc.tileX},${npc.tileY}) prev(${npc.prevX},${npc.prevY})\n`
        + `adj: ${neighborsStr}\n`
        + `pick: (${pick.tileX},${pick.tileY})`;

      npc.prevX = npc.tileX;
      npc.prevY = npc.tileY;
      npc.tileX = pick.tileX;
      npc.tileY = pick.tileY;
      npc.state = "moving";
      npc.moveTimer = NPC_MOVE_DURATION_MS;

      // Update collision: free old tile, claim new tile
      this.collisionMap.unblock(npc.prevX, npc.prevY);
      this.collisionMap.block(npc.tileX, npc.tileY);

      this.io.emit("npc:moved", {
        id: npc.id,
        x: npc.tileX,
        y: npc.tileY,
        direction: npc.direction,
        ...(this.debugMode && { debug: npc.debug }),
      });
    }
  }

  getSnapshot(): (NpcData & { debug?: string })[] {
    return this.npcs.map((npc) => {
      const dialogConfig = NPC_DIALOG[npc.dialogKey] ?? NPC_DIALOG[npc.npcType];
      return {
        id: npc.id,
        name: npc.name,
        npcType: npc.npcType,
        x: npc.tileX,
        y: npc.tileY,
        direction: npc.direction,
        hasDialog: !!(
          (dialogConfig?.userLines && dialogConfig.userLines.length > 0) ||
          dialogConfig?.behaviors
        ),
        ...(this.debugMode && { debug: npc.debug }),
      };
    });
  }

  /** Build quest list for a player based on their NPC states */
  private buildQuestList(characterId: number): QuestData[] {
    const quests: QuestData[] = [];

    for (const npc of this.npcs) {
      const dialogConfig = NPC_DIALOG[npc.dialogKey] ?? NPC_DIALOG[npc.npcType];
      if (!dialogConfig?.quest) continue;

      const quest = dialogConfig.quest;
      const playerState = this.stateManager.getState(characterId, npc.dialogKey);
      const status = quest.statusMap[playerState] ?? "not_started";

      // Only include quests the player has interacted with (not "not_started")
      if (status === "not_started") continue;

      quests.push({
        questId: quest.questId,
        name: quest.name,
        description: quest.description,
        reward: quest.reward,
        status,
      });
    }

    return quests;
  }

  /** Send full quest snapshot to a player (call on join) */
  emitQuestSnapshot(socket: TypedSocket, characterId: number): void {
    const quests = this.buildQuestList(characterId);
    if (quests.length > 0) {
      socket.emit("quest:snapshot", { quests });
    }
  }

  onConnection(socket: TypedSocket): void {
    socket.emit("npc:snapshot", { npcs: this.getSnapshot() });

    socket.on("npc:talk", ({ npcId }) => {
      const npc = this.npcs.find((n) => n.id === npcId);
      if (!npc) return;

      // Pause the NPC (visible to all)
      if (npc.state === "pausing") {
        npc.pauseTimer = Math.max(npc.pauseTimer, NPC_USER_DIALOG_DURATION_MS);
      } else {
        npc.state = "pausing";
        npc.pauseTimer = NPC_USER_DIALOG_DURATION_MS;
      }

      // Resolve the player's personal state with this NPC
      const player = this.getPlayer(socket.id);
      if (!player) return;

      const dialogConfig = NPC_DIALOG[npc.dialogKey] ?? NPC_DIALOG[npc.npcType];
      if (!dialogConfig) return;

      const characterId = player.characterId;
      const stateId = this.stateManager.getState(characterId, npc.dialogKey);
      const behavior = dialogConfig.behaviors?.[stateId];

      let line: string;
      let scope: "world" | "player" = "world";

      if (behavior && behavior.responses.length > 0) {
        // Use behavior-specific responses
        line = behavior.responses[Math.floor(Math.random() * behavior.responses.length)];
        scope = behavior.scope;
      } else if (dialogConfig.userLines && dialogConfig.userLines.length > 0) {
        // Fall back to flat userLines (DEFAULT state)
        line = dialogConfig.userLines[Math.floor(Math.random() * dialogConfig.userLines.length)];
      } else {
        return;
      }

      // Scoped emission
      if (scope === "player") {
        socket.emit("npc:chat", { id: npc.id, text: line, isResponse: true });
      } else {
        this.io.emit("npc:chat", { id: npc.id, text: line, isResponse: true });
      }

      // State transition
      if (behavior?.onTalk) {
        this.stateManager.setState(characterId, npc.dialogKey, behavior.onTalk);
        // Send updated quest list
        const quests = this.buildQuestList(characterId);
        socket.emit("quest:update", { quests });
      }
    });

    socket.on("npc:debug-request", () => {
      const player = this.getPlayer(socket.id);
      if (!player) return;

      const states = this.npcs.map((npc) => {
        const dialogConfig = NPC_DIALOG[npc.dialogKey] ?? NPC_DIALOG[npc.npcType];
        const stateId = this.stateManager.getState(player.characterId, npc.dialogKey);
        const quest = dialogConfig?.quest;
        const questStatus = quest
          ? quest.statusMap[stateId] ?? "not_started"
          : undefined;

        return {
          npcId: npc.id,
          dialogKey: npc.dialogKey,
          state: stateId,
          questStatus,
        };
      });

      socket.emit("npc:debug", { states });
    });
  }
}
