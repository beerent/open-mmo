export interface NpcBehaviorState {
  scope: "world" | "player";
  responses: string[];
  ambient?: string[];
  onTalk?: string;
}

export interface QuestMeta {
  questId: string;
  name: string;
  description: string;
  reward: string;
  /** Maps state IDs to quest statuses for the quest log */
  statusMap: Record<string, "not_started" | "in_progress" | "completed">;
}

export const DEFAULT_STATE = "default";
