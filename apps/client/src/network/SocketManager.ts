import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
  ChatMessage,
  WorldItem,
  InventorySlot,
  EquipmentLoadout,
  NpcData,
  QuestData,
} from "@shireland/shared";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketManager {
  private socket: TypedSocket;
  private lastJoin?: { name: string; playerClass: string; characterId?: number };

  // Callbacks
  onSnapshot?: (players: PlayerData[]) => void;
  onPlayerJoined?: (player: PlayerData) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerMoved?: (data: { id: string; x: number; y: number; direction: number; timestamp: number }) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onItemsSnapshot?: (items: WorldItem[]) => void;
  onItemPickedUp?: (data: { itemId: string; playerId: string }) => void;
  onInventoryUpdate?: (inventory: InventorySlot[]) => void;
  onEquipmentChanged?: (data: { id: string; equipment: EquipmentLoadout }) => void;
  onItemsDropped?: (data: { items: WorldItem[]; fromX: number; fromY: number }) => void;
  onNpcSnapshot?: (npcs: NpcData[]) => void;
  onNpcMoved?: (data: { id: string; x: number; y: number; direction: number; debug?: string }) => void;
  onNpcChat?: (data: { id: string; text: string; isResponse?: boolean }) => void;
  onQuestUpdate?: (quests: QuestData[]) => void;
  onQuestSnapshot?: (quests: QuestData[]) => void;
  onNpcDebug?: (states: { npcId: string; dialogKey: string; state: string; questStatus?: string }[]) => void;
  onAuthError?: (message: string) => void;

  constructor() {
    this.socket = io({ transports: ["websocket"], withCredentials: true });

    this.socket.on("connect", () => {
      console.log(`[Shireland] Connected as ${this.socket.id}`);
      // Auto-rejoin on reconnect (laptop lid close, tab switch, wifi drop)
      if (this.lastJoin) {
        console.log("[Shireland] Reconnecting — re-joining...");
        this.socket.emit("player:join", this.lastJoin);
      }
    });

    this.socket.on("disconnect", () => {
      console.log("[Shireland] Disconnected");
    });

    this.socket.on("state:snapshot", ({ players }) => {
      this.onSnapshot?.(players);
    });

    this.socket.on("player:joined", (player) => {
      this.onPlayerJoined?.(player);
    });

    this.socket.on("player:left", ({ id }) => {
      this.onPlayerLeft?.(id);
    });

    this.socket.on("player:moved", (data) => {
      this.onPlayerMoved?.(data);
    });

    this.socket.on("chat:message", (msg) => {
      this.onChatMessage?.(msg);
    });

    this.socket.on("items:snapshot", ({ items }) => {
      this.onItemsSnapshot?.(items);
    });

    this.socket.on("item:picked-up", (data) => {
      this.onItemPickedUp?.(data);
    });

    this.socket.on("inventory:update", ({ inventory }) => {
      this.onInventoryUpdate?.(inventory);
    });

    this.socket.on("player:equipment-changed", (data) => {
      this.onEquipmentChanged?.(data);
    });

    this.socket.on("items:dropped", (data) => {
      this.onItemsDropped?.(data);
    });

    this.socket.on("npc:snapshot", ({ npcs }) => {
      this.onNpcSnapshot?.(npcs);
    });

    this.socket.on("npc:moved", (data) => {
      this.onNpcMoved?.(data);
    });

    this.socket.on("npc:chat", (data) => {
      this.onNpcChat?.(data);
    });

    this.socket.on("quest:update", ({ quests }) => {
      this.onQuestUpdate?.(quests);
    });

    this.socket.on("quest:snapshot", ({ quests }) => {
      this.onQuestSnapshot?.(quests);
    });

    this.socket.on("npc:debug", ({ states }) => {
      this.onNpcDebug?.(states);
    });

    this.socket.on("auth:error", ({ message }) => {
      this.onAuthError?.(message);
    });
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  join(name: string, playerClass: string, characterId?: number) {
    this.lastJoin = { name, playerClass, characterId };
    this.socket.emit("player:join", { name, playerClass, characterId });
  }

  sendMove(direction: number, timestamp: number, seq: number) {
    this.socket.emit("player:move", { direction, timestamp, seq });
  }

  sendChat(text: string) {
    this.socket.emit("chat:send", { text });
  }

  sendPickup(itemId: string) {
    this.socket.emit("item:pickup", { itemId });
  }

  sendEquip(slotIndex: number) {
    this.socket.emit("equipment:equip", { slotIndex });
  }

  sendUnequip(slot: string) {
    this.socket.emit("equipment:unequip", { slot });
  }

  sendDrop(slotIndex: number) {
    this.socket.emit("item:drop", { slotIndex });
  }

  sendNpcTalk(npcId: string) {
    this.socket.emit("npc:talk", { npcId });
  }

  sendNpcDebugRequest() {
    this.socket.emit("npc:debug-request");
  }

  disconnect() {
    this.socket.disconnect();
  }
}
