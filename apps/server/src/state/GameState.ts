import { PlayerState } from "./PlayerState.js";
import type { PlayerData } from "@shireland/shared";

export class GameState {
  private players = new Map<string, PlayerState>();
  private accountToSocket = new Map<number, string>();

  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
    this.accountToSocket.set(player.accountId, player.id);
  }

  removePlayer(id: string): PlayerState | undefined {
    const player = this.players.get(id);
    if (player) {
      this.players.delete(id);
      this.accountToSocket.delete(player.accountId);
    }
    return player;
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  isAccountOnline(accountId: number): string | undefined {
    return this.accountToSocket.get(accountId);
  }

  getDirtyPlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter((p) => p.dirty);
  }

  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getSnapshot(): PlayerData[] {
    return this.getAllPlayers().map((p) => p.toData());
  }

  getPlayerCount(): number {
    return this.players.size;
  }
}
