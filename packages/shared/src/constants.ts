import { Direction } from "./types.js";

export const TILE_SIZE = 16;
export const DISPLAY_SCALE = 1.5;
export const SCALED_TILE = TILE_SIZE * DISPLAY_SCALE;

export const SERVER_TICK_RATE = 20;
export const TICK_MS = 1000 / SERVER_TICK_RATE;

export const MOVE_DURATION_MS = 250;
export const WALK_ANIM_FPS = 8;

export const CHAT_BUBBLE_DURATION_MS = 5000;
export const CHAT_RATE_LIMIT_MS = 1000;
export const CHAT_MAX_LENGTH = 200;

export const SERVER_PORT = 4000;

export const SPRITE_FRAMES = 4;
export const SPRITE_DIRECTIONS = 4;
export const SPRITE_SHEET_SIZE = 64;

export const ITEM_PICKUP_COOLDOWN_MS = 500;
export const ITEM_DROP_COOLDOWN_MS = 500;
export const NOTIFICATION_DURATION_MS = 3000;
export const MARBLE_SPAWN_COUNT = 8;

export const ITEM_SPAWN_CONFIG: { itemId: string; count: number }[] = [
  { itemId: "marble", count: 8 },
  { itemId: "wizard_staff", count: 1 },
];

export const INVENTORY_SLOTS = 16;

export const NPC_MOVE_DURATION_MS = 400;
export const NPC_DEFAULT_PAUSE_CHANCE = 0.3;
export const NPC_DEFAULT_PAUSE_MIN_MS = 1000;
export const NPC_DEFAULT_PAUSE_MAX_MS = 4000;

export const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  [Direction.Down]:  { dx:  0, dy:  1 },
  [Direction.Left]:  { dx: -1, dy:  0 },
  [Direction.Right]: { dx:  1, dy:  0 },
  [Direction.Up]:    { dx:  0, dy: -1 },
};
