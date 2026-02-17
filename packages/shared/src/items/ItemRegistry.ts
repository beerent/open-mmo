import type { ItemDef, EquippableTrait } from "./ItemDef.js";
import { ItemCategory, Rarity, EquipSlot } from "./ItemDef.js";

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  marble: {
    id: "marble",
    name: "Marble",
    description: "A shiny glass marble. Kids in Shireland love these.",
    category: ItemCategory.Misc,
    rarity: Rarity.Common,
    maxStack: 99,
    traits: {},
  },
  wizard_staff: {
    id: "wizard_staff",
    name: "Wizard's Staff",
    description: "A gnarled wooden staff humming with arcane energy.",
    category: ItemCategory.Weapon,
    rarity: Rarity.Uncommon,
    maxStack: 1,
    traits: {
      equippable: { slot: EquipSlot.MainHand },
    },
  },
};

export function getItemDef(id: string): ItemDef | undefined {
  return ITEM_REGISTRY[id];
}

export function isEquippable(
  def: ItemDef
): def is ItemDef & { traits: { equippable: EquippableTrait } } {
  return def.traits.equippable !== undefined;
}

export function getAssetPath(itemId: string, asset: "icon" | "world"): string {
  return `/assets/sprites/items/${itemId}/${asset}.png`;
}

export function getEquipAssetPath(
  itemId: string,
  sheet: "side" | "down" | "up"
): string {
  const fileNames: Record<typeof sheet, string> = {
    side: "Run",
    down: "Run_Down",
    up: "Run_Up",
  };
  return `/assets/sprites/items/${itemId}/equip/${fileNames[sheet]}.png`;
}
