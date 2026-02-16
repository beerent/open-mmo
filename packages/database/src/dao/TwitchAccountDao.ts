import { pool } from "../pool.js";
import type { TwitchAccountRow } from "../types.js";

export const TwitchAccountDao = {
  async findByTwitchId(twitchId: string): Promise<TwitchAccountRow | null> {
    const { rows } = await pool.query<TwitchAccountRow>(
      "SELECT * FROM twitch_accounts WHERE twitch_id = $1",
      [twitchId]
    );
    return rows[0] ?? null;
  },

  async findByAccountId(accountId: number): Promise<TwitchAccountRow | null> {
    const { rows } = await pool.query<TwitchAccountRow>(
      "SELECT * FROM twitch_accounts WHERE account_id = $1",
      [accountId]
    );
    return rows[0] ?? null;
  },

  async create(
    accountId: number,
    twitchId: string,
    twitchUsername: string,
    accessTokenEnc: string,
    refreshTokenEnc: string
  ): Promise<TwitchAccountRow> {
    const { rows } = await pool.query<TwitchAccountRow>(
      `INSERT INTO twitch_accounts (account_id, twitch_id, twitch_username, access_token_enc, refresh_token_enc)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [accountId, twitchId, twitchUsername, accessTokenEnc, refreshTokenEnc]
    );
    return rows[0];
  },

  async updateTokens(
    twitchId: string,
    accessTokenEnc: string,
    refreshTokenEnc: string
  ): Promise<void> {
    await pool.query(
      `UPDATE twitch_accounts
       SET access_token_enc = $1, refresh_token_enc = $2, updated_at = NOW()
       WHERE twitch_id = $3`,
      [accessTokenEnc, refreshTokenEnc, twitchId]
    );
  },
};
