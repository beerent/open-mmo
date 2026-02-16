import type { InventorySlot, EquipmentLoadout } from "@shireland/shared";
import { getItemDef, isEquippable, getAssetPath, Rarity } from "@shireland/shared";

const SLOT_COUNT = 16; // 4x4 backpack grid
const COLS = 4;

const RARITY_COLORS: Record<string, string> = {
  [Rarity.Common]: "#e0d0a0",
  [Rarity.Uncommon]: "#1eff00",
  [Rarity.Rare]: "#0070dd",
  [Rarity.Epic]: "#a335ee",
  [Rarity.Legendary]: "#ff8000",
};

export class InventoryPanel {
  private container: HTMLDivElement;
  private gridEl: HTMLDivElement;
  private equipEl: HTMLDivElement;
  private visible = false;
  private inventory: InventorySlot[] = [];
  private equipment: EquipmentLoadout = {};

  onEquip?: (slotIndex: number) => void;
  onUnequip?: (slot: string) => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "inventory-panel";

    this.container.innerHTML = `
      <div class="inv-titlebar">
        <span class="inv-title">Backpack</span>
        <span class="inv-close">&times;</span>
      </div>
      <div class="inv-equip-section">
        <div class="inv-equip-label">Equipment</div>
        <div class="inv-equip-slots"></div>
      </div>
      <div class="inv-grid"></div>
    `;

    this.addStyles();
    document.body.appendChild(this.container);
    this.gridEl = this.container.querySelector(".inv-grid") as HTMLDivElement;
    this.equipEl = this.container.querySelector(".inv-equip-slots") as HTMLDivElement;

    this.container.querySelector(".inv-close")!.addEventListener("click", () => {
      this.toggle();
    });

    this.render();
  }

  private addStyles() {
    if (document.getElementById("inventory-styles")) return;
    const style = document.createElement("style");
    style.id = "inventory-styles";
    style.textContent = `
      #inventory-panel {
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 200;
        background: linear-gradient(to bottom, #3a2a1a, #2a1c10);
        border: 2px solid #6b5430;
        border-top-color: #8a7040;
        border-left-color: #8a7040;
        border-radius: 2px;
        font-family: 'Press Start 2P', monospace;
        color: #e0d0a0;
        display: none;
        box-shadow: inset 0 0 0 1px #1a0e04, 0 4px 12px rgba(0,0,0,0.6);
        user-select: none;
      }
      #inventory-panel.open {
        display: block;
      }

      .inv-titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(to bottom, #4a3520, #3a2510);
        border-bottom: 1px solid #6b5430;
        padding: 8px 12px;
      }
      .inv-title {
        font-size: 12px;
        color: #c8a84e;
        text-shadow: 1px 1px 0 #000;
      }
      .inv-close {
        font-size: 18px;
        color: #886644;
        cursor: pointer;
        line-height: 1;
        font-family: sans-serif;
      }
      .inv-close:hover {
        color: #ccaa66;
      }

      .inv-equip-section {
        padding: 8px 10px;
        border-bottom: 1px solid #4a3820;
      }
      .inv-equip-label {
        font-size: 10px;
        color: #886644;
        margin-bottom: 5px;
        text-shadow: 1px 1px 0 #000;
      }
      .inv-equip-slots {
        display: flex;
        gap: 4px;
      }

      .inv-grid {
        display: grid;
        grid-template-columns: repeat(${COLS}, 56px);
        gap: 4px;
        padding: 10px;
      }

      .inv-slot {
        width: 56px;
        height: 56px;
        background: rgba(0,0,0,0.5);
        border: 1px solid #4a3820;
        border-top-color: #2a1a0a;
        border-left-color: #2a1a0a;
        border-bottom-color: #5a4830;
        border-right-color: #5a4830;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .inv-slot.filled {
        cursor: pointer;
      }
      .inv-slot.filled:hover {
        border-color: #c8a84e;
      }
      .inv-slot.equippable:hover {
        border-color: #1eff00;
      }
      .inv-slot.equip-slot {
        border-color: #5a4830;
        background: rgba(30, 20, 10, 0.7);
      }
      .inv-slot.equip-slot.filled:hover {
        border-color: #ff4444;
      }

      .inv-slot-icon {
        width: 40px;
        height: 40px;
        image-rendering: pixelated;
      }

      .inv-slot-icon-fallback {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #aaccff, #4488ff 40%, #2255aa 80%, #113366);
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }

      .inv-slot-count {
        position: absolute;
        bottom: 2px;
        right: 3px;
        font-size: 10px;
        color: #fff;
        text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
        line-height: 1;
      }

      .inv-equip-indicator {
        position: absolute;
        top: 2px;
        left: 3px;
        font-size: 9px;
        color: #1eff00;
        text-shadow: 1px 1px 0 #000;
        line-height: 1;
      }

      .inv-tooltip {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 6, 16, 0.95);
        border: 1px solid #6b5430;
        padding: 6px 10px;
        font-size: 10px;
        color: #e0d0a0;
        white-space: nowrap;
        pointer-events: none;
        display: none;
        z-index: 10;
        text-shadow: 1px 1px 0 #000;
      }
      .inv-slot:hover .inv-tooltip {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.classList.toggle("open", this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(inventory: InventorySlot[]): void {
    this.inventory = inventory;
    this.render();
  }

  updateEquipment(equipment: EquipmentLoadout): void {
    this.equipment = equipment;
    this.render();
  }

  private render(): void {
    this.renderEquipmentSlots();
    this.renderInventoryGrid();
  }

  private renderEquipmentSlots(): void {
    let html = "";

    // Main hand slot
    const mainHandId = this.equipment.mainHand;
    if (mainHandId) {
      const def = getItemDef(mainHandId);
      const name = def?.name ?? mainHandId;
      const iconPath = getAssetPath(mainHandId, "icon");
      const rarityColor = def ? RARITY_COLORS[def.rarity] ?? "#e0d0a0" : "#e0d0a0";
      html += `
        <div class="inv-slot equip-slot filled" data-unequip="mainHand">
          <img class="inv-slot-icon" src="${iconPath}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
          <div class="inv-slot-icon-fallback" style="display:none"></div>
          <div class="inv-tooltip" style="color:${rarityColor}">${name}<br><span style="color:#ff4444;font-size:9px">Click to unequip</span></div>
        </div>
      `;
    } else {
      html += `
        <div class="inv-slot equip-slot">
          <div class="inv-tooltip">Main Hand (empty)</div>
        </div>
      `;
    }

    this.equipEl.innerHTML = html;

    // Bind unequip clicks
    this.equipEl.querySelectorAll("[data-unequip]").forEach((el) => {
      el.addEventListener("click", () => {
        const slot = (el as HTMLElement).dataset.unequip!;
        this.onUnequip?.(slot);
      });
    });
  }

  private renderInventoryGrid(): void {
    let html = "";
    const filledSlots = this.inventory.filter((item) => item.count > 0);

    for (let i = 0; i < SLOT_COUNT; i++) {
      const item = filledSlots[i];
      if (item) {
        const def = getItemDef(item.itemId);
        const name = def?.name ?? item.itemId;
        const iconPath = getAssetPath(item.itemId, "icon");
        const equippable = def && isEquippable(def);
        const rarityColor = def ? RARITY_COLORS[def.rarity] ?? "#e0d0a0" : "#e0d0a0";
        const equipClass = equippable ? " equippable" : "";
        const equipHint = equippable ? `<br><span style="color:#1eff00;font-size:9px">Click to equip</span>` : "";

        html += `
          <div class="inv-slot filled${equipClass}" ${equippable ? `data-equip="${i}"` : ""}>
            <img class="inv-slot-icon" src="${iconPath}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
            <div class="inv-slot-icon-fallback" style="display:none"></div>
            ${item.count > 1 ? `<span class="inv-slot-count">${item.count}</span>` : ""}
            ${equippable ? `<span class="inv-equip-indicator">E</span>` : ""}
            <div class="inv-tooltip" style="color:${rarityColor}">${name}${equipHint}</div>
          </div>
        `;
      } else {
        html += `<div class="inv-slot"></div>`;
      }
    }

    this.gridEl.innerHTML = html;

    // Bind equip clicks
    this.gridEl.querySelectorAll("[data-equip]").forEach((el) => {
      el.addEventListener("click", () => {
        const slotIndex = parseInt((el as HTMLElement).dataset.equip!, 10);
        this.onEquip?.(slotIndex);
      });
    });
  }
}
