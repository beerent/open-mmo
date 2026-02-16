import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shireland/shared";
import { Direction, MOVE_DURATION_MS, DIR_DELTA } from "@shireland/shared";
import { GameState } from "../state/GameState.js";
import { CollisionMap } from "../map/CollisionMap.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class MovementHandler {
  constructor(
    private io: TypedServer,
    private gameState: GameState,
    private collisionMap: CollisionMap
  ) {}

  handle(socket: TypedSocket) {
    socket.on("player:move", ({ direction, timestamp }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      // Rate limit: can't move faster than MOVE_DURATION_MS
      const now = Date.now();
      if (now - player.lastMoveTime < MOVE_DURATION_MS * 0.8) return;

      // Validate direction
      if (!Object.values(Direction).includes(direction)) return;

      // Calculate target
      const { dx, dy } = DIR_DELTA[direction];
      const targetX = player.x + dx;
      const targetY = player.y + dy;

      // Corner-cutting prevention: for diagonal moves, both adjacent cardinal tiles must be passable
      if (dx !== 0 && dy !== 0) {
        if (!this.collisionMap.isPassable(player.x + dx, player.y) ||
            !this.collisionMap.isPassable(player.x, player.y + dy)) {
          return;
        }
      }

      // Validate collision
      if (!this.collisionMap.isPassable(targetX, targetY)) return;

      // Update state
      player.x = targetX;
      player.y = targetY;
      player.direction = direction;
      player.lastMoveTime = now;
      player.dirty = true;

      // Broadcast to all clients (including sender for reconciliation)
      this.io.emit("player:moved", {
        id: socket.id,
        x: targetX,
        y: targetY,
        direction,
        timestamp,
      });
    });
  }
}
