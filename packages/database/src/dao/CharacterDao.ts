import { pool } from "../pool.js";
import type { CharacterRow } from "../types.js";

export const CharacterDao = {
  async findByAccountId(accountId: number): Promise<CharacterRow | null> {
    const { rows } = await pool.query<CharacterRow>(
      "SELECT * FROM characters WHERE account_id = $1",
      [accountId]
    );
    return rows[0] ?? null;
  },

  async findById(id: number): Promise<CharacterRow | null> {
    const { rows } = await pool.query<CharacterRow>(
      "SELECT * FROM characters WHERE id = $1",
      [id]
    );
    return rows[0] ?? null;
  },

  async create(
    accountId: number,
    name: string,
    playerClass: string,
    x: number,
    y: number
  ): Promise<CharacterRow> {
    const { rows } = await pool.query<CharacterRow>(
      `INSERT INTO characters (account_id, name, player_class, x, y)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [accountId, name, playerClass, x, y]
    );
    return rows[0];
  },

  async updatePosition(
    id: number,
    x: number,
    y: number,
    direction: number
  ): Promise<void> {
    await pool.query(
      `UPDATE characters SET x = $1, y = $2, direction = $3, updated_at = NOW()
       WHERE id = $4`,
      [x, y, direction, id]
    );
  },

  async batchUpdatePositions(
    updates: { id: number; x: number; y: number; direction: number }[]
  ): Promise<void> {
    if (updates.length === 0) return;
    const ids = updates.map((u) => u.id);
    const xs = updates.map((u) => u.x);
    const ys = updates.map((u) => u.y);
    const dirs = updates.map((u) => u.direction);

    await pool.query(
      `UPDATE characters AS c SET
         x = v.x, y = v.y, direction = v.direction, updated_at = NOW()
       FROM UNNEST($1::int[], $2::int[], $3::int[], $4::smallint[])
         AS v(id, x, y, direction)
       WHERE c.id = v.id`,
      [ids, xs, ys, dirs]
    );
  },
};
