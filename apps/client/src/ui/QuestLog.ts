import type { QuestData } from "@shireland/shared";

type QuestStatus = QuestData["status"];

const STATUS_ICON: Record<QuestStatus, string> = {
  not_started: "\u25CB",   // ○
  in_progress: "\u25C6",   // ◆
  completed: "\u2713",     // ✓
};

const STATUS_COLOR: Record<QuestStatus, string> = {
  not_started: "#888",
  in_progress: "#e6b422",
  completed: "#1eff00",
};

const STATUS_LABEL: Record<QuestStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export class QuestLog {
  private container: HTMLDivElement;
  private listEl: HTMLDivElement;
  private modal: HTMLDivElement;
  private visible = false;
  private quests: QuestData[] = [];

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "quest-log-panel";

    this.container.innerHTML = `
      <div class="ql-titlebar">
        <span class="ql-title">Quest Log</span>
        <span class="ql-close">&times;</span>
      </div>
      <div class="ql-list"></div>
    `;

    // Detail modal (shared, content swapped on click)
    this.modal = document.createElement("div");
    this.modal.id = "quest-detail-modal";
    this.modal.innerHTML = `
      <div class="qd-backdrop"></div>
      <div class="qd-dialog">
        <div class="qd-titlebar">
          <span class="qd-title"></span>
          <span class="qd-close">&times;</span>
        </div>
        <div class="qd-body">
          <div class="qd-status"></div>
          <div class="qd-desc"></div>
          <div class="qd-reward-section">
            <div class="qd-reward-label">Reward</div>
            <div class="qd-reward"></div>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.container);
    document.body.appendChild(this.modal);
    this.listEl = this.container.querySelector(".ql-list") as HTMLDivElement;

    this.container.querySelector(".ql-close")!.addEventListener("click", () => {
      this.toggle();
    });

    // Close detail modal
    this.modal.querySelector(".qd-close")!.addEventListener("click", () => {
      this.closeDetail();
    });
    this.modal.querySelector(".qd-backdrop")!.addEventListener("click", () => {
      this.closeDetail();
    });

    this.render();
  }

  private addStyles() {
    if (document.getElementById("quest-log-styles")) return;
    const style = document.createElement("style");
    style.id = "quest-log-styles";
    style.textContent = `
      @keyframes rpg-panel-open {
        from { transform: scale(0.95); opacity: 0.7; }
        to { transform: scale(1); opacity: 1; }
      }

      #quest-log-panel {
        position: fixed;
        bottom: 12px;
        left: 12px;
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
        width: 270px;
      }
      #quest-log-panel.open {
        display: block;
        animation: rpg-panel-open 0.15s ease-out;
      }
      #quest-log-panel::before {
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

      .ql-titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: linear-gradient(to bottom, #5a4028 0%, #4a3518 30%, #3a2510 70%, #4a3018 100%);
        border-bottom: 2px solid #1a0e04;
        box-shadow: inset 0 1px 0 0 #8a6838;
      }
      .ql-title {
        font-size: 11px;
        color: #c8a84e;
        text-shadow: 1px 1px 0 #000, 0 0 8px rgba(200,168,78,0.3);
        letter-spacing: 1px;
      }
      .ql-close {
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
      .ql-close:hover {
        color: #e0d0a0;
        background: rgba(200,168,78,0.15);
        border-color: #6b5430;
      }

      .ql-list {
        max-height: 300px;
        overflow-y: auto;
        padding: 4px 0;
        scrollbar-width: thin;
        scrollbar-color: #6b5430 #1a1008;
      }
      .ql-list::-webkit-scrollbar {
        width: 8px;
      }
      .ql-list::-webkit-scrollbar-track {
        background: #1a1008;
        border-left: 1px solid #0a0604;
      }
      .ql-list::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, #7a5c30, #5a4020);
        border: 1px solid #0a0604;
        box-shadow: inset 1px 0 0 0 #8a7040;
      }

      .ql-quest {
        display: flex;
        gap: 10px;
        padding: 10px 14px;
        align-items: center;
        cursor: pointer;
        border-left: 2px solid transparent;
        transition: background 0.1s, border-color 0.1s;
      }
      .ql-quest:hover {
        background: rgba(200,168,78,0.08);
        border-left-color: #c8a84e;
      }
      .ql-quest + .ql-quest {
        border-top: 1px solid rgba(60,40,20,0.6);
      }
      .ql-quest::after {
        content: '\u203A';
        font-size: 14px;
        color: #3a2818;
        font-family: sans-serif;
        flex-shrink: 0;
        transition: color 0.1s;
      }
      .ql-quest:hover::after {
        color: #c8a84e;
      }

      .ql-icon {
        flex-shrink: 0;
        font-size: 12px;
        line-height: 16px;
        width: 16px;
        text-align: center;
      }

      .ql-name {
        flex: 1;
        font-size: 10px;
        line-height: 16px;
        text-shadow: 1px 1px 0 #000;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ql-name.completed {
        text-decoration: line-through;
      }

      /* Quest detail modal */
      #quest-detail-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 300;
      }
      #quest-detail-modal.open {
        display: block;
        animation: rpg-panel-open 0.15s ease-out;
      }

      .qd-backdrop {
        position: absolute;
        inset: 0;
        background: transparent;
      }

      .qd-dialog {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 360px;
        border: 3px solid #4a3520;
        outline: 2px solid #0a0604;
        box-shadow:
          inset 1px 1px 0 0 #8a7040,
          inset -1px -1px 0 0 #201008,
          inset 0 0 10px rgba(0,0,0,0.4),
          0 0 0 3px rgba(10,6,4,0.5),
          0 8px 32px rgba(0,0,0,0.8);
        background:
          repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px),
          linear-gradient(170deg, #3a2a1a 0%, #2e1e10 40%, #241608 100%);
        font-family: 'Press Start 2P', monospace;
        color: #e0d0a0;
      }
      .qd-dialog::before {
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

      .qd-titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: linear-gradient(to bottom, #5a4028 0%, #4a3518 30%, #3a2510 70%, #4a3018 100%);
        border-bottom: 2px solid #1a0e04;
        box-shadow: inset 0 1px 0 0 #8a6838;
      }
      .qd-title {
        font-size: 11px;
        text-shadow: 1px 1px 0 #000, 0 0 8px rgba(200,168,78,0.3);
        line-height: 16px;
        letter-spacing: 1px;
      }
      .qd-close {
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
      .qd-close:hover {
        color: #e0d0a0;
        background: rgba(200,168,78,0.15);
        border-color: #6b5430;
      }

      .qd-body {
        padding: 14px;
      }
      .qd-status {
        font-size: 9px;
        margin-bottom: 14px;
        text-shadow: 1px 1px 0 #000;
      }
      .qd-desc {
        font-size: 10px;
        line-height: 18px;
        color: #c0b090;
        text-shadow: 1px 1px 0 #000;
      }

      .qd-reward-section {
        margin-top: 14px;
        padding-top: 12px;
        position: relative;
      }
      .qd-reward-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(to right, transparent 5%, #6b5430 30%, #c8a84e 50%, #6b5430 70%, transparent 95%);
      }
      .qd-reward-label {
        font-size: 8px;
        color: #8a7040;
        margin-bottom: 8px;
        text-shadow: 1px 1px 0 #000;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .qd-reward {
        font-size: 10px;
        color: #e6b422;
        text-shadow: 1px 1px 0 #000, 0 0 6px rgba(230,180,34,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .qd-reward-icon {
        display: inline-block;
        width: 12px;
        height: 12px;
        background: linear-gradient(135deg, #ffe070, #c8a020);
        border: 1px solid #806010;
        transform: rotate(45deg);
        box-shadow:
          inset 1px 0 0 0 #ffe890,
          inset 0 1px 0 0 #ffe890,
          inset -1px 0 0 0 #906810,
          inset 0 -1px 0 0 #906810;
        flex-shrink: 0;
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

  update(quests: QuestData[]): void {
    this.quests = quests;
    this.render();
  }

  private openDetail(quest: QuestData): void {
    const icon = STATUS_ICON[quest.status];
    const color = STATUS_COLOR[quest.status];
    const label = STATUS_LABEL[quest.status];

    const titleEl = this.modal.querySelector(".qd-title") as HTMLElement;
    titleEl.textContent = quest.name;
    titleEl.style.color = color;

    (this.modal.querySelector(".qd-status") as HTMLElement).innerHTML =
      `<span style="color:${color}">${icon}</span> <span style="color:${color}">${label}</span>`;
    (this.modal.querySelector(".qd-desc") as HTMLElement).textContent = quest.description;
    (this.modal.querySelector(".qd-reward") as HTMLElement).innerHTML =
      `<span class="qd-reward-icon"></span> ${quest.reward}`;

    this.modal.classList.add("open");
  }

  private closeDetail(): void {
    this.modal.classList.remove("open");
  }

  private render(): void {
    if (this.quests.length === 0) {
      this.listEl.innerHTML = `<div style="padding:16px 14px;color:#6b5430;font-size:9px;text-align:center;text-shadow:1px 1px 0 #000">No quests yet.</div>`;
      return;
    }

    let html = "";
    for (let i = 0; i < this.quests.length; i++) {
      const quest = this.quests[i];
      const icon = STATUS_ICON[quest.status];
      const color = STATUS_COLOR[quest.status];
      const nameClass = quest.status === "completed" ? " completed" : "";
      html += `
        <div class="ql-quest" data-qi="${i}">
          <span class="ql-icon" style="color:${color}">${icon}</span>
          <span class="ql-name${nameClass}" style="color:${color}">${quest.name}</span>
        </div>
      `;
    }
    this.listEl.innerHTML = html;

    this.listEl.querySelectorAll(".ql-quest").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt((el as HTMLElement).dataset.qi!, 10);
        this.openDetail(this.quests[idx]);
      });
    });
  }
}
