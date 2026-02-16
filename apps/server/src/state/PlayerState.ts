import { Direction, PlayerClass } from "@shireland/shared";
import type { PlayerData, EquipmentLoadout } from "@shireland/shared";

export class PlayerState {
  readonly id: string; // socket.id
  readonly accountId: number;
  readonly characterId: number;
  name: string;
  playerClass: PlayerClass;
  x: number;
  y: number;
  direction: Direction;
  lastMoveTime: number = 0;
  equipment: EquipmentLoadout = {};
  dirty: boolean = false;

  constructor(
    id: string,
    accountId: number,
    characterId: number,
    name: string,
    playerClass: PlayerClass,
    x: number,
    y: number,
    direction: Direction = Direction.Down
  ) {
    this.id = id;
    this.accountId = accountId;
    this.characterId = characterId;
    this.name = name;
    this.playerClass = playerClass;
    this.x = x;
    this.y = y;
    this.direction = direction;
  }

  toData(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      playerClass: this.playerClass,
      x: this.x,
      y: this.y,
      direction: this.direction,
      equipment: this.equipment,
    };
  }
}
