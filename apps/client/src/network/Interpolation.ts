import { RemotePlayer } from "../entities/RemotePlayer";

export class Interpolation {
  private remotePlayers: Map<string, RemotePlayer>;

  constructor(remotePlayers: Map<string, RemotePlayer>) {
    this.remotePlayers = remotePlayers;
  }

  update(dt: number) {
    for (const player of this.remotePlayers.values()) {
      player.update(dt);
    }
  }
}
