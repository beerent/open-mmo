import type { PlayerClass } from "../types.js";

export enum ItemCategory {
  Weapon = "weapon",
  Armor = "armor",
  Accessory = "accessory",
  Consumable = "consumable",
  Material = "material",
  Quest = "quest",
  Misc = "misc",
}

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export enum EquipSlot {
  MainHand = "mainHand",
}

export interface EquippableTrait {
  slot: EquipSlot;
  classRestriction?: PlayerClass[];
}

export interface ItemTraits {
  equippable?: EquippableTrait;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: Rarity;
  inventoryStackMax: number;
  worldStackMax: number;
  traits: ItemTraits;
  friendlyName: string;
}
