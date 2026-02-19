import type { EquipSlot } from "./items/ItemDef.js";

export enum Direction {
  Down = 0,
  Left = 1,
  Right = 2,
  Up = 3,
}

export enum PlayerClass {
  Wizard = "wizard",
  Warrior = "warrior",
}

export interface EquipmentLoadout {
  mainHand?: string; // defId or undefined
}

export interface PlayerData {
  id: string;
  name: string;
  playerClass: PlayerClass;
  x: number;
  y: number;
  direction: Direction;
  equipment: EquipmentLoadout;
}

export interface MovementInput {
  direction: Direction;
  timestamp: number;
  seq: number;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface WorldItem {
  id: string;
  itemId: string; // defId from ITEM_REGISTRY
  x: number;
  y: number;
}

export interface InventorySlot {
  itemId: string; // defId
  count: number;
}

export interface ItemLocation {
  type: "world" | "inventory" | "equipment";
}

export interface WorldLocation extends ItemLocation {
  type: "world";
  x: number;
  y: number;
}

export interface InventoryLocation extends ItemLocation {
  type: "inventory";
  ownerId: number;
  slotIndex: number;
}

export interface EquipmentLocation extends ItemLocation {
  type: "equipment";
  ownerId: number;
  slot: EquipSlot;
}

export type ItemLocationUnion =
  | WorldLocation
  | InventoryLocation
  | EquipmentLocation;

export interface ItemInstance {
  instanceId: string;
  defId: string;
  count: number;
  location: ItemLocationUnion;
}

// Keep ItemType for backward compat during transition (used by asset scripts)
export enum ItemType {
  Marble = "marble",
}

// Legacy — replaced by InventorySlot
export interface InventoryItem {
  type: ItemType;
  count: number;
}

export interface TiledTileEntry {
  id: number;
  image: string;
  imagewidth: number;
  imageheight: number;
}

export interface TiledTileset {
  firstgid: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
  name: string;
  tiles?: TiledTileEntry[];
  animations?: Record<number, { animX: number; animY: number; animCountX: number; animDivisor: number }>;
}

export interface TiledObject {
  gid?: number;
  name?: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: { name: string; type?: string; value: string | number | boolean }[];
}

export interface TiledLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];
  objects?: TiledObject[];
  width: number;
  height: number;
  visible: boolean;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  npcs?: NpcDef[];
  routes?: Record<string, NpcRouteWaypoint[]>;
}

// ── NPC Types ──────────────────────────────────────────────────────────────

export interface NpcData {
  id: string;
  name: string;
  npcType: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface NpcRouteWaypoint {
  tileX: number;
  tileY: number;
}

export interface NpcDef {
  id: string;
  name: string;
  npcType: string;
  route: string;
  pauseChance?: number;
  pauseMinMs?: number;
  pauseMaxMs?: number;
}
