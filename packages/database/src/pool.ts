import pg from "pg";

const pool = new pg.Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "shireland",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,
});

export { pool };
