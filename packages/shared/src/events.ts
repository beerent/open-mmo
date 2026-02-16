import type {
  PlayerData,
  MovementInput,
  ChatMessage,
  WorldItem,
  InventorySlot,
  EquipmentLoadout,
} from "./types.js";

export interface ClientToServerEvents {
  "player:join": (data: {
    name: string;
    playerClass: string;
    characterId?: number;
  }) => void;
  "player:move": (data: MovementInput) => void;
  "chat:send": (data: { text: string }) => void;
  "item:pickup": (data: { itemId: string }) => void;
  "equipment:equip": (data: { slotIndex: number }) => void;
  "equipment:unequip": (data: { slot: string }) => void;
}

export interface ServerToClientEvents {
  "state:snapshot": (data: { players: PlayerData[] }) => void;
  "player:joined": (data: PlayerData) => void;
  "player:left": (data: { id: string }) => void;
  "player:moved": (data: {
    id: string;
    x: number;
    y: number;
    direction: number;
    timestamp: number;
  }) => void;
  "chat:message": (data: ChatMessage) => void;
  "items:snapshot": (data: { items: WorldItem[] }) => void;
  "item:picked-up": (data: { itemId: string; playerId: string }) => void;
  "inventory:update": (data: { inventory: InventorySlot[] }) => void;
  "player:equipment-changed": (data: {
    id: string;
    equipment: EquipmentLoadout;
  }) => void;
  "auth:error": (data: { message: string }) => void;
  "auth:character": (data: {
    characterId: number;
    name: string;
    playerClass: string;
    x: number;
    y: number;
  }) => void;
}
