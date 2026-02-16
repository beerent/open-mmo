import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shireland/shared";
import { ITEM_PICKUP_COOLDOWN_MS, getItemDef } from "@shireland/shared";
import { GameState } from "../state/GameState.js";
import { ItemState } from "../state/ItemState.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class ItemHandler {
  private lastPickupTime = new Map<string, number>();

  constructor(
    private io: TypedServer,
    private gameState: GameState,
    private itemState: ItemState
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

    socket.on("disconnect", () => {
      this.lastPickupTime.delete(socket.id);
      // Note: item cleanup is handled by ConnectionHandler (save + unload)
    });
  }
}
