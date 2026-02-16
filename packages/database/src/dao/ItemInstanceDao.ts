import { pool } from "../pool.js";
import type { ItemInstanceRow } from "../types.js";

export const ItemInstanceDao = {
  async findWorldItems(): Promise<ItemInstanceRow[]> {
    const { rows } = await pool.query<ItemInstanceRow>(
      "SELECT * FROM item_instances WHERE location_type = 'world'"
    );
    return rows;
  },

  async findByOwner(characterId: number): Promise<ItemInstanceRow[]> {
    const { rows } = await pool.query<ItemInstanceRow>(
      "SELECT * FROM item_instances WHERE owner_id = $1",
      [characterId]
    );
    return rows;
  },

  async createWorldItem(
    defId: string,
    x: number,
    y: number,
    count: number = 1
  ): Promise<ItemInstanceRow> {
    const { rows } = await pool.query<ItemInstanceRow>(
      `INSERT INTO item_instances (def_id, count, location_type, x, y)
       VALUES ($1, $2, 'world', $3, $4)
       RETURNING *`,
      [defId, count, x, y]
    );
    return rows[0];
  },

  /** Atomically move a world item to a character's inventory */
  async atomicPickup(
    itemId: number,
    characterId: number,
    slotIndex: number
  ): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE item_instances
       SET location_type = 'inventory', owner_id = $1, slot_index = $2,
           x = NULL, y = NULL, updated_at = NOW()
       WHERE id = $3 AND location_type = 'world'`,
      [characterId, slotIndex, itemId]
    );
    return (rowCount ?? 0) > 0;
  },

  /** Replace all items for a character (inventory + equipment). Runs in a transaction. */
  async saveAllForCharacter(
    characterId: number,
    items: {
      defId: string;
      count: number;
      locationType: "inventory" | "equipment";
      slotIndex?: number;
      equipSlot?: string;
    }[]
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Delete old character items
      await client.query(
        "DELETE FROM item_instances WHERE owner_id = $1 AND location_type != 'world'",
        [characterId]
      );

      // Insert current items
      for (const item of items) {
        if (item.locationType === "inventory") {
          await client.query(
            `INSERT INTO item_instances (def_id, count, location_type, owner_id, slot_index)
             VALUES ($1, $2, 'inventory', $3, $4)`,
            [item.defId, item.count, characterId, item.slotIndex]
          );
        } else {
          await client.query(
            `INSERT INTO item_instances (def_id, count, location_type, owner_id, equip_slot)
             VALUES ($1, $2, 'equipment', $3, $4)`,
            [item.defId, item.count, characterId, item.equipSlot]
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
