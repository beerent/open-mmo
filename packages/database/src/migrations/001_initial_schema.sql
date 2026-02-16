CREATE TABLE accounts (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_accounts_username_lower ON accounts (LOWER(username));

CREATE TABLE twitch_accounts (
  id                SERIAL PRIMARY KEY,
  account_id        INTEGER UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  twitch_id         VARCHAR(64) UNIQUE NOT NULL,
  twitch_username   VARCHAR(64) NOT NULL,
  access_token_enc  TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE characters (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          VARCHAR(16) NOT NULL,
  player_class  VARCHAR(16) NOT NULL,
  x             INTEGER NOT NULL DEFAULT 20,
  y             INTEGER NOT NULL DEFAULT 20,
  direction     SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE item_instances (
  id            SERIAL PRIMARY KEY,
  def_id        VARCHAR(64) NOT NULL,
  count         INTEGER NOT NULL DEFAULT 1,
  location_type VARCHAR(16) NOT NULL CHECK (location_type IN ('world','inventory','equipment')),
  owner_id      INTEGER REFERENCES characters(id) ON DELETE CASCADE,
  x             INTEGER,
  y             INTEGER,
  slot_index    SMALLINT,
  equip_slot    VARCHAR(32),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (location_type = 'world' AND x IS NOT NULL AND y IS NOT NULL AND owner_id IS NULL) OR
    (location_type = 'inventory' AND owner_id IS NOT NULL AND slot_index IS NOT NULL) OR
    (location_type = 'equipment' AND owner_id IS NOT NULL AND equip_slot IS NOT NULL)
  )
);
CREATE INDEX idx_item_instances_owner ON item_instances(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_item_instances_world ON item_instances(location_type) WHERE location_type = 'world';
