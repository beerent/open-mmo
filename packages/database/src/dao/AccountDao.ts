import { randomBytes } from "crypto";
import { pool } from "../pool.js";
import type { AccountRow } from "../types.js";

export const AccountDao = {
  async findByUsername(username: string): Promise<AccountRow | null> {
    const { rows } = await pool.query<AccountRow>(
      "SELECT * FROM accounts WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    return rows[0] ?? null;
  },

  async findById(id: number): Promise<AccountRow | null> {
    const { rows } = await pool.query<AccountRow>(
      "SELECT * FROM accounts WHERE id = $1",
      [id]
    );
    return rows[0] ?? null;
  },

  async create(
    username: string,
    passwordHash: string | null
  ): Promise<AccountRow> {
    const { rows } = await pool.query<AccountRow>(
      `INSERT INTO accounts (username, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [username, passwordHash]
    );
    return rows[0];
  },

  async createGuest(): Promise<AccountRow> {
    const suffix = randomBytes(4).toString("hex");
    const username = `~guest_${suffix}`;
    const { rows } = await pool.query<AccountRow>(
      `INSERT INTO accounts (username, password_hash, is_guest)
       VALUES ($1, NULL, TRUE)
       RETURNING *`,
      [username]
    );
    return rows[0];
  },

  async claimGuest(
    accountId: number,
    username: string,
    passwordHash: string
  ): Promise<AccountRow | null> {
    const { rows } = await pool.query<AccountRow>(
      `UPDATE accounts
       SET username = $2, password_hash = $3, is_guest = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_guest = TRUE
       RETURNING *`,
      [accountId, username, passwordHash]
    );
    return rows[0] ?? null;
  },
};
