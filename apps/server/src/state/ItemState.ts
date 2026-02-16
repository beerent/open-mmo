import {
  EquipSlot,
  INVENTORY_SLOTS,
  getItemDef,
  isEquippable,
} from "@shireland/shared";
import type {
  WorldItem,
  InventorySlot,
  EquipmentLoadout,
  ItemInstance,
} from "@shireland/shared";
import type { ItemInstanceRow } from "@shireland/database";

let nextId = 1;

export class ItemState {
  private instances = new Map<string, ItemInstance>();

  // --- World ---

  addToWorld(defId: string, x: number, y: number): ItemInstance {
    const instanceId = `item_${nextId++}`;
    const instance: ItemInstance = {
      instanceId,
      defId,
      count: 1,
      location: { type: "world", x, y },
    };
    this.instances.set(instanceId, instance);
    return instance;
  }

  addToWorldFromDb(dbId: number, defId: string, x: number, y: number): ItemInstance {
    const instanceId = `db_${dbId}`;
    const instance: ItemInstance = {
      instanceId,
      defId,
      count: 1,
      location: { type: "world", x, y },
    };
    this.instances.set(instanceId, instance);
    return instance;
  }

  loadWorldItems(rows: ItemInstanceRow[]): void {
    for (const row of rows) {
      if (row.location_type === "world" && row.x != null && row.y != null) {
        this.addToWorldFromDb(row.id, row.def_id, row.x, row.y);
      }
    }
  }

  loadCharacterItems(characterId: number, rows: ItemInstanceRow[]): void {
    for (const row of rows) {
      const instanceId = `db_${row.id}`;
      if (row.location_type === "inventory" && row.slot_index != null) {
        this.instances.set(instanceId, {
          instanceId,
          defId: row.def_id,
          count: row.count,
          location: { type: "inventory", ownerId: characterId, slotIndex: row.slot_index },
        });
      } else if (row.location_type === "equipment" && row.equip_slot != null) {
        this.instances.set(instanceId, {
          instanceId,
          defId: row.def_id,
          count: row.count,
          location: { type: "equipment", ownerId: characterId, slot: row.equip_slot as EquipSlot },
        });
      }
    }
  }

  unloadCharacter(characterId: number): void {
    const toRemove: string[] = [];
    for (const inst of this.instances.values()) {
      if (inst.location.type !== "world") {
        const ownerId = inst.location.ownerId;
        if (ownerId === characterId) {
          toRemove.push(inst.instanceId);
        }
      }
    }
    for (const id of toRemove) {
      this.instances.delete(id);
    }
  }

  getPlayerItems(characterId: number): {
    defId: string;
    count: number;
    locationType: "inventory" | "equipment";
    slotIndex?: number;
    equipSlot?: string;
  }[] {
    const items: {
      defId: string;
      count: number;
      locationType: "inventory" | "equipment";
      slotIndex?: number;
      equipSlot?: string;
    }[] = [];

    for (const inst of this.instances.values()) {
      if (inst.location.type === "inventory" && inst.location.ownerId === characterId) {
        items.push({
          defId: inst.defId,
          count: inst.count,
          locationType: "inventory",
          slotIndex: inst.location.slotIndex,
        });
      } else if (inst.location.type === "equipment" && inst.location.ownerId === characterId) {
        items.push({
          defId: inst.defId,
          count: inst.count,
          locationType: "equipment",
          equipSlot: inst.location.slot,
        });
      }
    }

    return items;
  }

  getWorldItem(instanceId: string): ItemInstance | undefined {
    const inst = this.instances.get(instanceId);
    if (inst && inst.location.type === "world") return inst;
    return undefined;
  }

  getWorldItems(): WorldItem[] {
    const items: WorldItem[] = [];
    for (const inst of this.instances.values()) {
      if (inst.location.type === "world") {
        items.push({
          id: inst.instanceId,
          itemId: inst.defId,
          x: inst.location.x,
          y: inst.location.y,
        });
      }
    }
    return items;
  }

  // --- Inventory ---

  pickup(instanceId: string, characterId: number): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.location.type !== "world") return false;

    const def = getItemDef(inst.defId);
    if (!def) return false;

    // For stackable items, try to merge into existing stack
    if (def.maxStack > 1) {
      const existing = this.findInventoryItem(characterId, inst.defId);
      if (existing && existing.count < def.maxStack) {
        existing.count += inst.count;
        this.instances.delete(instanceId);
        return true;
      }
    }

    // Find next free inventory slot
    const slotIndex = this.findFreeInventorySlot(characterId);
    if (slotIndex === -1) return false; // Inventory full

    inst.location = { type: "inventory", ownerId: characterId, slotIndex };
    return true;
  }

  getInventory(characterId: number): InventorySlot[] {
    const slots: InventorySlot[] = [];
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "inventory" &&
        inst.location.ownerId === characterId
      ) {
        slots.push({ itemId: inst.defId, count: inst.count });
      }
    }
    return slots;
  }

  getInventoryInstances(characterId: number): ItemInstance[] {
    const items: ItemInstance[] = [];
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "inventory" &&
        inst.location.ownerId === characterId
      ) {
        items.push(inst);
      }
    }
    items.sort((a, b) => {
      const aSlot = a.location.type === "inventory" ? a.location.slotIndex : 0;
      const bSlot = b.location.type === "inventory" ? b.location.slotIndex : 0;
      return aSlot - bSlot;
    });
    return items;
  }

  // --- Equipment ---

  equip(characterId: number, slotIndex: number): boolean {
    const inst = this.findInstanceAtSlot(characterId, slotIndex);
    if (!inst) return false;

    const def = getItemDef(inst.defId);
    if (!def || !isEquippable(def)) return false;

    const equipSlot = def.traits.equippable.slot;

    const currentlyEquipped = this.getEquippedInstance(characterId, equipSlot);
    if (currentlyEquipped) {
      currentlyEquipped.location = {
        type: "inventory",
        ownerId: characterId,
        slotIndex,
      };
    }

    inst.location = { type: "equipment", ownerId: characterId, slot: equipSlot };
    return true;
  }

  unequip(characterId: number, slot: string): boolean {
    const equipSlot = slot as EquipSlot;
    const inst = this.getEquippedInstance(characterId, equipSlot);
    if (!inst) return false;

    const slotIndex = this.findFreeInventorySlot(characterId);
    if (slotIndex === -1) return false;

    inst.location = { type: "inventory", ownerId: characterId, slotIndex };
    return true;
  }

  getEquipment(characterId: number): EquipmentLoadout {
    const loadout: EquipmentLoadout = {};
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "equipment" &&
        inst.location.ownerId === characterId
      ) {
        if (inst.location.slot === EquipSlot.MainHand) {
          loadout.mainHand = inst.defId;
        }
      }
    }
    return loadout;
  }

  // --- Cleanup ---

  removePlayer(characterId: number): void {
    this.unloadCharacter(characterId);
  }

  // --- Helpers ---

  private findInventoryItem(
    characterId: number,
    defId: string
  ): ItemInstance | undefined {
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "inventory" &&
        inst.location.ownerId === characterId &&
        inst.defId === defId
      ) {
        return inst;
      }
    }
    return undefined;
  }

  private findFreeInventorySlot(characterId: number): number {
    const used = new Set<number>();
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "inventory" &&
        inst.location.ownerId === characterId
      ) {
        used.add(inst.location.slotIndex);
      }
    }
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  private findInstanceAtSlot(
    characterId: number,
    slotIndex: number
  ): ItemInstance | undefined {
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "inventory" &&
        inst.location.ownerId === characterId &&
        inst.location.slotIndex === slotIndex
      ) {
        return inst;
      }
    }
    return undefined;
  }

  private getEquippedInstance(
    characterId: number,
    slot: EquipSlot
  ): ItemInstance | undefined {
    for (const inst of this.instances.values()) {
      if (
        inst.location.type === "equipment" &&
        inst.location.ownerId === characterId &&
        inst.location.slot === slot
      ) {
        return inst;
      }
    }
    return undefined;
  }
}
