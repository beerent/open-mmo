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
  onContextMenu?: (slotIndex: number, event: MouseEvent) => void;

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
      <div class="inv-divider"><span>\u25C6</span></div>
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
      @keyframes rpg-panel-open {
        from { transform: scale(0.95); opacity: 0.7; }
        to { transform: scale(1); opacity: 1; }
      }

      #inventory-panel {
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 200;
        border: 3px solid #4a3520;
        outline: 2px solid #0a0604;
        box-shadow:
          inset 1px 1px 0 0 #8a7040,
          inset -1px -1px 0 0 #201008,
          inset 0 0 10px rgba(0,0,0,0.4),
          0 0 0 3px rgba(10,6,4,0.5),
          0 6px 24px rgba(0,0,0,0.7);
        background:
          repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          linear-gradient(170deg, #3a2a1a 0%, #2e1e10 40%, #241608 100%);
        font-family: 'Press Start 2P', monospace;
        color: #e0d0a0;
        display: none;
        user-select: none;
      }
      #inventory-panel.open {
        display: block;
        animation: rpg-panel-open 0.15s ease-out;
      }
      #inventory-panel::before {
        content: '';
        position: absolute;
        inset: -5px;
        pointer-events: none;
        z-index: 10;
        background:
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 0 0 / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 100% 0 / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 0 100% / 8px 8px,
          radial-gradient(circle 3px at center, #ddb840, #906810 60%, transparent 70%) no-repeat 100% 100% / 8px 8px;
      }

      .inv-titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: linear-gradient(to bottom, #5a4028 0%, #4a3518 30%, #3a2510 70%, #4a3018 100%);
        border-bottom: 2px solid #1a0e04;
        box-shadow: inset 0 1px 0 0 #8a6838;
      }
      .inv-title {
        font-size: 11px;
        color: #c8a84e;
        text-shadow: 1px 1px 0 #000, 0 0 8px rgba(200,168,78,0.3);
        letter-spacing: 1px;
      }
      .inv-close {
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: #886644;
        cursor: pointer;
        line-height: 1;
        font-family: sans-serif;
        border: 1px solid #4a3520;
        background: rgba(0,0,0,0.3);
        box-shadow: inset 1px 1px 0 0 #5a4830, inset -1px -1px 0 0 #1a1008;
      }
      .inv-close:hover {
        color: #e0d0a0;
        background: rgba(200,168,78,0.15);
        border-color: #6b5430;
      }

      .inv-equip-section {
        padding: 10px 14px;
      }
      .inv-equip-label {
        font-size: 8px;
        color: #8a7040;
        margin-bottom: 6px;
        text-shadow: 1px 1px 0 #000;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .inv-equip-slots {
        display: flex;
        gap: 4px;
      }

      .inv-divider {
        height: 1px;
        margin: 0;
        background: linear-gradient(to right, transparent 5%, #6b5430 30%, #c8a84e 50%, #6b5430 70%, transparent 95%);
        position: relative;
        display: flex;
        justify-content: center;
      }
      .inv-divider span {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 6px;
        color: #c8a84e;
        background: #2e1e10;
        padding: 0 6px;
        line-height: 1;
        text-shadow: 0 0 4px rgba(200,168,78,0.3);
      }

      .inv-grid {
        display: grid;
        grid-template-columns: repeat(${COLS}, 56px);
        gap: 4px;
        padding: 10px 14px 14px;
      }

      .inv-slot {
        width: 56px;
        height: 56px;
        background: #0d0906;
        border: 2px solid #3a2818;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5),
          0 1px 0 0 #5a4830;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: box-shadow 0.15s, border-color 0.15s;
      }
      .inv-slot.filled {
        cursor: pointer;
      }
      .inv-slot.filled:hover {
        border-color: #c8a84e;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5),
          0 0 0 1px #c8a84e,
          0 0 8px rgba(200,168,78,0.3);
      }
      .inv-slot.equippable:hover {
        border-color: #1eff00;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5),
          0 0 0 1px #1eff00,
          0 0 8px rgba(30,255,0,0.2);
      }
      .inv-slot.equip-slot {
        background: #100a04;
        border-color: #4a3520;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 6px rgba(200,168,78,0.06),
          0 1px 0 0 #5a4830;
      }
      .inv-slot.equip-slot.filled:hover {
        border-color: #ff4444;
        box-shadow:
          inset 1px 1px 0 0 #060302,
          inset -1px -1px 0 0 #4a3828,
          inset 0 0 4px rgba(0,0,0,0.5),
          0 0 0 1px #ff4444,
          0 0 8px rgba(255,68,68,0.2);
      }

      .inv-slot-icon {
        width: 40px;
        height: 40px;
        image-rendering: pixelated;
      }

      .inv-slot-icon-fallback {
        width: 36px;
        height: 36px;
        background: radial-gradient(circle at 35% 35%, #aaccff, #4488ff 40%, #2255aa 80%, #113366);
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.5);
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
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: #0a0604;
        border: 2px solid #4a3520;
        box-shadow:
          inset 1px 1px 0 0 #6a5030,
          inset -1px -1px 0 0 #0a0604,
          0 0 0 1px #0a0604,
          0 4px 12px rgba(0,0,0,0.8);
        padding: 8px 12px;
        font-size: 10px;
        color: #e0d0a0;
        white-space: nowrap;
        pointer-events: none;
        display: none;
        z-index: 20;
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
          <div class="inv-slot filled${equipClass}" data-slot="${i}" ${equippable ? `data-equip="${i}"` : ""}>
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

    // Bind right-click context menu on filled slots
    this.gridEl.querySelectorAll("[data-slot]").forEach((el) => {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const slotIndex = parseInt((el as HTMLElement).dataset.slot!, 10);
        this.onContextMenu?.(slotIndex, e as MouseEvent);
      });
    });
  }
}
