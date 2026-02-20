import { DEFAULT_STATE } from "@shireland/shared";

/**
 * Per-player, per-NPC behavior state tracking.
 * Map<characterId, Map<npcDialogKey, stateId>>
 */
export class NpcStateManager {
  private states = new Map<number, Map<string, string>>();

  getState(characterId: number, dialogKey: string): string {
    return this.states.get(characterId)?.get(dialogKey) ?? DEFAULT_STATE;
  }

  setState(characterId: number, dialogKey: string, stateId: string): void {
    let playerMap = this.states.get(characterId);
    if (!playerMap) {
      playerMap = new Map();
      this.states.set(characterId, playerMap);
    }
    playerMap.set(dialogKey, stateId);
  }

  clearPlayer(characterId: number): void {
    this.states.delete(characterId);
  }
}
