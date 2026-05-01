const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");

function pgSslOption() {
  if (process.env.PGSSLMODE === "disable") {
    return false;
  }
  if (
    process.env.PGSSLMODE === "require" ||
    process.env.PGSSL === "true"
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPool() {
  return process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: pgSslOption(),
      })
    : new Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: pgSslOption(),
      });
}

module.exports = { createPool, pgSslOption };
