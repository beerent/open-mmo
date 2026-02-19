import type { Server as SocketServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  NpcDef,
  NpcData,
  NpcRouteWaypoint,
} from "@shireland/shared";
import {
  Direction,
  NPC_MOVE_DURATION_MS,
  NPC_DEFAULT_PAUSE_CHANCE,
  NPC_DEFAULT_PAUSE_MIN_MS,
  NPC_DEFAULT_PAUSE_MAX_MS,
} from "@shireland/shared";
import type { Socket } from "socket.io";
import type { CollisionMap } from "../map/CollisionMap.js";

interface NpcState {
  id: string;
  name: string;
  npcType: string;
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
  private debugMode = false;

  constructor(
    npcDefs: NpcDef[],
    routes: Record<string, NpcRouteWaypoint[]>,
    io: TypedIO,
    collisionMap: CollisionMap
  ) {
    this.io = io;
    this.collisionMap = collisionMap;

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

      // If more than one neighbor, filter out the previous tile to avoid backtracking
      const candidates = neighbors.length > 1
        ? neighbors.filter((t) => t.tileX !== npc.prevX || t.tileY !== npc.prevY)
        : neighbors;

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
    return this.npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      npcType: npc.npcType,
      x: npc.tileX,
      y: npc.tileY,
      direction: npc.direction,
      ...(this.debugMode && { debug: npc.debug }),
    }));
  }

  onConnection(socket: TypedSocket): void {
    socket.emit("npc:snapshot", { npcs: this.getSnapshot() });
  }
}
