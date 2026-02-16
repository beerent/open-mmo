export interface AccountRow {
  id: number;
  username: string;
  password_hash: string | null;
  is_guest: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TwitchAccountRow {
  id: number;
  account_id: number;
  twitch_id: string;
  twitch_username: string;
  access_token_enc: string;
  refresh_token_enc: string;
  created_at: Date;
  updated_at: Date;
}

export interface CharacterRow {
  id: number;
  account_id: number;
  name: string;
  player_class: string;
  x: number;
  y: number;
  direction: number;
  created_at: Date;
  updated_at: Date;
}

export interface ItemInstanceRow {
  id: number;
  def_id: string;
  count: number;
  location_type: "world" | "inventory" | "equipment";
  owner_id: number | null;
  x: number | null;
  y: number | null;
  slot_index: number | null;
  equip_slot: string | null;
  created_at: Date;
  updated_at: Date;
}
