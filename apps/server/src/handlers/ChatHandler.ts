import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shireland/shared";
import { CHAT_MAX_LENGTH, CHAT_RATE_LIMIT_MS } from "@shireland/shared";
import { GameState } from "../state/GameState.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class ChatHandler {
  private lastChatTime = new Map<string, number>();

  constructor(
    private io: TypedServer,
    private gameState: GameState
  ) {}

  handle(socket: TypedSocket) {
    socket.on("chat:send", ({ text }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      // Rate limit
      const now = Date.now();
      const lastTime = this.lastChatTime.get(socket.id) ?? 0;
      if (now - lastTime < CHAT_RATE_LIMIT_MS) return;
      this.lastChatTime.set(socket.id, now);

      // Validate text
      const cleanText = text.trim().slice(0, CHAT_MAX_LENGTH);
      if (!cleanText) return;

      this.io.emit("chat:message", {
        senderId: socket.id,
        senderName: player.name,
        text: cleanText,
        timestamp: now,
      });
    });

    socket.on("disconnect", () => {
      this.lastChatTime.delete(socket.id);
    });
  }
}
