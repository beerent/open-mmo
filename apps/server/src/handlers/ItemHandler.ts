import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shireland/shared";
import { ITEM_PICKUP_COOLDOWN_MS, ITEM_DROP_COOLDOWN_MS, getItemDef } from "@shireland/shared";
import { GameState } from "../state/GameState.js";
import { ItemState } from "../state/ItemState.js";
import { CollisionMap } from "../map/CollisionMap.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class ItemHandler {
  private lastPickupTime = new Map<string, number>();
  private lastDropTime = new Map<string, number>();

  constructor(
    private io: TypedServer,
    private gameState: GameState,
    private itemState: ItemState,
    private collisionMap: CollisionMap
  ) {}

  handle(socket: TypedSocket) {
    socket.on("item:pickup", ({ itemId }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      // Rate limit
      const now = Date.now();
      const lastTime = this.lastPickupTime.get(socket.id) ?? 0;
      if (now - lastTime < ITEM_PICKUP_COOLDOWN_MS) return;

      // Validate item exists in world
      const item = this.itemState.getWorldItem(itemId);
      if (!item) return;

      // Validate same-tile proximity
      if (item.location.type !== "world") return;
      if (player.x !== item.location.x || player.y !== item.location.y) return;

      this.lastPickupTime.set(socket.id, now);

      // Move from world to inventory (using characterId)
      const success = this.itemState.pickup(itemId, player.characterId);
      if (!success) return;

      // Update player's cached equipment
      player.equipment = this.itemState.getEquipment(player.characterId);

      // Broadcast removal to all
      this.io.emit("item:picked-up", { itemId, playerId: socket.id });

      // Send updated inventory to picker only
      socket.emit("inventory:update", {
        inventory: this.itemState.getInventory(player.characterId),
      });

      const def = getItemDef(item.defId);
      const itemName = def?.name ?? item.defId;
      console.log(
        `[Shireland] ${player.name} picked up ${itemName} at (${item.location.x}, ${item.location.y})`
      );
    });

    socket.on("equipment:equip", ({ slotIndex }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      const success = this.itemState.equip(player.characterId, slotIndex);
      if (!success) return;

      // Update cached equipment on player
      player.equipment = this.itemState.getEquipment(player.characterId);

      // Send updated inventory to this player
      socket.emit("inventory:update", {
        inventory: this.itemState.getInventory(player.characterId),
      });

      // Broadcast equipment change to all players
      this.io.emit("player:equipment-changed", {
        id: socket.id,
        equipment: player.equipment,
      });

      console.log(
        `[Shireland] ${player.name} equipped ${JSON.stringify(player.equipment)}`
      );
    });

    socket.on("equipment:unequip", ({ slot }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      const success = this.itemState.unequip(player.characterId, slot);
      if (!success) return;

      // Update cached equipment on player
      player.equipment = this.itemState.getEquipment(player.characterId);

      // Send updated inventory to this player
      socket.emit("inventory:update", {
        inventory: this.itemState.getInventory(player.characterId),
      });

      // Broadcast equipment change to all players
      this.io.emit("player:equipment-changed", {
        id: socket.id,
        equipment: player.equipment,
      });

      console.log(
        `[Shireland] ${player.name} unequipped from slot ${slot}`
      );
    });

    socket.on("item:drop", ({ slotIndex }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;

      // Rate limit
      const now = Date.now();
      const lastTime = this.lastDropTime.get(socket.id) ?? 0;
      if (now - lastTime < ITEM_DROP_COOLDOWN_MS) return;

      // Validate slot has an item
      const inventory = this.itemState.getInventoryInstances(player.characterId);
      const itemInSlot = inventory.find(
        (inst) => inst.location.type === "inventory" && inst.location.slotIndex === slotIndex
      );
      if (!itemInSlot) return;

      const def = getItemDef(itemInSlot.defId);
      if (!def) return;

      this.lastDropTime.set(socket.id, now);

      // Calculate how many world items we'll create
      const chunkCount = Math.ceil(itemInSlot.count / def.worldStackMax);

      // Find nearby passable tiles for scatter
      const tiles = this.collisionMap.findNearbyPassable(player.x, player.y, chunkCount);
      if (tiles.length === 0) return;

      const result = this.itemState.drop(player.characterId, slotIndex, tiles);
      if (!result) return;

      // Build world items for broadcast
      const worldItems = result.items.map((inst) => ({
        id: inst.instanceId,
        itemId: inst.defId,
        x: (inst.location as { x: number; y: number }).x,
        y: (inst.location as { x: number; y: number }).y,
      }));

      // Broadcast dropped items to all clients
      this.io.emit("items:dropped", {
        items: worldItems,
        fromX: player.x,
        fromY: player.y,
      });

      // Update dropper's inventory
      socket.emit("inventory:update", {
        inventory: this.itemState.getInventory(player.characterId),
      });

      // Update cached equipment (in case equipped item was in inventory)
      player.equipment = this.itemState.getEquipment(player.characterId);

      const itemName = def.name;
      console.log(
        `[Shireland] ${player.name} dropped ${itemInSlot.count}x ${itemName} at (${player.x}, ${player.y})`
      );
    });

    socket.on("disconnect", () => {
      this.lastPickupTime.delete(socket.id);
      this.lastDropTime.delete(socket.id);
      // Note: item cleanup is handled by ConnectionHandler (save + unload)
    });
  }
}
