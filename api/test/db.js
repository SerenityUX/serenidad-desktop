// Per-run isolated Postgres schema. Each test process gets its own schema
// (cocreate_test_<timestamp>), runs the full migration set against it, and
// drops it on teardown. Lets us hit real DB constraints (the whole reason
// migration 018 exists) without polluting the dev database.
//
// Requires DATABASE_URL or PG* env vars pointed at a Postgres the test user
// can CREATE SCHEMA on. Tests skip with a clear log message if no DB is
// reachable so `npm test` doesn't hard-fail in environments that don't have
// Postgres available.

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { pgSslOption } = require("../db/pool");

function connectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: pgSslOption() };
  }
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: pgSslOption(),
  };
}

async function isReachable() {
  const pool = new Pool({ ...connectionConfig(), max: 1 });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * Spin up an isolated schema, run all migrations against it, and return a
 * pool whose search_path is pinned to that schema. Caller must call
 * `dispose()` to drop the schema and end the pool.
 */
async function createIsolatedDb() {
  const schemaName = `cocreate_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const adminPool = new Pool({ ...connectionConfig(), max: 1 });
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  await adminPool.end();

  // App pool uses the schema as its search_path so unqualified table refs
  // resolve there instead of public. `application_name` makes the schema
  // findable in pg_stat_activity if a test hangs.
  const pool = new Pool({
    ...connectionConfig(),
    max: 4,
    application_name: `cocreate-test-${schemaName}`,
  });
  pool.on("connect", (client) => {
    client.query(`SET search_path TO "${schemaName}", public`).catch(() => {});
  });

  // Force the very first connection to set search_path before migrations.
  const c0 = await pool.connect();
  await c0.query(`SET search_path TO "${schemaName}", public`);
  c0.release();

  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }

  return {
    pool,
    schemaName,
    async dispose() {
      try {
        const drop = new Pool({ ...connectionConfig(), max: 1 });
        await drop.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await drop.end();
      } finally {
        await pool.end().catch(() => {});
      }
    },
  };
}

/**
 * Insert a baseline user + project + chat. Returns ids for the test to use
 * with the Authorization: Bearer <token> header.
 */
async function seed(pool, { tokens = 1000, role = "user" } = {}) {
  const u = await pool.query(
    `INSERT INTO users (name, email, token, tokens, role)
     VALUES ('Test User', $1, $2, $3, $4)
     RETURNING id, token`,
    [`test-${Date.now()}-${Math.random()}@cocreate.app`, `tok-${Math.random()}`, tokens, role],
  );
  const userId = u.rows[0].id;
  const token = u.rows[0].token;
  const p = await pool.query(
    `INSERT INTO projects (name, owner_id, width, height, style)
     VALUES ('Test Project', $1, 1280, 720, 'Ghibli/Miyazaki')
     RETURNING id`,
    [userId],
  );
  return { userId, token, projectId: p.rows[0].id };
}

module.exports = { createIsolatedDb, seed, isReachable };
